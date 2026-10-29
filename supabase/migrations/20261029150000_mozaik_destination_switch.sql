-- Candidate: retain prior association until the replacement destination is verified.
begin;
-- Both writers take the same transaction lock for an activity. The reservation
-- prevents a metadata association from racing an active grade transfer.
create or replace function public.cardinal_reserve_mozaik_job_target() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text; y text; sid text; sub text; gid text;
begin
 if new.status not in ('ready','claimed') then return new; end if;
 target:=coalesce(nullif(new.checkpoint->>'activityId',''),nullif(new.payload#>>'{link,activityId}',''));
 if target is null then return new; end if;
 y:=new.payload#>>'{scope,schoolYear}';sid:=new.payload#>>'{scope,schoolId}';sub:=new.payload#>>'{scope,subjectId}';gid:=new.payload#>>'{scope,mozaikGroupId}';
 perform pg_advisory_xact_lock(hashtextextended('cardinal-mozaik-target:'||target,0));
 -- A ready code expires without a client claiming it; only those stale jobs
 -- can be released automatically. Claimed journals remain resumable.
 update public.school_mozaik_sync_jobs j set status='expired',completed_at=clock_timestamp(),result=jsonb_build_object('success',false,'message','Préparation expirée.')
 where j.id<>new.id and j.status='ready' and j.expires_at<=clock_timestamp()
 and coalesce(nullif(j.checkpoint->>'activityId',''),nullif(j.payload#>>'{link,activityId}',''))=target
 and j.payload#>>'{scope,schoolYear}'=y and j.payload#>>'{scope,schoolId}'=sid and j.payload#>>'{scope,subjectId}'=sub and j.payload#>>'{scope,mozaikGroupId}'=gid;
 if exists(select 1 from public.school_mozaik_links l where l.assignment_id<>new.assignment_id and l.activity_id=target
  and ((l.group_code=new.group_code and (l.school_year is null or l.school_id is null or l.subject_id is null or l.mozaik_group_id is null))
  or (l.school_year=y and l.school_id=sid and l.subject_id=sub and l.mozaik_group_id=gid))) then raise exception 'target_already_linked';end if;
 return new;
end $$;
create or replace function public.cardinal_reserve_mozaik_link_target() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.activity_id,'')='' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('cardinal-mozaik-target:'||new.activity_id,0));
 if exists(select 1 from public.school_mozaik_sync_jobs j where j.status in ('ready','claimed')
  and (j.status='claimed' or j.expires_at>clock_timestamp()) and j.assignment_id<>new.assignment_id
  and coalesce(nullif(j.checkpoint->>'activityId',''),nullif(j.payload#>>'{link,activityId}',''))=new.activity_id
  and ((new.group_code=j.group_code and (new.school_year is null or new.school_id is null or new.subject_id is null or new.mozaik_group_id is null))
  or (new.school_year=j.payload#>>'{scope,schoolYear}' and new.school_id=j.payload#>>'{scope,schoolId}' and new.subject_id=j.payload#>>'{scope,subjectId}' and new.mozaik_group_id=j.payload#>>'{scope,mozaikGroupId}')))
  then raise exception 'target_has_active_sync';end if;
 return new;
end $$;
revoke all on function public.cardinal_reserve_mozaik_job_target(),public.cardinal_reserve_mozaik_link_target() from public,anon,authenticated;
create trigger cardinal_reserve_mozaik_job_target before insert or update on public.school_mozaik_sync_jobs for each row execute function public.cardinal_reserve_mozaik_job_target();
create trigger cardinal_reserve_mozaik_link_target before insert or update on public.school_mozaik_links for each row execute function public.cardinal_reserve_mozaik_link_target();
create or replace function public.cardinal_cancel_unwritten_mozaik_job(p_teacher text,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;
begin
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.id is null or j.teacher_email<>p_teacher or not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_job_owner';end if;
 if j.status='expired' and j.result->>'reason'='explicit_prewrite_cancel' then return jsonb_build_object('mode','cancelled','jobId',j.id);end if;
 if j.status<>'claimed' then raise exception 'invalid_job_status';end if;
 if j.checkpoint is not null and (j.checkpoint->>'phase' is distinct from 'planned' or j.checkpoint->>'reviewConfirmed'='true') then
  return jsonb_build_object('mode','preserved','jobId',j.id);
 end if;
 update public.school_mozaik_sync_jobs set status='expired',completed_at=clock_timestamp(),result=jsonb_build_object('cancelled',true,'reason','explicit_prewrite_cancel') where id=p_job_id;
 return jsonb_build_object('mode','cancelled','jobId',j.id);
end $$;
revoke all on function public.cardinal_cancel_unwritten_mozaik_job(text,uuid) from public,anon,authenticated;
grant execute on function public.cardinal_cancel_unwritten_mozaik_job(text,uuid) to service_role;
-- Serialize outstanding jobs targeting the same scoped activity even when
-- they originate from different Gestion assignments. A newly-created identity
-- enters the index as soon as it is recorded in the checkpoint.
create unique index if not exists school_mozaik_one_active_target
 on public.school_mozaik_sync_jobs (
  (payload#>>'{scope,schoolYear}'), (payload#>>'{scope,schoolId}'),
  (payload#>>'{scope,subjectId}'), (payload#>>'{scope,mozaikGroupId}'),
  (coalesce(nullif(checkpoint->>'activityId',''),nullif(payload#>>'{link,activityId}','')))
 ) where status in ('ready','claimed')
 and coalesce(nullif(checkpoint->>'activityId',''),nullif(payload#>>'{link,activityId}','')) is not null;
create or replace function public.cardinal_assert_mozaik_source(p_job_id uuid,p_claim_hash text) returns public.school_mozaik_sync_jobs
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;a public.school_assignments;g public.school_mozaik_groups;l public.school_mozaik_links;
begin
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.id is null or j.status<>'claimed' or j.claim_hash is null or j.claim_hash is distinct from p_claim_hash or j.payload->>'protocolVersion' is distinct from '2' then raise exception 'invalid_claim';end if;
 select * into a from public.school_assignments where id=j.assignment_id for update;
 if a.id is null or (not j.reconcile_stale and a.revision::text is distinct from j.payload->>'sourceRevision')
 or a.group_codes is distinct from array[j.group_code] then raise exception 'stale_source_revision';end if;
 perform public.cardinal_assert_year_open(a.school_year,true);
 if a.school_year::text is distinct from j.payload#>>'{scope,schoolYear}' then raise exception 'school_year_mismatch';end if;
 -- Only identities whose grades are in this frozen batch constrain its membership.
 -- Name edits and unrelated roster arrivals/departures do not change those identities.
 if jsonb_typeof(j.payload->'results') is distinct from 'array' or exists(
  select 1 from jsonb_array_elements(j.payload->'results') r where not exists(
   select 1 from public.school_year_enrollments s where s.school_year=a.school_year and s.student_email=r->>'email' and s.active and s.group_code=j.group_code))
 then raise exception 'stale_roster_scope';end if;
 select * into g from public.school_mozaik_groups where group_code=j.group_code for share;
 if g.group_course_id::text is distinct from j.payload#>>'{group,groupCourseId}'
 or g.group_matter_id::text is distinct from j.payload#>>'{group,groupMatterId}'
 or g.establishment_id::text is distinct from j.payload#>>'{group,establishmentId}'
 or g.subject_code::text is distinct from j.payload#>>'{group,subjectCode}' then raise exception 'stale_group_scope';end if;
 select * into l from public.school_mozaik_links where assignment_id=j.assignment_id and group_code=j.group_code for update;
 if j.payload ? 'previousLink' then
  if coalesce(j.payload#>>'{previousLink,activityId}','')='' or l.activity_id::text is distinct from j.payload#>>'{previousLink,activityId}' then raise exception 'stale_activity_link';end if;
  if exists(select 1 from public.school_mozaik_links other where other.assignment_id<>j.assignment_id and other.activity_id=coalesce(nullif(j.checkpoint->>'activityId',''),nullif(j.payload#>>'{link,activityId}','')) and (other.group_code=j.group_code and (other.school_year is null or other.school_id is null or other.subject_id is null or other.mozaik_group_id is null) or other.school_year=j.payload#>>'{scope,schoolYear}' and other.school_id=j.payload#>>'{scope,schoolId}' and other.subject_id=j.payload#>>'{scope,subjectId}' and other.mozaik_group_id=j.payload#>>'{scope,mozaikGroupId}')) then raise exception 'target_already_linked';end if;
 elsif coalesce(j.payload#>>'{link,activityId}','')<>'' and l.activity_id::text is distinct from j.payload#>>'{link,activityId}' then raise exception 'stale_activity_link';end if;
 if j.payload#>>'{scope,groupCode}' is distinct from j.group_code
 or j.payload#>>'{scope,schoolId}' is distinct from g.establishment_id::text
 or j.payload#>>'{scope,subjectId}' is distinct from g.subject_code::text
 or j.payload#>>'{scope,mozaikGroupId}' is distinct from g.group_matter_id::text
 or j.payload#>>'{scope,schoolYear}' is null
 or substring(g.group_matter_id::text from length(g.establishment_id::text)+1 for 4) !~ '^20[0-9]{2}$'
 or left(g.group_matter_id::text,length(g.establishment_id::text))<>g.establishment_id::text
 or left(g.group_course_id::text,length(g.establishment_id::text))<>g.establishment_id::text
 or j.payload#>>'{scope,schoolYear}' is distinct from substring(g.group_matter_id::text from length(g.establishment_id::text)+1 for 4)
 or j.payload#>>'{scope,schoolYear}' is distinct from substring(g.group_course_id::text from length(g.establishment_id::text)+1 for 4)
 or l.school_year is not null and l.school_year is distinct from j.payload#>>'{scope,schoolYear}'
 or l.school_id is not null and l.school_id is distinct from j.payload#>>'{scope,schoolId}'
 or l.subject_id is not null and l.subject_id is distinct from j.payload#>>'{scope,subjectId}'
 or l.mozaik_group_id is not null and l.mozaik_group_id is distinct from j.payload#>>'{scope,mozaikGroupId}' then raise exception 'invalid_exact_scope';end if;
 if not (j.payload ? 'previousLink') and j.checkpoint->>'activityId' is not null and l.activity_id is not null and l.activity_id::text<>j.checkpoint->>'activityId' then raise exception 'stale_activity_link';end if;
 return j;
end $$;

create or replace function public.cardinal_checkpoint_mozaik_job(p_job_id uuid,p_claim_hash text,p_checkpoint jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;v_phase text:=p_checkpoint->>'phase';v_old text;v_rank int;v_old_rank int;
begin
 j:=public.cardinal_assert_mozaik_source(p_job_id,p_claim_hash);
 v_old:=j.checkpoint->>'phase';
 v_rank:=array_position(array['creating','created','planned','parameters_verified','results_verified','verified'],v_phase);
 v_old_rank:=array_position(array['creating','created','planned','parameters_verified','results_verified','verified'],v_old);
 if v_rank is null or (v_old_rank is not null and (v_rank<v_old_rank or v_rank>v_old_rank+1)) then raise exception 'invalid_job_phase';end if;
 if j.checkpoint is null and v_phase not in ('creating','planned') then raise exception 'missing_initial_phase';end if;
 if v_phase<>'creating' and coalesce(p_checkpoint->>'activityId','')='' then raise exception 'missing_activity_id';end if;
 if coalesce(j.payload#>>'{link,activityId}','')<>'' and p_checkpoint->>'activityId' is distinct from j.payload#>>'{link,activityId}' then raise exception 'wrong_activity_id';end if;
 if j.checkpoint->>'activityId' is not null and p_checkpoint->>'activityId' is distinct from j.checkpoint->>'activityId' then raise exception 'immutable_activity_id';end if;
 if j.checkpoint->>'reviewConfirmed'='true' and p_checkpoint->>'reviewConfirmed' is distinct from 'true' then raise exception 'immutable_review_confirmation';end if;
 if j.checkpoint->'initial' is not null then
  if jsonb_strip_nulls(p_checkpoint->'initial') is distinct from jsonb_strip_nulls(j.checkpoint->'initial') or jsonb_strip_nulls(p_checkpoint->'target') is distinct from jsonb_strip_nulls(j.checkpoint->'target') then raise exception 'immutable_job_snapshot';end if;
  p_checkpoint:=jsonb_set(jsonb_set(p_checkpoint,'{initial}',j.checkpoint->'initial'),'{target}',j.checkpoint->'target');
 end if;
 if v_rank>=3 then
  if jsonb_typeof(p_checkpoint#>'{initial,results,eleves}') is distinct from 'array'
  or jsonb_typeof(p_checkpoint#>'{target,results,eleves}') is distinct from 'array'
  or p_checkpoint#>>'{target,activity,parametresEvaluation,noteMaximale}' is distinct from j.payload#>>'{assignment,maxScore}'
  or p_checkpoint#>>'{target,activity,idGroupe}' is distinct from j.payload#>>'{group,groupMatterId}' then raise exception 'invalid_target_snapshot';end if;
 end if;
 if v_phase='verified' and (p_checkpoint->>'verifiedCount')::int is distinct from jsonb_array_length(j.payload->'results') then raise exception 'incomplete_verification';end if;
 update public.school_mozaik_sync_jobs set checkpoint=p_checkpoint where id=p_job_id;
 -- Persist newly created identity before subsequent parameter or result writes.
 if v_phase='created' and not (j.payload ? 'previousLink') then
  insert into public.school_mozaik_links(assignment_id,group_code,activity_id,sync_status,school_year,school_id,subject_id,mozaik_group_id)
  values(j.assignment_id,j.group_code,p_checkpoint->>'activityId','dirty',j.payload#>>'{scope,schoolYear}',j.payload#>>'{scope,schoolId}',j.payload#>>'{scope,subjectId}',j.payload#>>'{scope,mozaikGroupId}')
  on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,sync_status='dirty',school_year=excluded.school_year,school_id=excluded.school_id,subject_id=excluded.subject_id,mozaik_group_id=excluded.mozaik_group_id;
 end if;
 return p_checkpoint;
end $$;
commit;
