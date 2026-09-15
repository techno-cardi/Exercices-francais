# Gestion des notes documentation index

For a new ChatGPT account or a new development conversation:

1. Read `/CHATGPT_PROJECT_INSTRUCTIONS.md` at the repository root.
2. Read `CURRENT_STATE.md`.
3. Read the subsystem document before editing:
   - `FORMATIVE_PROTOCOL.md`
   - `MOZAIK_PROTOCOL.md`
   - `BACKEND_AND_DB.md`
   - `SUPABASE_LIVE_SOURCE.md` when changing an API/Edge Function
4. For extension recovery, read `../mozaik/releases/README.md` and start from the last known-good archived build, not from a higher-numbered experimental ZIP.

The repository contains the frontend and exact archived extension artifacts. The Supabase project contains the authoritative currently deployed Edge Function source. Function IDs, versions, deployment hashes and recovery steps are recorded so a future ChatGPT can reconnect the Supabase plugin and retrieve/update the live code safely.

After any meaningful production change, update `CURRENT_STATE.md` in the same work session.
