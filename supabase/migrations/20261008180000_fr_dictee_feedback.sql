-- Suivi privé des dictées, déployé sur Supabase le 8 octobre 2026.
-- Aucun nom, note, numéro de fiche, code secret ou URL de copie ici.
create table if not exists public.fr_dictee_feedback (
  assignment_id uuid not null references public.school_assignments(id) on delete cascade,
  student_email text not null references public.school_students(email) on delete cascade,
  copy_url text not null,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors)='array'),
  errors_verified boolean not null default false,
  released boolean not null default false check (not released or errors_verified),
  started_at timestamptz,
  copy_opened_at timestamptz,
  bilan_seen_at timestamptz,
  understood_keys text[] not null default '{}'::text[],
  strategy_passed_keys text[] not null default '{}'::text[],
  completed_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_email)
);
alter table public.fr_dictee_feedback enable row level security;
revoke all on public.fr_dictee_feedback from anon, authenticated;
create index if not exists fr_dictee_feedback_assignment_idx
 on public.fr_dictee_feedback (assignment_id, completed_at);
