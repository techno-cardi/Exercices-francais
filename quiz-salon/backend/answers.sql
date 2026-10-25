-- Atomic answer path: one database call, no client-side CAS contention.
-- Invoker privileges and capability checks are both required.
create function public.quiz_salon_answer(p_code text,p_id text,p_hash text,p_game_id text,p_round integer,p_choice integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 r public.quiz_salon_rooms%rowtype; g jsonb; player jsonb; answer jsonb;
 idx integer; now_ms numeric:=extract(epoch from statement_timestamp())*1000;
 seconds integer; points integer:=0; bonus integer:=0; good boolean; all_done boolean;
begin
 if p_choice is null or p_choice<0 or p_choice>3 or p_round is null then return jsonb_build_object('error','Cette réponse est invalide.'); end if;
 select * into r from public.quiz_salon_rooms where code=p_code and expires_at>now() for update;
 if not found then return jsonb_build_object('error','Cette partie est introuvable ou a expiré.'); end if;
 g:=r.state;
 if g->>'phase'='closed' then return jsonb_build_object('error','L’hôte a fermé cette partie.'); end if;
 select (ordinality-1)::integer,value into idx,player from jsonb_array_elements(g->'players') with ordinality where value->>'id'=p_id;
 if idx is null or player->>'hash' is distinct from p_hash then return jsonb_build_object('error','Cette connexion a expiré ou ce joueur a été retiré.'); end if;
 if g->>'gameId' is distinct from p_game_id or (g->>'round')::integer<>p_round then return jsonb_build_object('error','Cette question est déjà terminée.'); end if;
 if (player->'answers') ? p_round::text then return g; end if;
 if g->>'phase'<>'question' then return g; end if;
 if g->'deadline'<>'null'::jsonb and now_ms >= (g->>'deadline')::numeric then
  g:=jsonb_set(g,'{phase}','"reveal"');
 else
  good:=p_choice=(g->'deck'->p_round->>'correct')::integer;
  seconds:=(g->'options'->>'seconds')::integer;
  if good then
   if seconds>0 then bonus:=greatest(0,least(500,round(500*(1-(now_ms-(g->>'startedAt')::numeric)/(seconds*1000)))::integer)); end if;
   points:=1000+bonus;
   player:=jsonb_set(player,'{score}',to_jsonb((player->>'score')::integer+points));
   player:=jsonb_set(player,'{correct}',to_jsonb((player->>'correct')::integer+1));
   if not (player->'categories') ? (g->'deck'->p_round->>'category') then player:=jsonb_set(player,'{categories}',(player->'categories')||jsonb_build_array(g->'deck'->p_round->>'category')); end if;
  end if;
  answer:=jsonb_build_object('choice',p_choice,'correct',good,'points',points);
  player:=jsonb_set(player,array['answers',p_round::text],answer,true);
  g:=jsonb_set(g,array['players',idx::text],player);
  select bool_and((value->'answers') ? p_round::text) into all_done from jsonb_array_elements(g->'players');
  if all_done then g:=jsonb_set(g,'{phase}','"reveal"'); end if;
 end if;
 update public.quiz_salon_rooms set state=g,revision=revision+1 where code=p_code;
 return g;
end; $$;
revoke all on function public.quiz_salon_answer(text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.quiz_salon_answer(text,text,text,text,integer,integer) to service_role;
