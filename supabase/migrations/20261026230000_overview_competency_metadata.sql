-- Read-only metadata for competency grouping and transparent follow-up calculations.
begin;
create or replace function public.cardinal_group_year_overview(p_year integer,p_group text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schoolYear',p_year,'groupCode',p_group,
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'maxScore',a.max_score,'term',a.term,'activityDate',a.activity_date,'competenceKind',a.mozaik_competence_kind,'competencies',a.competencies,'weight',a.weight) order by a.activity_date nulls last,a.created_at)
 from public.school_assignments a where a.school_year=p_year and p_group=any(a.group_codes) and not a.split_archived),'[]'),
 'students',coalesce((select jsonb_agg(jsonb_build_object('email',m.student_email,'name',m.name,'firstName',m.first_name,'lastName',m.last_name,
 'results',coalesce((select jsonb_object_agg(r.assignment_id::text,jsonb_build_object('grade',s.grade,'assigned',true)) from public.school_assignment_roster r
 join public.school_assignments a on a.id=r.assignment_id left join public.school_results s on s.assignment_id=r.assignment_id and s.student_email=r.student_email
 where r.student_email=m.student_email and r.school_year=p_year and r.group_code=p_group and not a.split_archived),'{}')) order by m.last_name,m.first_name,m.student_email)
 from (select distinct on(student_email) student_email,name,first_name,last_name from (
 select student_email,name,first_name,last_name,0 priority from public.school_year_enrollments where school_year=p_year and group_code=p_group
 union all select student_email,name,first_name,last_name,1 priority from public.school_assignment_roster where school_year=p_year and group_code=p_group) n order by student_email,priority) m),'[]'))
$$;
revoke all on function public.cardinal_group_year_overview(integer,text) from public,anon,authenticated;
grant execute on function public.cardinal_group_year_overview(integer,text) to service_role;
commit;
