# Supabase live source recovery

The deployed Edge Function source is stored in the Supabase project and can be retrieved directly by ChatGPT through the Supabase plugin.

This is intentional: the **live deployed source is authoritative**, while this Git repository records the architecture, function identities and known deployment hashes needed to detect drift.

A future ChatGPT that only has GitHub connected should ask Kevin to connect the Supabase plugin, then fetch the current function before editing it. Kevin must never be asked to paste service-role keys or function secrets.

Project ref:

`ojyswaxuqwnqilrvtjll`

Snapshot date: **2026-09-15**

| Function | ID | Version | Deployment/source hash (`ezbr_sha256`) |
| --- | --- | ---: | --- |
| `school-results` | `d14efa33-43d5-4861-836e-3d59e4531ad0` | 1 | `36b0aed8210efe558d3cd64b9336c5e68f51b203b14d4d2427da65a7fc556539` |
| `school-student-auth` | `68455680-d59e-491e-be5f-c6f3561f500c` | 1 | `daf6a8fc57e51b7f631a6509619a2297f194d13280236c9b81082c54b792fd58` |
| `mozaik-sync` | `f6d5c9c0-d700-432a-98e4-1f9537192030` | 3 | `15219cca2d031d8b9a8d23865a0e8a6afa197e99d3e2cbececb07bb9af019c9c` |
| `school-teacher-api` | `23d77dc4-aef6-448d-aed7-ae0de05c2ba4` | 3 | `3983f6a832b9d2306cb4ec5fe6788c250e09c641a5173bcf6d3535c08d446494` |
| `school-roster` | `0f7a3f03-325b-4b47-a9f4-123b16165d83` | 1 | `c685f7f0eb5ee28db513b13e8ae992dff11297aa5c560f1bc889f6cd5f58700d` |
| `school-formative-link` | `a6a95bd6-53e2-4bd0-bc75-3357950a9a8e` | 1 | `8a48ea57c0f7c3e6b1db002d2074324ef6e715a6fa87ef732725365241168581` |
| `school-teacher-delete-assignment` | `95a93d9a-0c2c-4298-a7a7-2cecaec77c87` | 1 | `39f316b96eb7fb112fc1d981d2897c823903c24f761eb3c52a3131387632e207` |
| `school-formative-feedback` | `ab137643-3a08-4968-af33-5d9abe3c9fce` | 1 | `ea3fed336c857c01f454fad83f48513866860f265b014dcfbbd3887b0bd93341` |

## How a future ChatGPT should update an API

1. Fetch `CHATGPT_PROJECT_INSTRUCTIONS.md` and `CURRENT_STATE.md` from GitHub.
2. Connect the Supabase plugin if it is not connected.
3. Call the Supabase function-list/get-function actions for project `ojyswaxuqwnqilrvtjll`.
4. Compare the live version/hash to this snapshot. If it differs, treat the live function as newer and inspect it before doing anything.
5. Fetch the full live `index.ts`.
6. Make the smallest required change while preserving custom authentication and CORS behavior.
7. Deploy a new function version with the same function slug and the existing `verify_jwt` mode unless intentionally migrating auth.
8. Test the real user path.
9. Update this manifest, `BACKEND_AND_DB.md` and `CURRENT_STATE.md` with the new version/hash/status.

## Why secrets are not mirrored into Git

The functions use environment-provided values such as `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_ANON_KEY`.

Those values must stay in Supabase. Source can be recovered through the connected Supabase project without committing secrets.
