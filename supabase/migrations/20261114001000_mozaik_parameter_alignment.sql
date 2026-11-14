-- Opt-in alignment v1; legacy jobs and non-alignment clients remain unchanged.
-- One transaction finalizes Gestion metadata, canonical grades, link and journal.
begin;
-- Resolve the immutable local target from the choices and observed native activity.
-- This function does not write anything. External notes never become the source of Gestion grades.
create or replace function public.cardinal_mozaik_alignment_plan(p_payload jsonb,p_checkpoint jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare a jsonb:=p_payload->'assignment';initial_e jsonb:=p_checkpoint#>'{initial,activity,parametresEvaluation}';
 target_e jsonb:=p_checkpoint#>'{target,activity,parametresEvaluation}';local_target jsonb:=p_checkpoint#>'{target,gestion}';
 source_max numeric;target_max numeric;target_weight numeric;bulletin boolean;raw jsonb;
 r jsonb;lr jsonb;nr jsonb;grade numeric;base_score numeric;base_max numeric;base_source text;converted numeric;
 output_rows jsonb:='[]'::jsonb;v_count integer;
begin
 if a->>'alignmentVersion' is distinct from '1' or a->>'weightSource' is null or a->>'weightSource' not in ('gestion','mozaik')
 or a->>'maximumSource' is null or a->>'maximumSource' not in ('gestion','mozaik') then raise exception 'invalid_alignment_protocol';end if;
 if jsonb_typeof(p_payload->'results') is distinct from 'array' or jsonb_typeof(local_target) is distinct from 'object'
 or jsonb_typeof(local_target->'results') is distinct from 'array' then raise exception 'missing_alignment_target';end if;
 if (a->>'maximumSource'='mozaik' or a->>'weightSource'='mozaik') and coalesce(p_payload#>>'{link,activityId}','')='' then raise exception 'alignment_requires_native_activity';end if;
 source_max:=(a->>'maxScore')::numeric;
 target_max:=case when a->>'maximumSource'='mozaik' then (initial_e->>'noteMaximale')::numeric else source_max end;
 if source_max is null or target_max is null or source_max<=0 or target_max<=0 or source_max>1000 or target_max>1000
 or source_max::text in ('NaN','Infinity','-Infinity') or target_max::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid_alignment_maximum';end if;
 raw:=case when a->>'weightSource'='mozaik' then initial_e->'porteeAuBulletin' else a->'reportCardEnabled' end;
 if jsonb_typeof(raw) is distinct from 'boolean' then raise exception 'invalid_alignment_bulletin';end if;
 bulletin:=(raw#>>'{}')::boolean;
 if bulletin then
  raw:=case when a->>'weightSource'='mozaik' then initial_e->'ponderation' else a->'weight' end;
  if jsonb_typeof(raw) is null or jsonb_typeof(raw) not in ('number','string') then raise exception 'invalid_alignment_weight';end if;
  target_weight:=(raw#>>'{}')::numeric;
  if target_weight is null or target_weight<0 or target_weight>100 or target_weight::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid_alignment_weight';end if;
 else target_weight:=null;end if;
 if (target_e->>'noteMaximale')::numeric is distinct from target_max
 or target_e->'porteeAuBulletin' is distinct from to_jsonb(bulletin)
 or (target_e->>'ponderation')::numeric is distinct from target_weight
 or (local_target->>'maxScore')::numeric is distinct from target_max
 or (local_target->>'weight')::numeric is distinct from target_weight
 or local_target->'reportCardEnabled' is distinct from to_jsonb(bulletin)
 then raise exception 'alignment_target_mismatch';end if;
 if p_checkpoint#>>'{initial,activity,idGroupe}' is distinct from p_payload#>>'{group,groupMatterId}' then raise exception 'alignment_group_mismatch';end if;
 v_count:=jsonb_array_length(p_payload->'results');
 if v_count<1 or jsonb_array_length(local_target->'results')<>v_count
 or (select count(distinct v->>'email') from jsonb_array_elements(local_target->'results') v)<>v_count
 or (select count(distinct v->>'fiche') from jsonb_array_elements(local_target->'results') v)<>v_count then raise exception 'invalid_alignment_members';end if;
 for r in select value from jsonb_array_elements(p_payload->'results') loop
  grade:=(r->>'grade')::numeric;
  if grade is null or grade<0 or grade>source_max or grade::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid_alignment_grade';end if;
  base_score:=(r->>'baseScore')::numeric;base_max:=(r->>'baseMax')::numeric;base_source:=nullif(r->>'baseSource','');
  if base_score is null or base_max is null or base_source is null or base_max<=0 or base_score<0 or base_score>base_max
   or base_score::text in ('NaN','Infinity','-Infinity') or base_max::text in ('NaN','Infinity','-Infinity')
   or round(base_score*source_max/base_max,1) is distinct from grade then
   base_score:=grade;base_max:=source_max;base_source:='gestion';
  end if;
  converted:=case when target_max=source_max then grade else round(base_score*target_max/base_max,1) end;
  if converted<0 or converted>target_max then raise exception 'alignment_grade_out_of_range';end if;
  select value into lr from jsonb_array_elements(local_target->'results') where value->>'email'=r->>'email';
  if lr is null or (lr->>'grade')::numeric is distinct from converted or coalesce(lr->>'fiche','')!~'^\d+$' then raise exception 'alignment_grade_mismatch';end if;
  if (select count(*) from jsonb_array_elements(p_checkpoint#>'{target,results,eleves}') v where v->>'fiche'=lr->>'fiche')<>1 then raise exception 'alignment_native_member_mismatch';end if;
  select value into nr from jsonb_array_elements(p_checkpoint#>'{target,results,eleves}') where value->>'fiche'=lr->>'fiche';
  if replace(nr->>'resultat',',','.')::numeric is distinct from converted then raise exception 'alignment_native_grade_mismatch';end if;
  output_rows:=output_rows||jsonb_build_array(jsonb_build_object('email',r->>'email','grade',converted,'baseScore',base_score,'baseMax',base_max,'baseSource',base_source));
 end loop;
 return jsonb_build_object('maxScore',target_max,'weight',target_weight,'reportCardEnabled',bulletin,'results',output_rows);
exception when invalid_text_representation or division_by_zero or numeric_value_out_of_range then raise exception 'invalid_alignment_value';
end $$;
revoke all on function public.cardinal_mozaik_alignment_plan(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.cardinal_mozaik_alignment_plan(jsonb,jsonb) to service_role;

-- Detect mixed snapshots during prepare, even when an edit raced the initial reads.
create or replace function public.cardinal_assert_alignment_source(p_job public.school_mozaik_sync_jobs) returns void
language plpgsql security definer set search_path='' as $$
declare a public.school_assignments;
begin
 if p_job.reconcile_stale then return;end if;
 select * into a from public.school_assignments where id=p_job.assignment_id for update;
 if a.max_score is distinct from (p_job.payload#>>'{assignment,maxScore}')::numeric
 or a.weight is distinct from (p_job.payload#>>'{assignment,weight}')::numeric
 or a.report_card_enabled is distinct from (p_job.payload#>>'{assignment,reportCardEnabled}')::boolean
 or (select count(*) from public.school_results where assignment_id=a.id and grade is not null)<>jsonb_array_length(p_job.payload->'results')
 or exists(select 1 from jsonb_array_elements(p_job.payload->'results') r where not exists(
  select 1 from public.school_results s where s.assignment_id=a.id and s.student_email=r->>'email'
  and s.grade is not distinct from (r->>'grade')::numeric
  and s.base_score is not distinct from (r->>'baseScore')::numeric
  and s.base_max is not distinct from (r->>'baseMax')::numeric
  and s.base_source is not distinct from (r->>'baseSource')
 )) then raise exception 'alignment_source_snapshot_changed';end if;
end $$;
revoke all on function public.cardinal_assert_alignment_source(public.school_mozaik_sync_jobs) from public,anon,authenticated;
grant execute on function public.cardinal_assert_alignment_source(public.school_mozaik_sync_jobs) to service_role;
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
  or (j.payload#>'{assignment,alignmentVersion}' is null and p_checkpoint#>>'{target,activity,parametresEvaluation,noteMaximale}' is distinct from j.payload#>>'{assignment,maxScore}')
  or p_checkpoint#>>'{target,activity,idGroupe}' is distinct from j.payload#>>'{group,groupMatterId}' then raise exception 'invalid_target_snapshot';end if;
  if j.payload#>'{assignment,alignmentVersion}' is not null then
   perform public.cardinal_assert_alignment_source(j);
   perform public.cardinal_mozaik_alignment_plan(j.payload,p_checkpoint);
  end if;
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

create or replace function public.cardinal_finish_mozaik_job(p_job_id uuid,p_claim_hash text,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;v_count int;v_plan jsonb;v_stale boolean;v_alignment boolean;
begin
 -- Idempotent acknowledgment is allowed only with the original claim and exact result.
 select * into j from public.school_mozaik_sync_jobs where id=p_job_id for update;
 if j.status='completed' and j.claim_hash=p_claim_hash and (j.result-array['staleSource','alignmentApplied','alignment'])=p_result then return j.result;end if;
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
 v_stale:=j.reconcile_stale;
 v_alignment:=j.payload#>'{assignment,alignmentVersion}' is not null;
 if v_alignment then
  if j.checkpoint->>'reviewConfirmed' is distinct from 'true' then raise exception 'alignment_not_confirmed';end if;
  v_plan:=public.cardinal_mozaik_alignment_plan(j.payload,j.checkpoint);
  -- A reconciled stale batch may finish natively, but it must never overwrite
  -- more recent Gestion edits. The link remains dirty for a new preview.
  select a.revision::text is distinct from j.payload->>'sourceRevision' into v_stale
   from public.school_assignments a where a.id=j.assignment_id for update;
  if not v_stale then
   perform public.cardinal_assert_alignment_source(j);
   if (v_plan->>'maxScore')::numeric is distinct from (j.payload#>>'{assignment,maxScore}')::numeric then
    update public.school_results s set grade=(r->>'grade')::numeric,
     base_score=(r->>'baseScore')::numeric,base_max=(r->>'baseMax')::numeric,base_source=r->>'baseSource',updated_at=clock_timestamp()
    from jsonb_array_elements(v_plan->'results') r
    where s.assignment_id=j.assignment_id and s.student_email=r->>'email';
   end if;
   update public.school_assignments set max_score=(v_plan->>'maxScore')::numeric,
    weight=(v_plan->>'weight')::numeric,report_card_enabled=(v_plan->>'reportCardEnabled')::boolean,
    source_metadata=coalesce(source_metadata,'{}'::jsonb)||jsonb_build_object('mozaikAlignment',jsonb_build_object(
      'version',1,'jobId',j.id,'weightSource',j.payload#>>'{assignment,weightSource}',
      'maximumSource',j.payload#>>'{assignment,maximumSource}','maxScore',v_plan->'maxScore',
      'weight',v_plan->'weight','reportCardEnabled',v_plan->'reportCardEnabled'))
    where id=j.assignment_id;
   p_result:=p_result||jsonb_build_object('alignmentApplied',true,'alignment',v_plan-'results');
  else p_result:=p_result||jsonb_build_object('alignmentApplied',false);end if;
 end if;
 insert into public.school_mozaik_links(assignment_id,group_code,activity_id,competence_code,sync_status,last_synced_at,last_result_count,last_error,school_year,school_id,subject_id,mozaik_group_id)
 values(j.assignment_id,j.group_code,p_result->>'activityId',nullif(p_result->>'competenceCode',''),case when v_stale then 'dirty' else 'synced' end,now(),v_count,null,j.payload#>>'{scope,schoolYear}',j.payload#>>'{scope,schoolId}',j.payload#>>'{scope,subjectId}',j.payload#>>'{scope,mozaikGroupId}')
 on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,competence_code=excluded.competence_code,sync_status=excluded.sync_status,last_synced_at=excluded.last_synced_at,last_result_count=v_count,last_error=null,school_year=excluded.school_year,school_id=excluded.school_id,subject_id=excluded.subject_id,mozaik_group_id=excluded.mozaik_group_id;
 update public.school_assignments set mozaik_sync_status=case when v_stale then 'dirty' else 'synced' end,mozaik_external_id=p_result->>'activityId',mozaik_last_synced_at=now(),mozaik_competence_code=case when v_stale then mozaik_competence_code else nullif(p_result->>'competenceCode','') end where id=j.assignment_id;
 if v_stale then p_result:=p_result||jsonb_build_object('staleSource',true);end if;
 update public.school_mozaik_sync_jobs set status='completed',completed_at=now(),result=p_result where id=p_job_id;
 return p_result;
end $$;

revoke all on function public.cardinal_checkpoint_mozaik_job(uuid,text,jsonb),public.cardinal_finish_mozaik_job(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cardinal_checkpoint_mozaik_job(uuid,text,jsonb),public.cardinal_finish_mozaik_job(uuid,text,jsonb) to service_role;
commit;
