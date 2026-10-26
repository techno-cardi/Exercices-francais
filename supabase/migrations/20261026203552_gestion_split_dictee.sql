-- Preserve dictation feedback, private copy access and progress when splitting.
-- Existing archived slugs remain resolvable through school_assignment_splits.
begin;
do $$begin
 if to_regclass('public.fr_dictee_feedback') is not null then
  execute 'create trigger cardinal_split_write_guard before insert or update or delete on public.fr_dictee_feedback for each row execute function public.cardinal_split_write_guard()';
 end if;
end $$;
create or replace function public.cardinal_preview_assignment_split(p_teacher text,p_assignment_id uuid,p_result_groups jsonb default '{}',p_formative_group text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v_a public.school_assignments;v_snapshot jsonb;v_id uuid:=gen_random_uuid();v_groups text[];v_r jsonb;v_mapping jsonb:='{}';v_group text;v_unresolved jsonb:='[]';v_blockers jsonb:='[]';v_dep record;v_rows jsonb;v_preview jsonb;v_counts jsonb:='[]';v_g text;
begin
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 select * into v_a from public.school_assignments where id=p_assignment_id;
 if not found then raise exception 'assignment_not_found';end if;
 if v_a.split_archived or cardinality(v_a.group_codes)<2 then raise exception 'split_requires_shared_assignment';end if;
 select array_agg(distinct x order by x) into v_groups from unnest(v_a.group_codes) x;
 if cardinality(v_groups)<2 or array_position(v_groups,null) is not null then raise exception 'invalid_groups';end if;
 if jsonb_typeof(p_result_groups) is distinct from 'object' then raise exception 'invalid_result_groups';end if;
 v_snapshot:=public.cardinal_split_snapshot(p_assignment_id);
 if exists(select 1 from jsonb_object_keys(p_result_groups) e where not exists(
 select 1 from jsonb_array_elements((v_snapshot->'results')||(coalesce(v_snapshot#>'{dependencies,public.school_formative_feedbacks.assignment_id}','[]'::jsonb)||coalesce(v_snapshot#>'{dependencies,public.fr_dictee_feedback.assignment_id}','[]'::jsonb))) r where r.value->>'student_email'=e)) then raise exception 'split_unknown_result_mapping';end if;
 -- Feedback-only students need the same explicit historical attribution as grades.
 -- A reliable result_group_code governs all feedback for that student.
 for v_r in
  select value from jsonb_array_elements(v_snapshot->'results')
  union all
  select jsonb_build_object('student_email',f.value->>'student_email')
  from jsonb_array_elements((coalesce(v_snapshot#>'{dependencies,public.school_formative_feedbacks.assignment_id}','[]'::jsonb)||coalesce(v_snapshot#>'{dependencies,public.fr_dictee_feedback.assignment_id}','[]'::jsonb))) f
  where not exists(select 1 from jsonb_array_elements(v_snapshot->'results') r where r.value->>'student_email'=f.value->>'student_email')
  group by f.value->>'student_email'
 loop
  v_group:=nullif(v_r->>'result_group_code','');
  if v_group is not null and not(v_group=any(v_groups)) then v_blockers:=v_blockers||jsonb_build_array('invalid_historical_group:'||(v_r->>'student_email'));end if;
  if v_group is not null and p_result_groups ? (v_r->>'student_email') and v_group is distinct from p_result_groups->>(v_r->>'student_email') then raise exception 'split_historical_group_conflict';end if;
  v_group:=coalesce(v_group,p_result_groups->>(v_r->>'student_email'));
  if v_group is null then v_unresolved:=v_unresolved||jsonb_build_array(v_r->>'student_email');
  elsif not(v_group=any(v_groups)) then raise exception 'split_invalid_result_group';
  else v_mapping:=v_mapping||jsonb_build_object(v_r->>'student_email',v_group);end if;
 end loop;
 for v_r in select value from jsonb_array_elements(v_snapshot->'links') loop
  if not coalesce((v_r->>'group_code')=any(v_groups),false) then v_blockers:=v_blockers||jsonb_build_array('unresolved_link_group');end if;
 end loop;
 if v_a.mozaik_external_id is not null and not exists(select 1 from public.school_mozaik_links where assignment_id=p_assignment_id and activity_id=v_a.mozaik_external_id and group_code=any(v_groups)) then v_blockers:=v_blockers||jsonb_build_array('unresolved_legacy_mozaik_link');end if;
 if v_a.formative_id is not null and not coalesce(p_formative_group=any(v_groups),false) then v_blockers:=v_blockers||jsonb_build_array('unresolved_formative_group');end if;
 if p_formative_group is not null and not(p_formative_group=any(v_groups)) then raise exception 'split_invalid_formative_group';end if;
 for v_dep in select key,value from jsonb_each(v_snapshot->'dependencies') loop
  if v_dep.key in ('public.school_formative_feedbacks.assignment_id','public.fr_dictee_feedback.assignment_id') then
   continue; -- Known full-row dependency: included in snapshot, attribution and atomic move.
  elsif v_dep.key='public.school_mozaik_sync_jobs.assignment_id' then
   if exists(select 1 from jsonb_array_elements(v_dep.value) j where coalesce(j->>'status','') not in ('completed','expired','cancelled')) then v_blockers:=v_blockers||jsonb_build_array('split_active_sync_job');end if;
  elsif jsonb_array_length(v_dep.value)>0 then v_blockers:=v_blockers||jsonb_build_array('split_unhandled_dependency:'||v_dep.key);end if;
 end loop;
 foreach v_g in array v_groups loop
  v_counts:=v_counts||jsonb_build_array(jsonb_build_object('groupCode',v_g,'resultCount',(select count(*) from jsonb_array_elements(v_snapshot->'results') r where v_mapping->>(r.value->>'student_email')=v_g),
   'feedbackCount',(select count(*) from jsonb_array_elements((coalesce(v_snapshot#>'{dependencies,public.school_formative_feedbacks.assignment_id}','[]'::jsonb)||coalesce(v_snapshot#>'{dependencies,public.fr_dictee_feedback.assignment_id}','[]'::jsonb))) f where v_mapping->>(f.value->>'student_email')=v_g),'linkCount',(select count(*) from public.school_mozaik_links where assignment_id=p_assignment_id and group_code=v_g)));
 end loop;
 v_preview:=jsonb_build_object('assignmentId',p_assignment_id,'groups',v_counts,'unresolvedEmails',v_unresolved,'blockers',v_blockers,'canConfirm',jsonb_array_length(v_unresolved)=0 and jsonb_array_length(v_blockers)=0);
 insert into public.school_assignment_operations(id,teacher_email,kind,request,plan,expires_at)
 values(v_id,p_teacher,'historical_split',jsonb_build_object('assignmentId',p_assignment_id,'resultGroups',p_result_groups,'formativeGroup',p_formative_group),jsonb_build_object('assignmentId',p_assignment_id,'beforeSnapshot',v_snapshot,'resultGroups',v_mapping,'formativeGroup',p_formative_group,'preview',v_preview),now()+interval '15 minutes');
 return jsonb_build_object('previewId',v_id,'expiresAt',now()+interval '15 minutes','preview',v_preview);
end $$;

create or replace function public.cardinal_confirm_assignment_split(p_teacher text,p_preview_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_op public.school_assignment_operations;v_id uuid;v_snapshot jsonb;v_a public.school_assignments;v_new uuid;v_group text;v_row jsonb;v_copy jsonb;v_result jsonb:='[]';v_dep record;v_col text;v_cols text;v_select text;v_link jsonb;
begin
 -- Rare, teacher-confirmed maintenance operation: freeze all inspected relations.
 -- Table locks also cover inserts that row locks cannot protect against.
 lock table public.school_assignments,public.school_results,public.school_mozaik_links,public.school_assignment_operations in share row exclusive mode;
 for v_dep in select distinct n.nspname ns,c.relname tbl from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 where c.relkind in ('r','p') and ((n.nspname='public' and a.attname='assignment_id') or exists(select 1 from pg_catalog.pg_constraint k where k.contype='f' and k.conrelid=c.oid and a.attnum=any(k.conkey) and k.confrelid='public.school_assignments'::regclass)) order by 1,2
 loop execute format('lock table %I.%I in share row exclusive mode',v_dep.ns,v_dep.tbl);end loop;
 select * into v_op from public.school_assignment_operations where id=p_preview_id for update;
 if not found then raise exception 'operation_not_found';end if;
 if v_op.teacher_email<>p_teacher then raise exception 'operation_teacher_mismatch';end if;
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if v_op.kind<>'historical_split' then raise exception 'invalid_operation_kind';end if;
 if v_op.status='confirmed' then return v_op.result;end if;
 if v_op.expires_at<=clock_timestamp() then raise exception 'preview_expired';end if;
 if jsonb_array_length(v_op.plan->'preview'->'unresolvedEmails')>0 then raise exception 'split_unresolved_results';end if;
 if jsonb_array_length(v_op.plan->'preview'->'blockers')>0 then raise exception '%',v_op.plan->'preview'->'blockers'->>0;end if;
 v_id:=(v_op.plan->>'assignmentId')::uuid;
 v_snapshot:=public.cardinal_split_snapshot(v_id);
 if v_snapshot is distinct from v_op.plan->'beforeSnapshot' then raise exception 'stale_preview';end if;
 select * into v_a from public.school_assignments where id=v_id for update;
 if v_a.split_archived or cardinality(v_a.group_codes)<2 then raise exception 'split_requires_shared_assignment';end if;
 -- Release exact scoped link uniqueness before reinserting the frozen rows.
 -- Any later error rolls this deletion back with the rest of the split.
 delete from public.school_mozaik_links where assignment_id=v_id;
 foreach v_group in array v_a.group_codes loop
  v_new:=gen_random_uuid();
  -- Clone full actual rows so instructions, documents, timestamps and future fields
  -- are not dropped by a hand-maintained assignment field allowlist.
  v_copy:=to_jsonb(v_a)||jsonb_build_object('id',v_new,'slug',case when v_a.slug is null then null else left(v_a.slug,100)||'-g'||v_group end,'group_codes',jsonb_build_array(v_group),'revision',0,'mozaik_external_id',null,'mozaik_sync_status','not_synced','mozaik_last_synced_at',null);
  if v_a.formative_id is not null and v_group is distinct from v_op.plan->>'formativeGroup' then
   v_copy:=v_copy||jsonb_build_object('formative_id',null,'formative_assignment_id',null,'formative_section_id',null,'formative_title',null,'formative_last_synced_at',null);
  end if;
  insert into public.school_assignments select (jsonb_populate_record(null::public.school_assignments,v_copy)).*;
  for v_row in select value from jsonb_array_elements(v_snapshot->'results') r where v_op.plan->'resultGroups'->>(r.value->>'student_email')=v_group loop
   insert into public.school_results select (jsonb_populate_record(null::public.school_results,v_row||jsonb_build_object('assignment_id',v_new,'result_group_code',v_group))).*;
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(v_snapshot#>'{dependencies,public.school_formative_feedbacks.assignment_id}','[]'::jsonb)) f where v_op.plan->'resultGroups'->>(f.value->>'student_email')=v_group loop
   execute 'insert into public.school_formative_feedbacks select (jsonb_populate_record(null::public.school_formative_feedbacks,$1)).*' using v_row||jsonb_build_object('assignment_id',v_new);
  end loop;
  for v_row in select value from jsonb_array_elements(coalesce(v_snapshot#>'{dependencies,public.fr_dictee_feedback.assignment_id}','[]'::jsonb)) f where v_op.plan->'resultGroups'->>(f.value->>'student_email')=v_group loop
   execute 'insert into public.fr_dictee_feedback select (jsonb_populate_record(null::public.fr_dictee_feedback,$1)).*' using v_row||jsonb_build_object('assignment_id',v_new);
  end loop;
  for v_link in select value from jsonb_array_elements(v_snapshot->'links') r where r.value->>'group_code'=v_group loop
   insert into public.school_mozaik_links select (jsonb_populate_record(null::public.school_mozaik_links,v_link||jsonb_build_object('assignment_id',v_new))).*;
   update public.school_assignments set mozaik_external_id=v_link->>'activity_id',mozaik_sync_status=v_link->>'sync_status',mozaik_last_synced_at=(v_link->>'last_synced_at')::timestamptz where id=v_new;
  end loop;
  insert into public.school_assignment_splits(old_assignment_id,group_code,assignment_id,operation_id,before_snapshot) values(v_id,v_group,v_new,p_preview_id,v_snapshot);
  v_result:=v_result||jsonb_build_array(jsonb_build_object('id',v_new,'groupCode',v_group));
 end loop;
 -- Results and links move once; their full prior rows remain in the audit snapshot.
 if v_snapshot->'dependencies' ? 'public.school_formative_feedbacks.assignment_id' then
  execute 'delete from public.school_formative_feedbacks where assignment_id=$1' using v_id;
 end if;
 if v_snapshot->'dependencies' ? 'public.fr_dictee_feedback.assignment_id' then
  execute 'delete from public.fr_dictee_feedback where assignment_id=$1' using v_id;
 end if;
 delete from public.school_results where assignment_id=v_id;
 update public.school_assignments set split_archived=true,group_codes='{}',published=false where id=v_id;
 v_row:=jsonb_build_object('oldAssignmentId',v_id,'assignments',v_result,'operationId',p_preview_id);
 update public.school_assignment_operations set status='confirmed',result=v_row,confirmed_at=clock_timestamp() where id=p_preview_id;
 return v_row;
end $$;

revoke all on function public.cardinal_preview_assignment_split(text,uuid,jsonb,text),public.cardinal_confirm_assignment_split(text,uuid) from public,anon,authenticated;
grant execute on function public.cardinal_preview_assignment_split(text,uuid,jsonb,text),public.cardinal_confirm_assignment_split(text,uuid) to service_role;
commit;
