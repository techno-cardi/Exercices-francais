-- Prepared offline. No historical assignment splitting or grade rewriting.
begin;
alter table public.school_assignments
 add column revision bigint not null default 0,
 add column formative_scale_mode text not null default 'origin' check (formative_scale_mode in ('origin','hundred')),
 add column import_state text not null default 'ready' check (import_state in ('ready','metadata_only')),
 add column source_metadata jsonb not null default '{}',
 alter column max_score drop not null;
alter table public.school_assignments add constraint school_assignments_import_max
 check ((import_state='metadata_only' and max_score is null) or (max_score is not null and max_score>0 and max_score::text not in ('NaN','Infinity','-Infinity'))) not valid;
alter table public.school_results add column base_score numeric,add column base_max numeric,
 add column base_source text,add column result_group_code text;
-- Legacy rows retain null canonical bases until a reliable preview establishes them.
alter table public.school_results add constraint school_results_canonical_base
 check ((base_score is null and base_max is null and base_source is null) or
 (base_score is not null and base_max is not null and base_max>0 and base_score>=0 and base_score<=base_max and base_source is not null
 and base_score::text not in ('NaN','Infinity','-Infinity') and base_max::text not in ('NaN','Infinity','-Infinity'))) not valid;

create table public.school_assignment_operations(
 id uuid primary key default gen_random_uuid(),teacher_email text not null,kind text not null,
 request jsonb not null default '{}',plan jsonb not null default '{}',
 status text not null default 'preview' check(status in ('preview','confirmed')),
 expires_at timestamptz not null default (now()+interval '30 minutes'),
 result jsonb,created_at timestamptz not null default now(),confirmed_at timestamptz);
alter table public.school_assignment_operations enable row level security;
revoke all on public.school_assignment_operations from public,anon,authenticated;
grant all on public.school_assignment_operations to service_role;
create index school_assignment_operations_expiry on public.school_assignment_operations(expires_at) where status='preview';

create function public.cardinal_assignment_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin new.revision:=old.revision+1;new.updated_at:=clock_timestamp();return new;end $$;
create trigger cardinal_assignment_revision before update on public.school_assignments for each row execute function public.cardinal_assignment_revision();
create function public.cardinal_result_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.assignment_id<>old.assignment_id or new.student_email<>old.student_email) then raise exception 'result_identity_immutable';end if;
 -- Parent row lock serializes all legacy result paths with confirmation. Cascaded deletes need no parent.
 update public.school_assignments set updated_at=clock_timestamp() where id=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
create trigger cardinal_result_revision before insert or update or delete on public.school_results for each row execute function public.cardinal_result_revision();

create function public.cardinal_assignment_snapshot(p_assignment_id uuid) returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assignment',to_jsonb(a),'results',coalesce((select jsonb_agg(to_jsonb(r) order by r.student_email) from public.school_results r where r.assignment_id=a.id),'[]'::jsonb))
 from public.school_assignments a where a.id=p_assignment_id
$$;

-- Only identifiers from this fixed allowlist enter dynamic SQL. JSON values remain bound parameters.
create function public.cardinal_write_assignment(p_id uuid,p_patch jsonb,p_group text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id;v_keys text[];v_cols text;v_select text;
 v_allowed constant text[]:=array['title','competencies','weight','max_score','published','instructions','subject','term','activity_date','activity_type','report_card_enabled','mozaik_results_visible','mozaik_show_in_schedule','mozaik_homework','mozaik_period','mozaik_competence_code','mozaik_competence_kind','formative_scale_mode','import_state','source_metadata','formative_id','formative_assignment_id','formative_section_id','formative_title','formative_question_ids','formative_question_meta','formative_last_synced_at'];
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'invalid_assignment_patch';end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(v_allowed))) then raise exception 'unknown_assignment_field';end if;
 if v_id is null then
  if coalesce(p_patch->>'import_state','ready')='ready' and (p_patch->>'max_score') is null then raise exception 'missing_assignment_max';end if;
  insert into public.school_assignments(title,group_codes,max_score,import_state)
   values(p_patch->>'title',array[p_group],case when p_patch->>'import_state'='metadata_only' then null else coalesce((p_patch->>'max_score')::numeric,10) end,coalesce(p_patch->>'import_state','ready')) returning id into v_id;
 end if;
 select array_agg(k order by k) into v_keys from jsonb_object_keys(p_patch) k;
 if cardinality(v_keys)>0 then
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into v_cols,v_select from unnest(v_keys) k;
  execute format('update public.school_assignments set (%s)=(select %s from jsonb_populate_record(null::public.school_assignments,$1) r) where id=$2',v_cols,v_select) using p_patch,v_id;
 end if;
 return v_id;
end $$;

create function public.cardinal_create_assignment_batch(p_teacher text,p_operation_id uuid,p_assignment jsonb,p_groups text[]) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v_op public.school_assignment_operations;v_payload jsonb;v_patch jsonb;v_groups text[];v_group text;v_id uuid;v_rows jsonb:='[]';v_result jsonb;
begin
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 select array_agg(g order by g) into v_groups from (select distinct unnest(p_groups) g) x;
 if coalesce(cardinality(v_groups),0)=0 or exists(select 1 from unnest(v_groups) g where g is null or not exists(select 1 from public.school_students s where s.group_code=g and s.active)) then raise exception 'invalid_groups';end if;
 v_patch:=p_assignment-array['id','updated_at','group_codes'];
 if exists(select 1 from jsonb_object_keys(v_patch) k where k like 'formative_%' and k<>'formative_scale_mode') then raise exception 'batch_external_link_forbidden';end if;
 v_payload:=jsonb_build_object('assignment',v_patch,'groups',to_jsonb(v_groups));
 insert into public.school_assignment_operations(id,teacher_email,kind,request) values(p_operation_id,p_teacher,'assignment_batch',v_payload) on conflict(id) do nothing;
 select * into v_op from public.school_assignment_operations where id=p_operation_id for update;
 if v_op.teacher_email<>p_teacher then raise exception 'operation_teacher_mismatch';end if;
 if v_op.kind<>'assignment_batch' or v_op.request<>v_payload then raise exception 'operation_payload_conflict';end if;
 if v_op.status='confirmed' then return v_op.result;end if;
 foreach v_group in array v_groups loop
  v_id:=public.cardinal_write_assignment(null,v_patch,v_group);
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('id',v_id,'groupCode',v_group));
 end loop;
 v_result:=jsonb_build_object('id',v_rows->0->>'id','assignments',v_rows,'operationId',p_operation_id);
 update public.school_assignment_operations set status='confirmed',result=v_result,confirmed_at=clock_timestamp() where id=p_operation_id;
 return v_result;
end $$;

create function public.cardinal_confirm_assignment_operation(p_teacher text,p_preview_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v_op public.school_assignment_operations;v_plan jsonb;v_id uuid;v_group text;v_a public.school_assignments;v_write jsonb;v_patch jsonb;v_result jsonb;v_count integer:=0;v_grade numeric;v_base numeric;v_max numeric;
begin
 select * into v_op from public.school_assignment_operations where id=p_preview_id for update;
 if not found then raise exception 'operation_not_found';end if;
 if v_op.teacher_email<>p_teacher then raise exception 'operation_teacher_mismatch';end if;
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if v_op.status='confirmed' then return v_op.result;end if;
 if v_op.kind not in ('formative_import','settings_import','mozaik_metadata') then raise exception 'invalid_operation_kind';end if;
 if v_op.expires_at<=clock_timestamp() then raise exception 'preview_expired';end if;
 v_plan:=v_op.plan;v_id:=(v_plan->>'assignmentId')::uuid;v_group:=v_plan->>'groupCode';
 if v_group is null or (v_id is null and not exists(select 1 from public.school_students where group_code=v_group and active)) then raise exception 'invalid_groups';end if;
 if v_id is not null then
  select * into v_a from public.school_assignments where id=v_id for update;
  if not found then raise exception 'assignment_not_found';end if;
  if v_a.group_codes is distinct from array[v_group] then raise exception 'assignment_requires_single_group';end if;
  perform 1 from public.school_results where assignment_id=v_id order by student_email for update;
  if v_plan->'beforeSnapshot' is distinct from public.cardinal_assignment_snapshot(v_id) then raise exception 'stale_preview';end if;
 elsif v_plan->'beforeSnapshot' is distinct from 'null'::jsonb and v_plan ? 'beforeSnapshot' then raise exception 'invalid_new_snapshot';end if;
 if jsonb_typeof(v_plan->'writes') is distinct from 'array' then raise exception 'invalid_writes';end if;
 if exists(select 1 from jsonb_array_elements(v_plan->'writes') w group by w->>'email' having count(*)>1) then raise exception 'duplicate_result_student';end if;
 -- Historical rows retain assignment membership after a roster move or deactivation.
 -- Incoming replacements and newly introduced rows require current membership.
 for v_write in select value from jsonb_array_elements(v_plan->'writes') loop
  if not coalesce((v_write->>'requiresCurrentMembership')::boolean,false) and v_id is not null and exists(select 1 from public.school_results where assignment_id=v_id and student_email=v_write->>'email') then continue;end if;
  perform 1 from public.school_students where email=v_write->>'email' and group_code=v_group and active for share;
  if not found then raise exception 'invalid_result_student';end if;
 end loop;
 v_patch:=coalesce(case when v_id is null then v_plan->'newAssignment' else v_plan->'assignmentPatch' end,'{}');
 if v_id is null then v_patch:=v_patch||coalesce(v_plan->'assignmentPatch','{}');end if;
 if v_plan ? 'sourceLink' and v_plan->'sourceLink'<>'null'::jsonb then v_patch:=v_patch||(v_plan->'sourceLink');end if;
 v_id:=public.cardinal_write_assignment(v_id,v_patch,v_group);
 select * into v_a from public.school_assignments where id=v_id;
 for v_write in select value from jsonb_array_elements(v_plan->'writes') loop
  v_grade:=(v_write->>'grade')::numeric;v_base:=(v_write->>'baseScore')::numeric;v_max:=(v_write->>'baseMax')::numeric;
  if v_grade is not null and (v_a.max_score is null or v_grade<0 or v_grade>v_a.max_score or v_grade::text in ('NaN','Infinity','-Infinity')) then raise exception 'invalid_result_grade';end if;
  if v_grade is not null and (v_base is null or v_max is null or v_write->>'sourceKind' is null) then raise exception 'missing_canonical_base';end if;
  insert into public.school_results(assignment_id,student_email,grade,base_score,base_max,base_source,result_group_code,response,feedback,visible,updated_at)
   values(v_id,v_write->>'email',v_grade,v_base,v_max,case when v_base is null and v_max is null then null else v_write->>'sourceKind' end,v_group,coalesce(v_write->>'response',''),coalesce(v_write->>'feedback',''),coalesce((v_write->>'visible')::boolean,true),clock_timestamp())
   on conflict(assignment_id,student_email) do update set grade=excluded.grade,base_score=excluded.base_score,base_max=excluded.base_max,base_source=excluded.base_source,result_group_code=excluded.result_group_code,response=excluded.response,feedback=excluded.feedback,visible=excluded.visible,updated_at=excluded.updated_at;
  v_count:=v_count+1;
 end loop;
 if exists(select 1 from public.school_results r where r.assignment_id=v_id and r.grade is not null and (v_a.max_score is null or r.grade<0 or r.grade>v_a.max_score)) then raise exception 'invalid_remaining_result_grade';end if;
 if v_plan->'mozaikLink' ? 'activity_id' then
  if coalesce(v_plan->'mozaikLink'->>'group_code',v_group)<>v_group then raise exception 'invalid_link_group';end if;
  insert into public.school_mozaik_links(assignment_id,group_code,activity_id,competence_code,sync_status)
   values(v_id,v_group,v_plan->'mozaikLink'->>'activity_id',v_plan->'mozaikLink'->>'competence_code','dirty')
   on conflict(assignment_id,group_code) do update set activity_id=excluded.activity_id,competence_code=excluded.competence_code,sync_status='dirty';
 end if;
 update public.school_mozaik_links set sync_status='dirty' where assignment_id=v_id and group_code=v_group;
 if found then update public.school_assignments set mozaik_sync_status='dirty' where id=v_id;end if;
 v_result:=coalesce(v_plan->'summary','{}')||jsonb_build_object('assignmentId',v_id,'importedCount',v_count,'maxScore',v_a.max_score,'operationId',p_preview_id);
 update public.school_assignment_operations set status='confirmed',result=v_result,confirmed_at=clock_timestamp() where id=p_preview_id;
 return v_result;
end $$;

revoke all on function public.cardinal_assignment_revision(),public.cardinal_result_revision(),public.cardinal_write_assignment(uuid,jsonb,text),public.cardinal_assignment_snapshot(uuid),public.cardinal_create_assignment_batch(text,uuid,jsonb,text[]),public.cardinal_confirm_assignment_operation(text,uuid) from public,anon,authenticated;
grant execute on function public.cardinal_assignment_snapshot(uuid),public.cardinal_create_assignment_batch(text,uuid,jsonb,text[]),public.cardinal_confirm_assignment_operation(text,uuid) to service_role;
commit;
