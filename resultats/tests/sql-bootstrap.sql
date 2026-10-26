create role anon; create role authenticated; create role service_role bypassrls;
create table public.school_teachers(email text primary key,active boolean default true);
create table public.school_students(email text primary key,group_code text not null,active boolean default true);
create table public.school_assignments(
 id uuid primary key default gen_random_uuid(),slug text,title text not null,
 competencies text[] not null default '{}',weight numeric,max_score numeric not null default 10,
 group_codes text[] not null default '{}',published boolean not null default false,
 instructions text not null default '',subject text not null default 'Français',term smallint,
 activity_date date,activity_type text not null default 'Évaluation',report_card_enabled boolean not null default false,
 mozaik_sync_status text not null default 'not_synced',mozaik_external_id text,mozaik_last_synced_at timestamptz,
 mozaik_results_visible boolean not null default false,mozaik_show_in_schedule boolean not null default true,
 mozaik_homework boolean not null default false,mozaik_period smallint,mozaik_competence_code text,mozaik_competence_kind text,
 formative_id text,formative_assignment_id text,formative_section_id text,formative_title text,
 formative_question_ids text[] not null default '{}',formative_question_meta jsonb not null default '[]',formative_last_synced_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.school_results(assignment_id uuid references public.school_assignments on delete cascade,
 student_email text references public.school_students,response text not null default '',grade numeric,
 feedback text not null default '',visible boolean not null default true,updated_at timestamptz not null default now(),primary key(assignment_id,student_email));
create table public.school_mozaik_links(assignment_id uuid references public.school_assignments on delete cascade,group_code text,
 activity_id text not null,competence_code text,sync_status text not null default 'synced',last_synced_at timestamptz,
 last_result_count integer,last_error text,primary key(assignment_id,group_code));
