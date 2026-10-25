-- Independent game storage. Existing school data and functions are untouched.
create table public.quiz_salon_rooms (
 code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
 state jsonb not null check (jsonb_typeof(state) = 'object'),
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours')
);
create index quiz_salon_rooms_expiry on public.quiz_salon_rooms(expires_at);
alter table public.quiz_salon_rooms enable row level security;
revoke all on public.quiz_salon_rooms from public, anon, authenticated;
grant select,insert,update,delete on public.quiz_salon_rooms to service_role;
comment on table public.quiz_salon_rooms is 'Quiz de salon: parties éphémères, jetons hachés, accès serveur uniquement.';
create table public.quiz_salon_limits (
 key text primary key,
 bucket bigint not null,
 hits integer not null,
 updated_at timestamptz not null default now()
);
alter table public.quiz_salon_limits enable row level security;
revoke all on public.quiz_salon_limits from public, anon, authenticated;
grant select,insert,update,delete on public.quiz_salon_limits to service_role;
create function public.quiz_salon_store(p_code text,p_revision bigint,p_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.quiz_salon_rooms set state=p_state, revision=revision+1
 where code=p_code and revision=p_revision and expires_at>now();
 get diagnostics n=row_count;
 return n=1;
end; $$;
revoke all on function public.quiz_salon_store(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.quiz_salon_store(text,bigint,jsonb) to service_role;
create function public.quiz_salon_rate(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare b bigint := floor(extract(epoch from now())/600); n integer;
begin
 insert into public.quiz_salon_limits(key,bucket,hits) values(p_key,b,1)
 on conflict(key) do update set
 hits=case when quiz_salon_limits.bucket=b then quiz_salon_limits.hits+1 else 1 end,
 bucket=b,updated_at=now()
 returning hits into n;
 return n<=p_limit;
end; $$;
revoke all on function public.quiz_salon_rate(text,integer) from public,anon,authenticated;
grant execute on function public.quiz_salon_rate(text,integer) to service_role;
