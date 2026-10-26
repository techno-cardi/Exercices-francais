-- Offline candidate only. Requires 20261026180000 and 20261026200000.
begin;
alter table public.school_mozaik_sync_jobs add column if not exists checkpoint jsonb,add column if not exists reconcile_stale boolean not null default false;
-- Existing protocol-1 jobs must never enter the new writer.
update public.school_mozaik_sync_jobs set status='expired',completed_at=now()
 where status in ('ready','claimed') and coalesce((payload->>'protocolVersion')::int,1)<2;
create unique index if not exists school_mozaik_one_active_assignment_group
 on public.school_mozaik_sync_jobs(assignment_id,group_code) where status in ('ready','claimed');

create function public.cardinal_assert_mozaik_source(p_job_id uuid,p_claim_hash text) returns public.school_mozaik_sync_jobs
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;a public.school_assignments;g public.school_mozaik_groups;l public.school_mozaik_links;
begin
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.id is null or j.status<>'claimed' or j.claim_hash is null or j.claim_hash is distinct from p_claim_hash or j.payload->>'protocolVersion' is distinct from '2' then raise exception 'invalid_claim';end if;
 select * into a from public.school_assignments where id=j.assignment_id for update;
 if a.id is null or (not j.reconcile_stale and a.revision::text is distinct from j.payload->>'sourceRevision')
 or a.group_codes is distinct from array[j.group_code] then raise exception 'stale_source_revision';end if;
 -- Only identities whose grades are in this frozen batch constrain its membership.
 -- Name edits and unrelated roster arrivals/departures do not change those identities.
 if jsonb_typeof(j.payload->'results') is distinct from 'array' or exists(
  select 1 from jsonb_array_elements(j.payload->'results') r where not exists(
   select 1 from public.school_students s where s.email=r->>'email' and s.active and s.group_code=j.group_code))
 then raise exception 'stale_roster_scope';end if;
 select * into g from public.school_mozaik_groups where group_code=j.group_code for share;
 if g.group_course_id::text is distinct from j.payload#>>'{group,groupCourseId}'
 or g.group_matter_id::text is distinct from j.payload#>>'{group,groupMatterId}'
 or g.establishment_id::text is distinct from j.payload#>>'{group,establishmentId}'
 or g.subject_code::text is distinct from j.payload#>>'{group,subjectCode}' then raise exception 'stale_group_scope';end if;
 select * into l from public.school_mozaik_links where assignment_id=j.assignment_id and group_code=j.group_code for update;
 if coalesce(j.payload#>>'{link,activityId}','')<>'' and
 l.activity_id::text is distinct from j.payload#>>'{link,activityId}' then raise exception 'stale_activity_link';end if;
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
 if j.checkpoint->>'activityId' is not null and l.activity_id is not null and l.activity_id::text<>j.checkpoint->>'activityId' then raise exception 'stale_activity_link';end if;
 return j;
end $$;

create function public.cardinal_checkpoint_mozaik_job(p_job_id uuid,p_claim_hash text,p_checkpoint jsonb) returns jsonb
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
 if j.checkpoint->'initial' is not null and (p_checkpoint->'initial' is distinct from j.checkpoint->'initial' or p_checkpoint->'target' is distinct from j.checkpoint->'target') then raise exception 'immutable_job_snapshot';end if;
 if v_rank>=3 then
  if jsonb_typeof(p_checkpoint#>'{initial,results,eleves}') is distinct from 'array'
  or jsonb_typeof(p_checkpoint#>'{target,results,eleves}') is distinct from 'array'
  or p_checkpoint#>>'{target,activity,parametresEvaluation,noteMaximale}' is distinct from j.payload#>>'{assignment,maxScore}'
  or p_checkpoint#>>'{target,activity,idGroupe}' is distinct from j.payload#>>'{group,groupMatterId}' then raise exception 'invalid_target_snapshot';end if;
 end if;
 if v_phase='verified' and (p_checkpoint->>'verifiedCount')::int is distinct from jsonb_array_length(j.payload->'results') then raise exception 'incomplete_verification';end if;
 update public.school_mozaik_sync_jobs set checkpoint=p_checkpoint where id=p_job_id;
 -- Persist newly created identity before subsequent parameter or result writes.
 if v_phase='created' then
  insert into public.school_mozaik_links(assignment_id,group_code,activity_id,sync_status,school_year,school_id,subject_id,mozaik_group_id)
  values(j.assignment_id,j.group_code,p_checkpoint->>'activityId','pending',j.payload#>>'{scope,schoolYear}',j.payload#>>'{scope,schoolId}',j.payload#>>'{scope,subjectId}',j.payload#>>'{scope,mozaikGroupId}')
  on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,sync_status='pending',school_year=excluded.school_year,school_id=excluded.school_id,subject_id=excluded.subject_id,mozaik_group_id=excluded.mozaik_group_id;
 end if;
 return p_checkpoint;
end $$;

create function public.cardinal_finish_mozaik_job(p_job_id uuid,p_claim_hash text,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;v_count int;
begin
 -- Idempotent acknowledgment is allowed only with the original claim and exact result.
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.status='completed' and j.claim_hash=p_claim_hash and (j.result-'staleSource')=p_result then return j.result;end if;
 j:=public.cardinal_assert_mozaik_source(p_job_id,p_claim_hash);
 if coalesce((p_result->>'success')::boolean,false) is false then
  -- Keep the frozen journal and claim available for an explicit resume.
  update public.school_mozaik_sync_jobs set result=p_result where id=p_job_id;
  return p_result;
 end if;
 v_count:=jsonb_array_length(j.payload->'results');
 if j.checkpoint->>'phase' is distinct from 'verified' or p_result->>'activityId' is distinct from j.checkpoint->>'activityId'
 or p_result->>'verified' is distinct from 'true' or (p_result->>'verifiedCount')::int is distinct from v_count
 or (p_result->>'syncedCount')::int is distinct from v_count then raise exception 'unverified_sync';end if;
 insert into public.school_mozaik_links(assignment_id,group_code,activity_id,competence_code,sync_status,last_synced_at,last_result_count,last_error,school_year,school_id,subject_id,mozaik_group_id)
 values(j.assignment_id,j.group_code,p_result->>'activityId',nullif(p_result->>'competenceCode',''),case when j.reconcile_stale then 'dirty' else 'synced' end,now(),v_count,null,j.payload#>>'{scope,schoolYear}',j.payload#>>'{scope,schoolId}',j.payload#>>'{scope,subjectId}',j.payload#>>'{scope,mozaikGroupId}')
 on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,competence_code=excluded.competence_code,sync_status=excluded.sync_status,last_synced_at=excluded.last_synced_at,last_result_count=v_count,last_error=null,school_year=excluded.school_year,school_id=excluded.school_id,subject_id=excluded.subject_id,mozaik_group_id=excluded.mozaik_group_id;
 update public.school_assignments set mozaik_sync_status=case when j.reconcile_stale then 'dirty' else 'synced' end,mozaik_external_id=p_result->>'activityId',mozaik_last_synced_at=now(),mozaik_competence_code=case when j.reconcile_stale then mozaik_competence_code else nullif(p_result->>'competenceCode','') end where id=j.assignment_id;
 if j.reconcile_stale then p_result:=p_result||jsonb_build_object('staleSource',true);end if;
 update public.school_mozaik_sync_jobs set status='completed',completed_at=now(),result=p_result where id=p_job_id;
 return p_result;
end $$;
create function public.cardinal_resume_mozaik_job(p_teacher text,p_job_id uuid,p_claim_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;
begin
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.id is null or j.status<>'claimed' or j.teacher_email<>p_teacher or
 not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_job_owner';end if;
 -- An explicit resume rotates the claim, invalidating the interrupted client.
 j:=public.cardinal_assert_mozaik_source(p_job_id,j.claim_hash);
 update public.school_mozaik_sync_jobs set claim_hash=p_claim_hash,claimed_at=now() where id=p_job_id;
 return jsonb_build_object('jobId',j.id,'payload',j.payload||jsonb_build_object('checkpoint',j.checkpoint,'reconcilingStale',j.reconcile_stale));
end $$;
create function public.cardinal_reconcile_mozaik_job(p_teacher text,p_job_id uuid,p_claim_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;
begin
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.id is null or j.status<>'claimed' or j.teacher_email<>p_teacher or
 not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_job_owner';end if;
 if j.checkpoint is null or (j.checkpoint->>'phase'='planned' and j.checkpoint->>'reviewConfirmed' is distinct from 'true') then
  -- Every native write requires a durable checkpoint first, so this claim can be cancelled safely.
  update public.school_mozaik_sync_jobs set status='expired',claim_hash=p_claim_hash,completed_at=now(),result='{"cancelled":true,"reason":"explicit_prewrite_recovery"}' where id=p_job_id;
  return jsonb_build_object('mode','cancelled','jobId',j.id);
 end if;
 if j.checkpoint->>'phase'='creating' or coalesce(j.checkpoint->>'activityId','')='' then raise exception 'uncertain_creation_manual_resolution';end if;
 -- Only this teacher-authorized path may reconcile the old frozen target after a source edit.
 -- The source/group identity, live roster, native mapping and activity link remain mandatory.
 update public.school_mozaik_sync_jobs set reconcile_stale=true where id=p_job_id;
 j:=public.cardinal_assert_mozaik_source(p_job_id,j.claim_hash);
 update public.school_mozaik_sync_jobs set claim_hash=p_claim_hash,claimed_at=now() where id=p_job_id;
 return jsonb_build_object('mode','reconcile','jobId',j.id,'payload',j.payload||jsonb_build_object('checkpoint',j.checkpoint,'reconcilingStale',true));
end $$;
revoke all on function public.cardinal_reconcile_mozaik_job(text,uuid,text) from public,anon,authenticated;
grant execute on function public.cardinal_reconcile_mozaik_job(text,uuid,text) to service_role;
revoke all on function public.cardinal_resume_mozaik_job(text,uuid,text) from public,anon,authenticated;
grant execute on function public.cardinal_resume_mozaik_job(text,uuid,text) to service_role;
revoke all on function public.cardinal_assert_mozaik_source(uuid,text) from public,anon,authenticated;
revoke all on function public.cardinal_checkpoint_mozaik_job(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.cardinal_finish_mozaik_job(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cardinal_assert_mozaik_source(uuid,text),public.cardinal_checkpoint_mozaik_job(uuid,text,jsonb),public.cardinal_finish_mozaik_job(uuid,text,jsonb) to service_role;
commit;
