-- A newly created activity is linked but its grades are not synchronized yet.
-- Use the existing dirty status accepted by the production constraint.
begin;
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
  values(j.assignment_id,j.group_code,p_checkpoint->>'activityId','dirty',j.payload#>>'{scope,schoolYear}',j.payload#>>'{scope,schoolId}',j.payload#>>'{scope,subjectId}',j.payload#>>'{scope,mozaikGroupId}')
  on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,sync_status='dirty',school_year=excluded.school_year,school_id=excluded.school_id,subject_id=excluded.subject_id,mozaik_group_id=excluded.mozaik_group_id;
 end if;
 return p_checkpoint;
end $$;


commit;
