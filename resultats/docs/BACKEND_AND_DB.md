# Backend and database

## Supabase project

Project ref:

`ojyswaxuqwnqilrvtjll`

Project URL:

`https://ojyswaxuqwnqilrvtjll.supabase.co`

The public frontend key is intentionally present in `resultats/app.js`. Never commit service-role keys or other secrets.

For backend changes, the **live Supabase function source is authoritative**. A future ChatGPT should use the Supabase connector to fetch the current deployed function before editing or deploying it.

## Frontend endpoints

`resultats/app.js` currently defines:

```text
DATA_ENDPOINT    = /functions/v1/school-results
AUTH_ENDPOINT    = /functions/v1/school-student-auth
TEACHER_ENDPOINT = /functions/v1/school-teacher-api
SYNC_ENDPOINT    = /functions/v1/mozaik-sync
```

Additional frontend/patch functionality uses:

```text
/functions/v1/school-formative-link
/functions/v1/school-teacher-delete-assignment
/functions/v1/school-formative-feedback
```

The extension/roster workflow also uses:

```text
/functions/v1/school-roster
```

## Live Edge Functions snapshot, 2026-09-15

Relevant functions:

| Slug | ID | Live version | verify_jwt |
| --- | --- | ---: | --- |
| `school-results` | `d14efa33-43d5-4861-836e-3d59e4531ad0` | 1 | false |
| `school-student-auth` | `68455680-d59e-491e-be5f-c6f3561f500c` | 1 | false |
| `mozaik-sync` | `f6d5c9c0-d700-432a-98e4-1f9537192030` | 3 | false |
| `school-teacher-api` | `23d77dc4-aef6-448d-aed7-ae0de05c2ba4` | 3 | false |
| `school-roster` | `0f7a3f03-325b-4b47-a9f4-123b16165d83` | 1 | false |
| `school-formative-link` | `a6a95bd6-53e2-4bd0-bc75-3357950a9a8e` | 1 | false |
| `school-teacher-delete-assignment` | `95a93d9a-0c2c-4298-a7a7-2cecaec77c87` | 1 | false |
| `school-formative-feedback` | `ab137643-3a08-4968-af33-5d9abe3c9fce` | 1 | false |

`verify_jwt=false` is intentional for these functions because they implement their own publishable-key/session-token validation. Do not flip this blindly.

Before deploying, fetch the live source and preserve the existing auth model unless the whole authentication design is intentionally being migrated.

## Core tables

### `school_students`

Important columns:

```text
email text PK/logical identity
name text
first_name text nullable
last_name text nullable
group_code text
fiche_hash text
active boolean default true
password_hash text nullable
auth_user_id uuid nullable
activated_at timestamptz nullable
roster_name_source text nullable
created_at timestamptz
updated_at timestamptz
```

Never expose or commit plaintext fiche numbers. Only hashes belong in the database.

### `school_assignments`

Important columns:

```text
id uuid
slug text nullable
title text
competencies text[]
weight numeric nullable
max_score numeric default 10
group_codes text[]
published boolean default false
instructions text default ''
subject text default 'Français'
term smallint nullable
activity_date date nullable
activity_type text default 'Évaluation'
report_card_enabled boolean default false
created_at timestamptz
updated_at timestamptz
```

Mozaïk fields:

```text
mozaik_sync_status text default 'not_synced'
mozaik_external_id text nullable
mozaik_last_synced_at timestamptz nullable
mozaik_results_visible boolean default false
mozaik_show_in_schedule boolean default true
mozaik_homework boolean default false
mozaik_period smallint nullable
mozaik_competence_code text nullable
mozaik_competence_kind text nullable
```

Formative linkage fields:

```text
formative_id text nullable
formative_assignment_id text nullable
formative_section_id text nullable
formative_title text nullable
formative_question_ids text[] default '{}'
formative_question_meta jsonb default '[]'
formative_last_synced_at timestamptz nullable
```

Long-term architecture note: these question-link fields remain useful for linking/pushing a single question, but the preferred overall Formative evaluation flow is to import one **global evaluation result** into Gestion des notes after Formative is fully corrected.

### `school_results`

```text
assignment_id uuid NOT NULL
student_email text NOT NULL
response text default ''
grade numeric nullable
feedback text default ''
visible boolean default true
updated_at timestamptz default now()
```

The assignment + email pair is the logical result identity.

Foreign key to `school_assignments` uses `ON DELETE CASCADE`, so deleting an assignment also removes its results.

### `school_mozaik_groups`

```text
group_code text
establishment_id text
group_course_id text
group_matter_id text
subject_code text
updated_at timestamptz
```

### `school_mozaik_links`

```text
assignment_id uuid
group_code text
activity_id text
competence_code text nullable
sync_status text default 'synced'
last_synced_at timestamptz nullable
last_result_count integer nullable
last_error text nullable
```

Foreign key to assignments uses `ON DELETE CASCADE`.

### `school_mozaik_sync_jobs`

```text
id uuid
code_hash text
assignment_id uuid
group_code text
payload jsonb
status text default 'pending'
claim_hash text nullable
created_at timestamptz
expires_at timestamptz
claimed_at timestamptz nullable
completed_at timestamptz nullable
result jsonb nullable
teacher_email text nullable
```

Foreign key to assignments uses `ON DELETE CASCADE`.

### `school_teachers`

```text
email text
name text
password_hash text nullable
setup_token_hash text nullable
setup_expires_at timestamptz nullable
active boolean default true
failed_count integer default 0
locked_until timestamptz nullable
updated_at timestamptz
```

### `school_teacher_sessions`

```text
token_hash text
teacher_email text
expires_at timestamptz
created_at timestamptz
```

### `school_student_sessions`

```text
token_hash text
student_email text
expires_at timestamptz
created_at timestamptz
```

### `school_formative_feedbacks`

Added during the experimental Formative feedback work:

```text
assignment_id uuid
student_email text
formative_id text
formative_item_id text
question_number text default ''
question_label text default ''
feedback text default ''
feedback_message_id text nullable
updated_at timestamptz default now()
```

Do not let this table force the product into storing every question-level comment in Gestion des notes. Per-question comments are optional. The current preferred model is that detailed question feedback stays primarily in Formative unless Kevin explicitly wants it copied to his portal.

## Teacher API behaviors that must be preserved

`school-teacher-api` currently provides actions including:

```text
activate
login
validate
logout
teacherDashboard
teacherAssignment
saveAssignment
saveResult
formativeImport
```

Important behaviors:

- assignment save validates group, max score, weight, term, date, period and competence kind;
- result save validates that the student belongs to one of the assignment groups;
- if a Mozaïk-linked result changes, mark the relevant link/assignment dirty;
- Formative import only updates a student when all selected questions have numeric points;
- incomplete Formative students are left untouched;
- existing `response`, `feedback` and `visible` values are preserved during Formative grade import.

The frontend safety patch can route a Formative operation into metadata-only linking so an existing assignment can be associated without replacing real Gestion grades.

## Assignment deletion

`school-teacher-delete-assignment` was added because the teacher UI previously had no way to remove a test assignment.

Deleting from Gestion des notes should remove the assignment and its local results/links through database cascades. It must **not** silently delete the corresponding activity in Mozaïk or the Formative source.

The UI confirmation explicitly states this boundary.

## Database-change policy

Use a named Supabase migration for DDL. Do not issue ad-hoc schema changes through raw SQL when a migration is appropriate.

After any schema change, update this document and `CURRENT_STATE.md`.
