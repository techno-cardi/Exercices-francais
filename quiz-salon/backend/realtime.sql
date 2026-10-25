-- Public invalidation only: no questions, names, scores or credentials.
create function public.quiz_salon_notify() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform realtime.send(jsonb_build_object('revision',NEW.revision),'changed','quiz-salon:'||NEW.code,false);
 return NEW;
end; $$;
revoke all on function public.quiz_salon_notify() from public,anon,authenticated;
grant execute on function public.quiz_salon_notify() to service_role;
create trigger quiz_salon_notify_change after insert or update on public.quiz_salon_rooms for each row execute function public.quiz_salon_notify();
