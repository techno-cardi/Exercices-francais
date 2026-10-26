-- Additive bootstrap: existing work dates and verified external IDs establish2026–2027.
-- No existing result, comment, progress or credential is rewritten.
begin;
create table public.school_years(
 start_year integer primary key check(start_year between 2000 and 2199),
 label text not null,status text not null default 'draft' check(status in ('draft','open','archived')),
 revision bigint not null default 0,created_at timestamptz not null default now(),archived_at timestamptz,
 provenance text not null default 'teacher');
insert into public.school_years(start_year,label,status,provenance) values(2026,'2026–2027','open','reviewed_bootstrap_20261026');
create table public.school_year_config(
 singleton boolean primary key default true check(singleton),active_year integer not null references public.school_years,
 revision bigint not null default 0,enforced boolean not null default false);
insert into public.school_year_config(active_year) values(2026);
create table public.school_year_groups(
 school_year integer not null references public.school_years,group_code text not null check(group_code ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,39}$'),
 mozaik_config jsonb,primary key(school_year,group_code));
create table public.school_year_enrollments(
 school_year integer not null references public.school_years,student_email text not null references public.school_students,
 group_code text not null,name text not null,first_name text,last_name text,active boolean not null default true,
 provenance text not null default 'teacher',updated_at timestamptz not null default now(),
 primary key(school_year,student_email),foreign key(school_year,group_code) references public.school_year_groups);
create index school_year_enrollments_group on public.school_year_enrollments(school_year,group_code) where active;
create table public.school_year_enrollment_history(
 id bigint generated always as identity primary key,school_year integer not null,student_email text not null,
 before_row jsonb,after_row jsonb,changed_at timestamptz not null default now());
create table public.school_assignment_roster(
 assignment_id uuid not null references public.school_assignments on delete cascade,student_email text not null references public.school_students,
 school_year integer not null references public.school_years,group_code text not null,name text not null,first_name text,last_name text,
 source text not null default 'assignment_creation',captured_at timestamptz not null default now(),primary key(assignment_id,student_email));
create index school_assignment_roster_student on public.school_assignment_roster(student_email,school_year);
create table public.school_year_operations(
 id uuid primary key default gen_random_uuid(),teacher_email text not null,kind text not null,
 request jsonb not null,plan jsonb not null,status text not null default 'preview' check(status in ('preview','confirmed')),
 expires_at timestamptz not null default(now()+interval '20 minutes'),created_at timestamptz not null default now(),result jsonb,confirmed_at timestamptz);
do $$declare t text;begin
 foreach t in array array['school_years','school_year_config','school_year_groups','school_year_enrollments','school_year_enrollment_history','school_assignment_roster','school_year_operations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.school_year_enrollment_history_id_seq to service_role;
alter table public.school_students drop constraint if exists school_students_group_code_check;
alter table public.school_students add constraint school_students_group_code_check check(group_code ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,39}$');
alter table public.school_students add column pending_school_year integer references public.school_years;
alter table public.school_assignments add column school_year integer not null default 2026 references public.school_years;
create index school_assignments_year on public.school_assignments(school_year,created_at) where not split_archived;
insert into public.school_year_groups(school_year,group_code)
 select 2026,group_code from public.school_students group by group_code on conflict do nothing;
insert into public.school_year_enrollments(school_year,student_email,group_code,name,first_name,last_name,active,provenance)
 select 2026,email,group_code,name,first_name,last_name,active,'reviewed_current_roster_bootstrap' from public.school_students;
insert into public.school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name,source)
 select a.id,e.student_email,a.school_year,e.group_code,e.name,e.first_name,e.last_name,'current_roster_captured_at_migration'
 from public.school_assignments a join public.school_year_enrollments e on e.school_year=a.school_year and e.group_code=any(a.group_codes)
 where not a.split_archived and e.active;
-- Include departed and feedback-only identities, using the work's actual group, never their new current group.
do $$declare a public.school_assignments;r record;g text;s public.school_students;begin
 for a in select * from public.school_assignments where not split_archived loop
  for r in select student_email from public.school_results where assignment_id=a.id
   union select student_email from public.school_formative_feedbacks where assignment_id=a.id
   union select student_email from public.fr_dictee_feedback where assignment_id=a.id loop
   select result_group_code into g from public.school_results where assignment_id=a.id and student_email=r.student_email;
   if g is null or g='' then if cardinality(a.group_codes)=1 then g:=a.group_codes[1];else raise exception 'year_bootstrap_ambiguous_membership';end if;end if;
   if not(g=any(a.group_codes)) then raise exception 'year_bootstrap_conflicting_membership';end if;
   select * into s from public.school_students where email=r.student_email;
   if not found then raise exception 'year_bootstrap_missing_identity';end if;
   insert into public.school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name,source)
    values(a.id,r.student_email,a.school_year,g,s.name,s.first_name,s.last_name,'existing_result_or_feedback') on conflict do nothing;
  end loop;
 end loop;
end $$;
update public.school_year_groups yg set mozaik_config=to_jsonb(g) from public.school_mozaik_groups g where yg.school_year=2026 and yg.group_code=g.group_code;

create function public.cardinal_active_school_year() returns integer language sql stable security definer set search_path='' as $$
 select active_year from public.school_year_config where singleton
$$;
alter table public.school_assignments alter column school_year set default public.cardinal_active_school_year();
create function public.cardinal_assert_year_open(p_year integer,p_active boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare y public.school_years;c public.school_year_config;begin
 select * into y from public.school_years where start_year=p_year for share;
 if y.start_year is null or y.status<>'open' then raise exception 'school_year_read_only';end if;
 if p_active then select * into c from public.school_year_config where singleton for share;if c.active_year<>p_year then raise exception 'school_year_not_active';end if;end if;
end $$;
create function public.cardinal_year_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare aid uuid;y integer;g text;e public.school_year_enrollments;st text;begin
 if tg_table_name='school_assignments' then
  y:=case when tg_op='DELETE' then old.school_year else new.school_year end;
  if tg_op='UPDATE' and old.school_year<>new.school_year then raise exception 'assignment_school_year_immutable';end if;
  perform public.cardinal_assert_year_open(y,tg_op='INSERT');
 else
  aid:=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
  select school_year into y from public.school_assignments where id=aid for share;
  if not found and tg_op='DELETE' then return old;end if;
  perform public.cardinal_assert_year_open(y,tg_table_name='school_mozaik_sync_jobs');
  if tg_table_name='school_assignment_roster' and tg_op='DELETE' then
   if exists(select 1 from public.school_results where assignment_id=aid and student_email=old.student_email) or
      exists(select 1 from public.school_formative_feedbacks where assignment_id=aid and student_email=old.student_email) or
      exists(select 1 from public.fr_dictee_feedback where assignment_id=aid and student_email=old.student_email) then
    raise exception 'assignment_roster_has_history';
   end if;
  end if;
  if tg_table_name='school_assignment_roster' and tg_op<>'DELETE' then
   if new.school_year<>y or not exists(select 1 from public.school_assignments where id=aid and new.group_code=any(group_codes)) then raise exception 'assignment_roster_scope_mismatch';end if;
   if tg_op='UPDATE' and (old.assignment_id<>new.assignment_id or old.student_email<>new.student_email or old.school_year<>new.school_year or old.group_code<>new.group_code) then raise exception 'assignment_roster_identity_immutable';end if;
  end if;
  if tg_table_name in ('school_results','school_formative_feedbacks','fr_dictee_feedback') and tg_op<>'DELETE' then
   if not exists(select 1 from public.school_assignment_roster where assignment_id=aid and student_email=new.student_email) then
    select en.* into e from public.school_year_enrollments en join public.school_assignments a on a.school_year=en.school_year and en.group_code=any(a.group_codes)
     where a.id=aid and en.student_email=new.student_email and en.active;
    if not found then raise exception 'invalid_assignment_member';end if;
    insert into public.school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name,source)
     values(aid,e.student_email,y,e.group_code,e.name,e.first_name,e.last_name,'explicit_grade_or_feedback_import') on conflict do nothing;
   end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger cardinal_year_write_guard before insert or update or delete on public.school_assignments for each row execute function public.cardinal_year_write_guard();
do $$declare t text;begin
 foreach t in array array['school_results','school_formative_feedbacks','fr_dictee_feedback','school_mozaik_links','school_mozaik_sync_jobs','school_assignment_roster'] loop
  execute format('create trigger cardinal_year_write_guard before insert or update or delete on public.%I for each row execute function public.cardinal_year_write_guard()',t);
 end loop;
end $$;
create function public.cardinal_capture_assignment_roster() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name)
 select new.id,e.student_email,new.school_year,e.group_code,e.name,e.first_name,e.last_name from public.school_year_enrollments e
 where e.school_year=new.school_year and e.group_code=any(new.group_codes) and e.active on conflict do nothing;
 return new;
end $$;
create trigger cardinal_capture_assignment_roster after insert on public.school_assignments for each row execute function public.cardinal_capture_assignment_roster();
create function public.cardinal_enrollment_history() returns trigger language plpgsql security definer set search_path='' as $$
declare y integer;st text;begin
 y:=case when tg_op='DELETE' then old.school_year else new.school_year end;
 select status into st from public.school_years where start_year=y for share;
 if st='archived' then raise exception 'school_year_read_only';end if;
 if tg_op='UPDATE' and (old.school_year<>new.school_year or old.student_email<>new.student_email) then raise exception 'enrollment_identity_immutable';end if;
 insert into public.school_year_enrollment_history(school_year,student_email,before_row,after_row)
 values(y,case when tg_op='DELETE' then old.student_email else new.student_email end,case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);
 update public.school_years set revision=revision+1 where start_year=y;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger cardinal_enrollment_history before insert or update or delete on public.school_year_enrollments for each row execute function public.cardinal_enrollment_history();
create function public.cardinal_protect_enrollment_history() returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'enrollment_history_immutable';end $$;
create trigger cardinal_protect_enrollment_history before update or delete on public.school_year_enrollment_history for each row execute function public.cardinal_protect_enrollment_history();
create trigger cardinal_protect_enrollment_history_truncate before truncate on public.school_year_enrollment_history for each statement execute function public.cardinal_protect_enrollment_history();
create function public.cardinal_mirror_annual_mapping() returns trigger language plpgsql security definer set search_path='' as $$
declare y integer;rawyear text;begin
 y:=public.cardinal_active_school_year();
 rawyear:=substring(new.group_matter_id from length(new.establishment_id)+1 for 4);
 if rawyear !~ '^20[0-9]{2}$' or rawyear::integer<>y or substring(new.group_course_id from length(new.establishment_id)+1 for 4)<>rawyear then raise exception 'mozaik_school_year_mismatch';end if;
 perform public.cardinal_assert_year_open(y,true);
 insert into public.school_year_groups(school_year,group_code,mozaik_config) values(y,new.group_code,to_jsonb(new))
 on conflict(school_year,group_code) do update set mozaik_config=excluded.mozaik_config;
 return new;
end $$;
create trigger cardinal_mirror_annual_mapping before insert or update on public.school_mozaik_groups for each row execute function public.cardinal_mirror_annual_mapping();
create or replace function public.cardinal_assignment_snapshot(p_assignment_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assignment',to_jsonb(a),'results',coalesce((select jsonb_agg(to_jsonb(r) order by r.student_email) from public.school_results r where r.assignment_id=a.id),'[]'::jsonb),
 'roster',coalesce((select jsonb_agg(to_jsonb(r) order by r.student_email) from public.school_assignment_roster r where r.assignment_id=a.id),'[]'::jsonb),
 'yearStatus',(select status from public.school_years where start_year=a.school_year),'activeYear',public.cardinal_active_school_year())
 from public.school_assignments a where a.id=p_assignment_id
$$;
create function public.cardinal_year_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('activeYear',c.active_year,'contextRevision',c.revision,'enforced',c.enforced,
 'pendingJobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'assignmentId',a.id,'title',a.title,'schoolYear',a.school_year,'status',j.status,'canCancel',j.status='ready' and j.checkpoint is null)) from public.school_mozaik_sync_jobs j join public.school_assignments a on a.id=j.assignment_id where j.status in ('ready','claimed')),'[]'),
 'years',(select jsonb_agg(jsonb_build_object('year',y.start_year,'label',y.label,'status',y.status,'revision',y.revision,
 'groupCount',(select count(*) from public.school_year_groups g where g.school_year=y.start_year),
 'studentCount',(select count(*) from public.school_year_enrollments e where e.school_year=y.start_year and e.active),
 'assignmentCount',(select count(*) from public.school_assignments a where a.school_year=y.start_year and not a.split_archived)) order by y.start_year desc) from public.school_years y))
 from public.school_year_config c where singleton
$$;
create function public.cardinal_year_digest(p_year integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('year',(select to_jsonb(y) from public.school_years y where start_year=p_year),
 'context',(select to_jsonb(c) from public.school_year_config c where singleton),
 'enrollments',md5(coalesce((select jsonb_agg(to_jsonb(e) order by student_email)::text from public.school_year_enrollments e where school_year=p_year),'')),
 'works',md5(coalesce((select jsonb_agg(to_jsonb(a) order by id)::text from public.school_assignments a where school_year=p_year),'')),
 'results',md5(coalesce((select jsonb_agg(to_jsonb(r) order by r.assignment_id,r.student_email)::text from public.school_results r join public.school_assignments a on a.id=r.assignment_id where a.school_year=p_year),'')),
 'comments',md5(coalesce((select jsonb_agg(to_jsonb(f) order by f.assignment_id,f.student_email,f.formative_item_id)::text from public.school_formative_feedbacks f join public.school_assignments a on a.id=f.assignment_id where a.school_year=p_year),'')),
 'dictations',md5(coalesce((select jsonb_agg(to_jsonb(f) order by f.assignment_id,f.student_email)::text from public.fr_dictee_feedback f join public.school_assignments a on a.id=f.assignment_id where a.school_year=p_year),'')),
 'rosters',md5(coalesce((select jsonb_agg(to_jsonb(r) order by r.assignment_id,r.student_email)::text from public.school_assignment_roster r where school_year=p_year),'')))
$$;
create function public.cardinal_preview_school_year(p_teacher text,p_kind text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare y integer:=(p_request->>'year')::integer;c public.school_year_config;yr public.school_years;pid uuid:=gen_random_uuid();plan jsonb;preview jsonb;rows jsonb;row jsonb;seen text[]:='{}';n int;newcount int:=0;knowncount int:=0;g text;aid uuid;
begin
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if y is null or y not between 2000 and 2199 then raise exception 'invalid_school_year';end if;
 select * into c from public.school_year_config where singleton;select * into yr from public.school_years where start_year=y;
 if p_kind not in ('create','roster','activate','archive','reopen','roster_append') then raise exception 'invalid_year_operation';end if;
 if p_kind<>'create' and yr.start_year is null then raise exception 'school_year_not_found';end if;
 plan:=jsonb_build_object('year',y,'before',public.cardinal_year_digest(y),'sourceBefore',public.cardinal_year_digest(c.active_year));
 preview:=jsonb_build_object('year',y,'label',y::text||'–'||(y+1)::text,'activeYear',c.active_year,'kind',p_kind);
 if p_kind='create' then
  if yr.start_year is not null then raise exception 'school_year_already_exists';end if;
 elsif p_kind='roster' then
  if yr.status='archived' or (yr.status='open' and y<>c.active_year) then raise exception 'school_year_read_only';end if;
  if p_request->>'mode' not in ('merge','replace') or p_request->>'mode'='replace' and yr.status<>'draft' then raise exception 'year_roster_replace_draft_only';end if;
  rows:=p_request->'rows';if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)=0 or jsonb_array_length(rows)>3000 then raise exception 'invalid_year_roster';end if;
  for row in select value from jsonb_array_elements(rows) loop
   if coalesce(row->>'email','') !~ '^[^[:space:]@]+@educ[.]cscapitale[.]qc[.]ca$' or row->>'email'<>lower(row->>'email') then raise exception 'invalid_roster_email';end if;
   if row->>'email'=any(seen) then raise exception 'duplicate_roster_student';end if;seen:=array_append(seen,row->>'email');
   if coalesce(row->>'group','') !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,39}$' or length(coalesce(row->>'name','')) not between 1 and 280 or length(coalesce(row->>'firstName',''))>120 or length(coalesce(row->>'lastName',''))>160 then raise exception 'invalid_roster_fields';end if;
   if exists(select 1 from public.school_students where email=row->>'email') then knowncount:=knowncount+1;
   else if coalesce(row->>'ficheHash','') !~ '^pbkdf2_sha256\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$' then raise exception 'new_student_fiche_required';end if;newcount:=newcount+1;end if;
  end loop;
  plan:=plan||jsonb_build_object('rows',rows,'mode',p_request->>'mode');
  preview:=preview||jsonb_build_object('newStudents',newcount,'knownStudents',knowncount,'rowCount',jsonb_array_length(rows),'groupCount',(select count(distinct value->>'group') from jsonb_array_elements(rows)),'mode',p_request->>'mode',
   'members',(select jsonb_agg(jsonb_build_object('name',v->>'name','group',v->>'group','previousGroup',e.group_code,'action',case when e.student_email is null then 'Ajout' when e.group_code<>v->>'group' then 'Changement de groupe' else 'Mise à jour' end) order by v->>'name') from jsonb_array_elements(rows) v left join public.school_year_enrollments e on e.school_year=y and e.student_email=v->>'email'));
 elsif p_kind='activate' then
  if yr.status<>'draft' or y=c.active_year or y<c.active_year then raise exception 'school_year_activation_requires_future_draft';end if;
  if not exists(select 1 from public.school_year_enrollments where school_year=y and active) then raise exception 'school_year_roster_empty';end if;
  if exists(select 1 from public.school_mozaik_sync_jobs where status in ('ready','claimed')) then raise exception 'school_year_pending_mozaik';end if;
  preview:=preview||jsonb_build_object('studentCount',(select count(*) from public.school_year_enrollments where school_year=y and active),
   'groupCount',(select count(distinct group_code) from public.school_year_enrollments where school_year=y and active),
   'preservedAssignments',(select count(*) from public.school_assignments where school_year=c.active_year and not split_archived),
   'preservedResults',(select count(*) from public.school_results r join public.school_assignments a on a.id=r.assignment_id where a.school_year=c.active_year),
   'preservedComments',(select count(*) from public.school_formative_feedbacks f join public.school_assignments a on a.id=f.assignment_id where a.school_year=c.active_year));
 elsif p_kind='archive' then
  if y=c.active_year or yr.status<>'open' then raise exception 'archive_via_year_activation';end if;
 elsif p_kind='reopen' then
  if yr.status<>'archived' then raise exception 'school_year_not_archived';end if;
 elsif p_kind='roster_append' then
  perform public.cardinal_assert_year_open(y,true);aid:=(p_request->>'assignmentId')::uuid;
  if not exists(select 1 from public.school_assignments where id=aid and school_year=y and not split_archived) then raise exception 'assignment_year_mismatch';end if;
  rows:=(select coalesce(jsonb_agg(to_jsonb(e) order by e.student_email),'[]') from public.school_year_enrollments e join public.school_assignments a on a.school_year=e.school_year and e.group_code=any(a.group_codes)
   where a.id=aid and e.active and not exists(select 1 from public.school_assignment_roster r where r.assignment_id=aid and r.student_email=e.student_email));
  plan:=plan||jsonb_build_object('assignmentId',aid,'rows',rows);
  preview:=preview||jsonb_build_object('addedCount',jsonb_array_length(rows),'members',(select coalesce(jsonb_agg(jsonb_build_object('name',value->>'name','group',value->>'group_code')),'[]') from jsonb_array_elements(rows)));
 end if;
 -- No fiche, hash, token or credential is returned or retained in the public request summary.
 insert into public.school_year_operations(id,teacher_email,kind,request,plan) values(pid,p_teacher,p_kind,jsonb_build_object('year',y,'kind',p_kind),plan);
 return jsonb_build_object('previewId',pid,'preview',preview,'expiresAt',now()+interval '20 minutes');
end $$;
create function public.cardinal_confirm_school_year(p_teacher text,p_preview_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.school_year_operations;y integer;c public.school_year_config;r jsonb;g text;v_result jsonb;yr public.school_years;begin
 -- Lock writes before reading the context; grade/import/archive transactions cannot interleave.
 lock table public.school_assignments,public.school_results,public.school_formative_feedbacks,public.fr_dictee_feedback,
  public.school_mozaik_links,public.school_mozaik_sync_jobs,public.school_assignment_roster,public.school_students,
  public.school_year_enrollments,public.school_year_groups,public.school_mozaik_groups,public.school_years,public.school_year_config,public.school_year_operations in share row exclusive mode;
 select * into op from public.school_year_operations where id=p_preview_id for update;
 if op.id is null or op.teacher_email<>p_teacher or not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_year_operation_owner';end if;
 if op.status='confirmed' then return op.result;end if;
 if op.expires_at<=clock_timestamp() then raise exception 'preview_expired';end if;
 y:=(op.plan->>'year')::integer;select * into c from public.school_year_config where singleton for update;
 if op.plan->'before' is distinct from public.cardinal_year_digest(y) or op.plan->'sourceBefore' is distinct from public.cardinal_year_digest(c.active_year) then raise exception 'stale_year_preview';end if;
 select * into yr from public.school_years where start_year=y;
 if op.kind='create' then
  insert into public.school_years(start_year,label) values(y,y::text||'–'||(y+1)::text);
 elsif op.kind='roster' then
  if yr.status='archived' or op.plan->>'mode'='replace' and yr.status<>'draft' then raise exception 'school_year_read_only';end if;
  if op.plan->>'mode'='replace' then delete from public.school_year_enrollments where school_year=y;end if;
  for r in select value from jsonb_array_elements(op.plan->'rows') loop
   insert into public.school_year_groups(school_year,group_code) values(y,r->>'group') on conflict do nothing;
   -- New draft accounts cannot log in before activation. Existing credentials and access are untouched.
   if not exists(select 1 from public.school_students where email=r->>'email') then
    insert into public.school_students(email,name,first_name,last_name,group_code,fiche_hash,active,roster_name_source,pending_school_year)
     values(r->>'email',r->>'name',r->>'firstName',r->>'lastName',r->>'group',r->>'ficheHash',y=c.active_year,'manual_verified',case when y=c.active_year then null else y end);
   end if;
   insert into public.school_year_enrollments(school_year,student_email,group_code,name,first_name,last_name,active)
    values(y,r->>'email',r->>'group',r->>'name',r->>'firstName',r->>'lastName',coalesce((r->>'active')::boolean,true))
    on conflict(school_year,student_email) do update set group_code=excluded.group_code,name=excluded.name,first_name=excluded.first_name,last_name=excluded.last_name,active=excluded.active,updated_at=now();
   if y=c.active_year then update public.school_students set group_code=r->>'group',name=r->>'name',first_name=r->>'firstName',last_name=r->>'lastName' where email=r->>'email';end if;
  end loop;
 elsif op.kind='activate' then
  if not c.enforced then raise exception 'school_year_feature_not_ready';end if;
  if yr.status<>'draft' or y<=c.active_year or not exists(select 1 from public.school_year_enrollments where school_year=y and active) then raise exception 'invalid_year_activation';end if;
  if exists(select 1 from public.school_mozaik_sync_jobs where status in ('ready','claimed')) then raise exception 'school_year_pending_mozaik';end if;
  update public.school_years set status='archived',archived_at=now(),revision=revision+1 where start_year=c.active_year;
  update public.school_years set status='open',revision=revision+1 where start_year=y;
  update public.school_year_config set active_year=y,revision=revision+1 where singleton;
  -- The old mapping is already preserved in school_year_groups; never reuse it for a new cohort.
  delete from public.school_mozaik_groups;
  update public.school_students s set group_code=e.group_code,name=e.name,first_name=e.first_name,last_name=e.last_name,
   active=case when s.pending_school_year is not null then true else s.active end,pending_school_year=null
   from public.school_year_enrollments e where e.school_year=y and e.active and s.email=e.student_email;
 elsif op.kind='archive' then
  if y=c.active_year or yr.status<>'open' then raise exception 'archive_via_year_activation';end if;
  if exists(select 1 from public.school_mozaik_sync_jobs j join public.school_assignments a on a.id=j.assignment_id where a.school_year=y and j.status in ('ready','claimed')) then raise exception 'school_year_pending_mozaik';end if;
  update public.school_years set status='archived',archived_at=now(),revision=revision+1 where start_year=y;
 elsif op.kind='reopen' then
  if yr.status<>'archived' then raise exception 'school_year_not_archived';end if;
  update public.school_years set status='open',archived_at=null,revision=revision+1 where start_year=y;
 elsif op.kind='roster_append' then
  perform public.cardinal_assert_year_open(y,true);
  insert into public.school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name,source)
   select (op.plan->>'assignmentId')::uuid,member->>'student_email',y,member->>'group_code',member->>'name',member->>'first_name',member->>'last_name','teacher_confirmed_roster_append'
   from jsonb_array_elements(op.plan->'rows') member on conflict do nothing;
 end if;
 v_result:=jsonb_build_object('year',y,'kind',op.kind,'activeYear',public.cardinal_active_school_year(),'operationId',p_preview_id);
 update public.school_year_operations set status='confirmed',result=v_result,confirmed_at=now() where id=p_preview_id;
 return v_result;
end $$;

-- JSON aggregation avoids PostgREST row limits silently truncating a year of results.
create function public.cardinal_teacher_year_dashboard(p_year integer) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assignments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object(
 'studentCount',(select count(*) from public.school_assignment_roster r where r.assignment_id=a.id),
 'resultCount',(select count(*) from public.school_results r where r.assignment_id=a.id),
 'gradedCount',(select count(grade) from public.school_results r where r.assignment_id=a.id),
 'average',(select avg(grade) from public.school_results r where r.assignment_id=a.id)) order by a.created_at desc)
 from public.school_assignments a where a.school_year=p_year and not a.split_archived),'[]'),
 'groups',coalesce((select jsonb_object_agg(group_code,n) from(select group_code,count(*) n from public.school_year_enrollments where school_year=p_year and active group by group_code) s),'{}'))
$$;
create function public.cardinal_teacher_assignment_read(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('assignment',to_jsonb(a),'students',coalesce((select jsonb_agg(jsonb_build_object(
 'email',r.student_email,'name',r.name,'firstName',r.first_name,'lastName',r.last_name,'group',r.group_code,
 'response',coalesce(s.response,''),'grade',s.grade,'feedback',coalesce(s.feedback,''),'visible',coalesce(s.visible,true),'updatedAt',s.updated_at)
 order by r.group_code,r.last_name,r.first_name,r.student_email) from public.school_assignment_roster r left join public.school_results s on s.assignment_id=r.assignment_id and s.student_email=r.student_email where r.assignment_id=a.id),'[]'))
 from public.school_assignments a where a.id=p_id
$$;
create function public.cardinal_student_year_results(p_email text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'competencies',a.competencies,'weight',a.weight,'maxScore',a.max_score,'instructions',a.instructions,
 'schoolYear',a.school_year,'schoolYearLabel',y.label,'group',m.group_code,'archived',y.status='archived',
 'result',case when r.student_email is null then null else jsonb_build_object('response',r.response,'grade',r.grade,'feedback',r.feedback,'updatedAt',r.updated_at) end)
 order by a.school_year desc,a.created_at desc),'[]') from public.school_assignment_roster m
 join public.school_assignments a on a.id=m.assignment_id join public.school_years y on y.start_year=a.school_year
 left join public.school_results r on r.assignment_id=a.id and r.student_email=p_email and r.visible
 where m.student_email=p_email and a.published and not a.split_archived
$$;
create function public.cardinal_cancel_unclaimed_year_job(p_teacher text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.school_mozaik_sync_jobs;begin
 lock table public.school_assignments,public.school_mozaik_sync_jobs in share row exclusive mode;
 select * into j from public.school_mozaik_sync_jobs where id=p_id for update;
 if not found or j.teacher_email<>p_teacher or not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_year_operation_owner';end if;
 if j.status<>'ready' or j.checkpoint is not null then raise exception 'school_year_pending_mozaik';end if;
 update public.school_mozaik_sync_jobs set status='expired',completed_at=now(),result='{"cancelled":true,"reason":"teacher_cancel_before_claim"}' where id=p_id;
 return jsonb_build_object('cancelled',true);
end $$;
create function public.cardinal_teacher_annual_feedback(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('student_email',student_email,'formative_id',formative_id,'formative_item_id',formative_item_id,'question_number',question_number,'question_label',question_label,'feedback',feedback,'feedback_message_id',feedback_message_id,'updated_at',updated_at) order by question_number,student_email),'[]') from public.school_formative_feedbacks where assignment_id=p_id
$$;
create function public.cardinal_student_annual_feedback(p_email text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('assignmentId',f.assignment_id,'questionId',f.formative_item_id,'questionNumber',f.question_number,'questionLabel',f.question_label,'feedback',f.feedback,'updatedAt',f.updated_at)
 order by a.school_year desc,f.question_number),'[]')
 from public.school_formative_feedbacks f join public.school_assignment_roster m on m.assignment_id=f.assignment_id and m.student_email=f.student_email
 join public.school_assignments a on a.id=f.assignment_id left join public.school_results r on r.assignment_id=f.assignment_id and r.student_email=f.student_email
 where f.student_email=p_email and a.published and not a.split_archived and (r.student_email is null or r.visible)
$$;
create function public.cardinal_save_annual_feedback(p_teacher text,p_formative text,p_rows jsonb,p_year integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;a public.school_assignments;v_email text;item text;content text;saved int:=0;skipped int:=0;deleted int:=0;begin
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>5000 then raise exception 'invalid_feedback_batch';end if;
 perform 1 from public.school_assignments where id in(select distinct (value->>'assignmentId')::uuid from jsonb_array_elements(p_rows)) order by id for update;
 for r in select value from jsonb_array_elements(p_rows) loop
  select * into a from public.school_assignments where id=(r->>'assignmentId')::uuid;
  if not found then skipped:=skipped+1;continue;end if;
  perform public.cardinal_assert_year_open(a.school_year,true);
  if p_year is not null and a.school_year<>p_year then raise exception 'assignment_year_mismatch';end if;
  v_email:=lower(btrim(r->>'email'));item:=left(btrim(coalesce(r->>'formativeItemId',r->>'questionId','')),200);
  if v_email is null or item='' or (a.formative_id is not null and a.formative_id<>p_formative) or (cardinality(a.formative_question_ids)>0 and not(item=any(a.formative_question_ids))) then skipped:=skipped+1;continue;end if;
  if not exists(select 1 from public.school_assignment_roster where assignment_id=a.id and student_email=v_email)
   and not exists(select 1 from public.school_year_enrollments e where e.school_year=a.school_year and e.student_email=v_email and e.group_code=any(a.group_codes) and e.active) then skipped:=skipped+1;continue;end if;
  content:=left(btrim(coalesce(r->>'feedback','')),12000);
  if content='' then delete from public.school_formative_feedbacks where assignment_id=a.id and student_email=v_email and formative_item_id=item;deleted:=deleted+1;
  else
   insert into public.school_formative_feedbacks(assignment_id,student_email,formative_id,formative_item_id,question_number,question_label,feedback,feedback_message_id,updated_at)
   values(a.id,v_email,p_formative,item,left(coalesce(r->>'questionNumber',''),40),left(coalesce(r->>'questionLabel',''),500),content,nullif(left(coalesce(r->>'feedbackMessageId',''),200),''),now())
   on conflict(assignment_id,student_email,formative_item_id) do update set feedback=excluded.feedback,formative_id=excluded.formative_id,question_number=excluded.question_number,question_label=excluded.question_label,feedback_message_id=excluded.feedback_message_id,updated_at=excluded.updated_at;
   saved:=saved+1;
  end if;
 end loop;
 return jsonb_build_object('saved',saved,'skipped',skipped,'deleted',deleted);
end $$;
create function public.cardinal_group_year_overview(p_year integer,p_group text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schoolYear',p_year,'groupCode',p_group,
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'maxScore',a.max_score,'term',a.term,'activityDate',a.activity_date,'competenceKind',a.mozaik_competence_kind) order by a.activity_date nulls last,a.created_at)
 from public.school_assignments a where a.school_year=p_year and p_group=any(a.group_codes) and not a.split_archived),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('email',m.student_email,'name',m.name,'firstName',m.first_name,'lastName',m.last_name,
 'results',coalesce((select jsonb_object_agg(r.assignment_id::text,jsonb_build_object('grade',s.grade,'assigned',true)) from public.school_assignment_roster r
 join public.school_assignments a on a.id=r.assignment_id left join public.school_results s on s.assignment_id=r.assignment_id and s.student_email=r.student_email
 where r.student_email=m.student_email and r.school_year=p_year and r.group_code=p_group and not a.split_archived),'{}')) order by m.last_name,m.first_name,m.student_email)
 from (select distinct on(student_email) student_email,name,first_name,last_name from (
 select student_email,name,first_name,last_name,0 priority from public.school_year_enrollments where school_year=p_year and group_code=p_group
 union all select student_email,name,first_name,last_name,1 priority from public.school_assignment_roster where school_year=p_year and group_code=p_group) n order by student_email,priority) m),'[]'))
$$;
create function public.cardinal_update_annual_roster_names(p_year integer,p_group text,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb;v_email text;first_name_value text;last_name_value text;v_count integer:=0;begin
 lock table public.school_students,public.school_year_enrollments,public.school_years,public.school_year_config in share row exclusive mode;
 perform public.cardinal_assert_year_open(p_year,true);
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>300 then raise exception 'invalid_year_roster';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  v_email:=lower(btrim(r->>'email'));first_name_value:=left(btrim(r->>'firstName'),120);last_name_value:=left(btrim(r->>'lastName'),160);
  if coalesce(v_email,'') !~ '^[^[:space:]@]+@educ[.]cscapitale[.]qc[.]ca$' or coalesce(first_name_value,'')='' or coalesce(last_name_value,'')='' then continue;end if;
  if not exists(select 1 from public.school_year_enrollments where school_year=p_year and student_email=v_email and group_code=p_group and active) then continue;end if;
  update public.school_year_enrollments set name=first_name_value||' '||last_name_value,first_name=first_name_value,last_name=last_name_value,updated_at=now() where school_year=p_year and student_email=v_email;
  update public.school_students set name=first_name_value||' '||last_name_value,first_name=first_name_value,last_name=last_name_value,roster_name_source='mozaik_verified',updated_at=now() where email=v_email;
  v_count:=v_count+1;
 end loop;return v_count;
end $$;
-- Service-only functions. The Edge service authenticates the teacher; public clients cannot impersonate one.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('cardinal_update_annual_roster_names','cardinal_active_school_year','cardinal_assert_year_open','cardinal_year_write_guard','cardinal_capture_assignment_roster','cardinal_enrollment_history','cardinal_protect_enrollment_history','cardinal_mirror_annual_mapping','cardinal_year_catalog','cardinal_year_digest','cardinal_preview_school_year','cardinal_confirm_school_year','cardinal_teacher_year_dashboard','cardinal_teacher_assignment_read','cardinal_student_year_results','cardinal_student_annual_feedback','cardinal_save_annual_feedback','cardinal_group_year_overview','cardinal_teacher_annual_feedback','cardinal_cancel_unclaimed_year_job') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
-- GENERATED YEAR INTEGRATIONS
create or replace function public.cardinal_write_assignment(p_id uuid,p_patch jsonb,p_group text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id;v_keys text[];v_cols text;v_select text;
 v_allowed constant text[]:=array['school_year','title','competencies','weight','max_score','published','instructions','subject','term','activity_date','activity_type','report_card_enabled','mozaik_results_visible','mozaik_show_in_schedule','mozaik_homework','mozaik_period','mozaik_competence_code','mozaik_competence_kind','formative_scale_mode','import_state','source_metadata','formative_id','formative_assignment_id','formative_section_id','formative_title','formative_question_ids','formative_question_meta','formative_last_synced_at'];
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'invalid_assignment_patch';end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(v_allowed))) then raise exception 'unknown_assignment_field';end if;
 if v_id is null then
  if not(p_patch ? 'school_year') and (select enforced from public.school_year_config where singleton) then raise exception 'school_year_context_required';end if;
  p_patch:=p_patch||jsonb_build_object('school_year',coalesce((p_patch->>'school_year')::integer,public.cardinal_active_school_year()));
  perform public.cardinal_assert_year_open((p_patch->>'school_year')::integer,true);
  if coalesce(p_patch->>'import_state','ready')='ready' and (p_patch->>'max_score') is null then raise exception 'missing_assignment_max';end if;
  insert into public.school_assignments(school_year,title,group_codes,max_score,import_state)
   values((p_patch->>'school_year')::integer,p_patch->>'title',array[p_group],case when p_patch->>'import_state'='metadata_only' then null else coalesce((p_patch->>'max_score')::numeric,10) end,coalesce(p_patch->>'import_state','ready')) returning id into v_id;
 end if;
 select array_agg(k order by k) into v_keys from jsonb_object_keys(p_patch) k;
 if cardinality(v_keys)>0 then
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into v_cols,v_select from unnest(v_keys) k;
  execute format('update public.school_assignments set (%s)=(select %s from jsonb_populate_record(null::public.school_assignments,$1) r) where id=$2',v_cols,v_select) using p_patch,v_id;
 end if;
 return v_id;
end $$;

create or replace function public.cardinal_create_assignment_batch(p_teacher text,p_operation_id uuid,p_assignment jsonb,p_groups text[]) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare v_op public.school_assignment_operations;v_payload jsonb;v_patch jsonb;v_groups text[];v_group text;v_id uuid;v_rows jsonb:='[]';v_result jsonb;
begin
 if not exists(select 1 from public.school_teachers where email=p_teacher and active) then raise exception 'invalid_teacher';end if;
 if not(p_assignment ? 'school_year') and (select enforced from public.school_year_config where singleton) then raise exception 'school_year_context_required';end if;
 p_assignment:=p_assignment||jsonb_build_object('school_year',coalesce((p_assignment->>'school_year')::integer,public.cardinal_active_school_year()));
 perform public.cardinal_assert_year_open((p_assignment->>'school_year')::integer,true);
 select array_agg(g order by g) into v_groups from (select distinct unnest(p_groups) g) x;
 if coalesce(cardinality(v_groups),0)=0 or exists(select 1 from unnest(v_groups) g where g is null or not exists(select 1 from public.school_year_enrollments s where s.school_year=(p_assignment->>'school_year')::integer and s.group_code=g and s.active)) then raise exception 'invalid_groups';end if;
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

create or replace function public.cardinal_confirm_assignment_operation(p_teacher text,p_preview_id uuid) returns jsonb
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
  perform 1 from public.school_assignment_roster where assignment_id=v_id and student_email=v_write->>'email' and group_code=v_group and v_op.kind='settings_import' for share;
  if not found then
   perform 1 from public.school_year_enrollments where school_year=coalesce(v_a.school_year,(v_plan#>>'{newAssignment,school_year}')::integer,public.cardinal_active_school_year()) and student_email=v_write->>'email' and group_code=v_group and active for share;
  end if;
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

create or replace function public.cardinal_split_dependencies(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_dep record;v_rows jsonb;v_all jsonb:='{}';
begin
 for v_dep in
  select distinct n.nspname as ns,c.relname as tbl,a.attname as col
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  where c.relkind in ('r','p') and (
   (n.nspname='public' and a.attname='assignment_id' and c.relname<>'school_assignment_splits') or
   exists(select 1 from pg_catalog.pg_constraint k where k.contype='f' and k.conrelid=c.oid and a.attnum=any(k.conkey) and k.confrelid='public.school_assignments'::regclass))
  and c.relname not in ('school_results','school_mozaik_links','school_assignment_splits','school_assignment_roster')
  order by 1,2,3
 loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %I.%I t where %I::text=$1',v_dep.ns,v_dep.tbl,v_dep.col) into v_rows using p_id::text;
  v_all:=v_all||jsonb_build_object(v_dep.ns||'.'||v_dep.tbl||'.'||v_dep.col,v_rows);
 end loop;
 return v_all;
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
  -- Capture the source assessment's historical membership before copying scores.
  -- The automatic new-work cohort can have moved since the original assessment.
  delete from public.school_assignment_roster where assignment_id=v_new;
  for v_row in select value from jsonb_array_elements(coalesce(v_snapshot->'roster','[]'::jsonb)) m
   where coalesce(v_op.plan->'resultGroups'->>(m.value->>'student_email'),m.value->>'group_code')=v_group loop
   insert into public.school_assignment_roster select (jsonb_populate_record(null::public.school_assignment_roster,v_row||jsonb_build_object('assignment_id',v_new,'group_code',v_group))).*;
  end loop;
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


create function public.cardinal_roster_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.school_assignments set updated_at=clock_timestamp() where id=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger cardinal_roster_revision after insert or update or delete on public.school_assignment_roster for each row execute function public.cardinal_roster_revision();
revoke all on function public.cardinal_roster_revision() from public,anon,authenticated;
grant execute on function public.cardinal_roster_revision() to service_role;

commit;
