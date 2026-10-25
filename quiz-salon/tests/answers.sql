-- Run in Supabase SQL runner; the complete fixture is rolled back.
begin;
do $$
declare g jsonb; r jsonb; score integer;
begin
 g:=jsonb_build_object('phase','question','round',0,'gameId','test-game','startedAt',extract(epoch from now())*1000-1000,'deadline',null,'options',jsonb_build_object('seconds',0),'deck',jsonb_build_array(jsonb_build_object('correct',2,'category','local')),'players',jsonb_build_array(jsonb_build_object('id','p1','hash','h1','name','Test','score',0,'correct',0,'categories','[]'::jsonb,'answers','{}'::jsonb)));
 insert into public.quiz_salon_rooms(code,state) values('ZZZ9Z9',g);
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',0,2);
 if r->>'phase'<>'reveal' or (r->'players'->0->>'score')::integer<>1000 then raise exception 'score/reveal failed'; end if;
 if (r->>'nextAt')::numeric-(r->>'revealedAt')::numeric<>8000 then raise exception 'automatic reveal timer failed'; end if;
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',0,2);
 if (r->'players'->0->>'score')::integer<>1000 then raise exception 'duplicate failed'; end if;
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','bad','test-game',0,2);
 if not r ? 'error' then raise exception 'auth failed'; end if;
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','wrong-game',0,2);
 if not r ? 'error' then raise exception 'stale game failed'; end if;
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',1,2);
 if not r ? 'error' then raise exception 'stale round failed'; end if;
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',0,4);
 if not r ? 'error' then raise exception 'invalid choice failed'; end if;
 update public.quiz_salon_rooms set state=jsonb_set(jsonb_set(g,'{options,seconds}','30'),'{deadline}',to_jsonb(extract(epoch from now())*1000+29000)) where code='ZZZ9Z9';
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',0,2);
 score:=(r->'players'->0->>'score')::integer;
 if score<=1000 or score>1500 then raise exception 'speed bonus failed'; end if;
 update public.quiz_salon_rooms set state=jsonb_set(jsonb_set(g,'{options,seconds}','30'),'{deadline}',to_jsonb(extract(epoch from now())*1000-1)) where code='ZZZ9Z9';
 r:=public.quiz_salon_answer('ZZZ9Z9','p1','h1','test-game',0,2);
 if r->>'phase'<>'reveal' or (r->'players'->0->>'score')::integer<>0 then raise exception 'deadline failed'; end if;
end; $$;
rollback;
