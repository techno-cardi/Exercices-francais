-- Prepared offline; builds on 20261026180000_gestion_imports.sql.
-- Historical links keep NULL scope until verified against the remote activity.
begin;
alter table public.school_mozaik_links
 add column school_year text,add column school_id text,add column subject_id text,
 add column mozaik_group_id text,add column planning_id text;
create unique index school_mozaik_links_exact_scope on public.school_mozaik_links
 (school_year,school_id,subject_id,mozaik_group_id,activity_id)
 where school_year is not null and school_id is not null and subject_id is not null and mozaik_group_id is not null;

create function public.cardinal_confirm_mozaik_metadata_batch(p_teacher text,p_preview_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v_op public.school_assignment_operations;v_item jsonb;v_link jsonb;v_child uuid;v_one jsonb;
 v_rows jsonb:='[]';v_result jsonb;v_id uuid;v_group text;
begin
 select * into v_op from public.school_assignment_operations where id=p_preview_id for update;
 if not found then raise exception 'operation_not_found';end if;
 if v_op.teacher_email<>p_teacher then raise exception 'operation_teacher_mismatch';end if;
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if v_op.kind<>'mozaik_metadata' then raise exception 'invalid_operation_kind';end if;
 if v_op.status='confirmed' then return v_op.result;end if;
 if v_op.expires_at<=clock_timestamp() then raise exception 'preview_expired';end if;
 if jsonb_typeof(v_op.plan->'items') is distinct from 'array' or jsonb_array_length(v_op.plan->'items') not between 1 and 1000 then raise exception 'invalid_metadata_batch';end if;
 -- Serialize metadata imports, including distinct preview IDs for the same remote
 -- activity. The exact scoped unique index also protects against other writers.
 perform pg_advisory_xact_lock(26026200000::bigint);
 for v_item in select value from jsonb_array_elements(v_op.plan->'items') loop
  if v_item->'writes' is distinct from '[]'::jsonb or v_item ? 'sourceLink' then raise exception 'metadata_grade_write_forbidden';end if;
  v_link:=v_item->'mozaikLink';v_group:=v_item->>'groupCode';v_id:=(v_item->>'assignmentId')::uuid;
  if v_group is null or v_link->>'group_code' is distinct from v_group or
   exists(select 1 from unnest(array['school_year','school_id','subject_id','mozaik_group_id','activity_id']) k where coalesce(btrim(v_link->>k),'')='')
   then raise exception 'invalid_mozaik_scope';end if;
  if exists(select 1 from public.school_mozaik_links l where
    (v_id is not null and l.assignment_id=v_id and l.group_code=v_group) or
    (l.activity_id=v_link->>'activity_id' and l.group_code=v_group and (l.school_year is null or l.school_id is null or l.subject_id is null or l.mozaik_group_id is null)) or
    (l.activity_id=v_link->>'activity_id' and l.school_year=v_link->>'school_year' and l.school_id=v_link->>'school_id' and l.subject_id=v_link->>'subject_id' and l.mozaik_group_id=v_link->>'mozaik_group_id'))
   then raise exception 'mozaik_link_conflict';end if;
  -- Metadata association may annotate provenance; it cannot replace existing
  -- settings, grades, visibility or a Formative association.
  if v_id is not null and exists(select 1 from jsonb_object_keys(coalesce(v_item->'assignmentPatch','{}')) k where k<>'source_metadata') then raise exception 'metadata_settings_write_forbidden';end if;
  if v_id is null and coalesce((v_item->'newAssignment'->>'published')::boolean,true) then raise exception 'metadata_published_forbidden';end if;
  v_child:=gen_random_uuid();
  insert into public.school_assignment_operations(id,teacher_email,kind,request,plan,expires_at)
   values(v_child,p_teacher,'mozaik_metadata',jsonb_build_object('batchId',p_preview_id),v_item,v_op.expires_at);
  v_one:=public.cardinal_confirm_assignment_operation(p_teacher,v_child);
  v_id:=(v_one->>'assignmentId')::uuid;
  update public.school_mozaik_links set school_year=v_link->>'school_year',school_id=v_link->>'school_id',subject_id=v_link->>'subject_id',mozaik_group_id=v_link->>'mozaik_group_id',planning_id=v_link->>'planning_id'
   where assignment_id=v_id and group_code=v_group;
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('assignmentId',v_id,'groupCode',v_group,'activityId',v_link->>'activity_id','metadataOnly',true));
 end loop;
 v_result:=jsonb_build_object('assignments',v_rows,'importedCount',0,'metadataCount',jsonb_array_length(v_rows),'operationId',p_preview_id);
 update public.school_assignment_operations set status='confirmed',result=v_result,confirmed_at=clock_timestamp() where id=p_preview_id;
 return v_result;
end $$;
revoke all on function public.cardinal_confirm_mozaik_metadata_batch(text,uuid) from public,anon,authenticated;
grant execute on function public.cardinal_confirm_mozaik_metadata_batch(text,uuid) to service_role;
commit;

