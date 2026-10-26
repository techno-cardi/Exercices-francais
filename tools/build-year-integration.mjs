// Build the explicit SQL integrations from reviewed prior function definitions.
// Run only during development; deployed migration is self-contained.
import fs from 'node:fs';
const imports=fs.readFileSync('supabase/migrations/20261026180000_gestion_imports.sql','utf8').replaceAll('\r\n','\n');
const splits=fs.readFileSync('supabase/migrations/20261026190000_gestion_split.sql','utf8').replaceAll('\r\n','\n');
const dictationSplits=fs.readFileSync('supabase/migrations/20261026203552_gestion_split_dictee.sql','utf8').replaceAll('\r\n','\n').replaceAll('create or replace function','create function');
const sync=fs.readFileSync('supabase/migrations/20261026210000_mozaik_sync_journal.sql','utf8').replaceAll('\r\n','\n');
const target='supabase/migrations/20261026211837_school_years_and_archives.sql';
const marker='-- GENERATED YEAR INTEGRATIONS';
const core=fs.readFileSync(target,'utf8').split(marker)[0].replace(/commit;\s*$/,'');
function definition(source,name){const start=source.indexOf('create function public.'+name+'(');if(start<0)throw Error(name);const end=source.indexOf('end $$;',start);return source.slice(start,end+7).replace('create function','create or replace function');}
let write=definition(imports,'cardinal_write_assignment');
write=write.replace("array['title'","array['school_year','title'");
write=write.replace(" if v_id is null then\n  if coalesce",` if v_id is null then
  if not(p_patch ? 'school_year') and (select enforced from public.school_year_config where singleton) then raise exception 'school_year_context_required';end if;
  p_patch:=p_patch||jsonb_build_object('school_year',coalesce((p_patch->>'school_year')::integer,public.cardinal_active_school_year()));
  perform public.cardinal_assert_year_open((p_patch->>'school_year')::integer,true);
  if coalesce`);
write=write.replace('insert into public.school_assignments(title,group_codes,max_score,import_state)','insert into public.school_assignments(school_year,title,group_codes,max_score,import_state)');
write=write.replace("values(p_patch->>'title'","values((p_patch->>'school_year')::integer,p_patch->>'title'");
let batch=definition(imports,'cardinal_create_assignment_batch');
batch=batch.replace(" select array_agg(g order by g)",` if not(p_assignment ? 'school_year') and (select enforced from public.school_year_config where singleton) then raise exception 'school_year_context_required';end if;
 p_assignment:=p_assignment||jsonb_build_object('school_year',coalesce((p_assignment->>'school_year')::integer,public.cardinal_active_school_year()));
 perform public.cardinal_assert_year_open((p_assignment->>'school_year')::integer,true);
 select array_agg(g order by g)`);
batch=batch.replace('public.school_students s where s.group_code=g and s.active',"public.school_year_enrollments s where s.school_year=(p_assignment->>'school_year')::integer and s.group_code=g and s.active");
let confirm=definition(imports,'cardinal_confirm_assignment_operation');
confirm=confirm.replace("  perform 1 from public.school_students where email=v_write->>'email' and group_code=v_group and active for share;",`  perform 1 from public.school_assignment_roster where assignment_id=v_id and student_email=v_write->>'email' and group_code=v_group and v_op.kind='settings_import' for share;
  if not found then
   perform 1 from public.school_year_enrollments where school_year=coalesce(v_a.school_year,(v_plan#>>'{newAssignment,school_year}')::integer,public.cardinal_active_school_year()) and student_email=v_write->>'email' and group_code=v_group and active for share;
  end if;`);
let dependencies=definition(splits,'cardinal_split_dependencies');
let splitConfirm=definition(dictationSplits,'cardinal_confirm_assignment_split');
splitConfirm=splitConfirm.replace('  for v_row in select value from jsonb_array_elements(v_snapshot->\'results\')',`  -- Capture the source assessment's historical membership before copying scores.
  -- The automatic new-work cohort can have moved since the original assessment.
  delete from public.school_assignment_roster where assignment_id=v_new;
  for v_row in select value from jsonb_array_elements(coalesce(v_snapshot->'roster','[]'::jsonb)) m
   where coalesce(v_op.plan->'resultGroups'->>(m.value->>'student_email'),m.value->>'group_code')=v_group loop
   insert into public.school_assignment_roster select (jsonb_populate_record(null::public.school_assignment_roster,v_row||jsonb_build_object('assignment_id',v_new,'group_code',v_group))).*;
  end loop;
  for v_row in select value from jsonb_array_elements(v_snapshot->'results')`);
dependencies=dependencies.replace("'school_assignment_splits')\n  order", "'school_assignment_splits','school_assignment_roster')\n  order");
let assertSync=definition(sync,'cardinal_assert_mozaik_source');
assertSync=assertSync.replace(' -- Only identities',` perform public.cardinal_assert_year_open(a.school_year,true);
 if a.school_year::text is distinct from j.payload#>>'{scope,schoolYear}' then raise exception 'school_year_mismatch';end if;
 -- Only identities`);
assertSync=assertSync.replace("public.school_students s where s.email=r->>'email' and s.active and s.group_code=j.group_code","public.school_year_enrollments s where s.school_year=a.school_year and s.student_email=r->>'email' and s.active and s.group_code=j.group_code");
const extra=`
create function public.cardinal_roster_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.school_assignments set updated_at=clock_timestamp() where id=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger cardinal_roster_revision after insert or update or delete on public.school_assignment_roster for each row execute function public.cardinal_roster_revision();
revoke all on function public.cardinal_roster_revision() from public,anon,authenticated;
grant execute on function public.cardinal_roster_revision() to service_role;
`;
for(const [name,text] of [['write',write],['batch',batch],['confirm',confirm],['dependencies',dependencies],['sync',assertSync]])if(text.includes('create function'))throw Error('Function replacement failed '+name);
fs.writeFileSync(target,core+marker+'\n'+[write,batch,confirm,dependencies,splitConfirm,assertSync,extra].join('\n\n')+'\ncommit;\n');

