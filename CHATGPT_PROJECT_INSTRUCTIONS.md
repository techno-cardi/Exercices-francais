# CHATGPT PROJECT INSTRUCTIONS

## READ THIS FIRST

This file is the canonical handoff for the **Gestion des notes / Formative / Mozaïk** project.

If Kevin opens a new ChatGPT account or a new conversation and says something like:

> Lis les instructions du Git et continue le projet Gestion des notes.

read this file first, then read the linked files under `resultats/docs/` before changing code.

The goal is that Kevin never has to reconstruct the architecture, remember API details, paste old code, or explain the project from scratch.

## Repository and live app

Repository: `techno-cardi/Exercices-francais`

Production page:
`https://techno-cardi.github.io/Exercices-francais/resultats/`

Extension installer page:
`https://techno-cardi.github.io/Exercices-francais/resultats/mozaik/extension/install.html`

Supabase project ref:
`ojyswaxuqwnqilrvtjll`

Supabase project URL:
`https://ojyswaxuqwnqilrvtjll.supabase.co`

The frontend publishable key is intentionally public and is already present in `resultats/app.js`. Never put a service-role key, password, Mozaïk bearer token, Formative Authorization header, cookies, fiche numbers, HAR secrets, or session tokens in GitHub.

## Required working method for any future ChatGPT

Before modifying anything:

1. Read this file completely.
2. Read `resultats/docs/CURRENT_STATE.md`.
3. Read the protocol file for the subsystem being changed:
   - `resultats/docs/FORMATIVE_PROTOCOL.md`
   - `resultats/docs/MOZAIK_PROTOCOL.md`
   - `resultats/docs/BACKEND_AND_DB.md`
4. Fetch the actual current GitHub files before editing them. Do not rely on a remembered SHA.
5. If the change touches Supabase, inspect the live function or schema with the Supabase connector before deploying. Live Supabase is authoritative for deployed functions.
6. Preserve working behavior first. Do not rewrite a stable subsystem merely to make it cleaner.
7. After a meaningful change, update `resultats/docs/CURRENT_STATE.md` so the next ChatGPT knows exactly what is live, tested, experimental, and still missing.

If GitHub or Supabase is not connected in the new ChatGPT account, ask Kevin to connect that plugin. Do not ask him to paste secrets or raw authentication tokens.

## Product model that must stay simple

There are three distinct jobs:

**Formative** owns detailed question-by-question correction.

**Gestion des notes** owns the final/global result of an evaluation and manually created work such as dictations, oral tasks, paper work, etc.

**Mozaïk** receives the final result from Gestion des notes.

For a Formative evaluation, the desired long-term workflow is:

`Formative -> ChatGPT-assisted correction for selected questions -> Formative complete result -> global result into Gestion des notes -> Mozaïk`

Questions already corrected automatically by Formative stay in Formative. They do not need separate assignments in Gestion des notes.

For work that does not come from Formative:

`Create manually in Gestion des notes -> enter grades -> Mozaïk`

A manually created assignment must remain supported. `Dictée` is already an available activity type.

## Desired ChatGPT correction UX

Do not over-engineer this.

Kevin should not have to learn JSON, batch IDs, connector codes, technical session IDs, or a special correction procedure.

The target UX is one Chrome extension only, with no extra ChatGPT connector/plugin required:

1. In Formative, Kevin opens/selects the question he wants help correcting.
2. **Ordinary Formative page load must remain visually untouched.** Kevin projects Formative to students. Do not inject persistent Cardinal buttons, ChatGPT labels, floating launchers, badges, or other teacher-only controls onto Formative by default.
3. Teacher-only Formative actions should start from the Chrome extension popup. Only after Kevin deliberately chooses an action may temporary Cardinal UI be injected into Formative.
4. Visible temporary Formative UI should use neutral wording such as `Correction assistée`, `Copier les réponses`, `Retour de correction`. Avoid visible `ChatGPT` branding in Formative itself.
5. The copied content already contains the question, point value, responses, and automatic instructions needed for ChatGPT to return importable results. Kevin should be able to talk normally afterward.
6. Kevin may freely calibrate the correction in chat: give a rubric, examples, change one grade, say the grading is too generous, ask to regrade everybody, request comments or no comments, etc.
7. When he is satisfied, he must be able to send the grades from the ChatGPT response back into the exact Formative question with minimal effort.
8. The same Chrome extension may add an `Envoyer les résultats dans Formative` button on ChatGPT pages while a correction context is active. This is preferable to adding another backend connector.
9. Before writing, show a local preview with student names and old -> new grades. Nothing is written until Kevin confirms.
10. Notes and comments are independent. Comments are optional.
11. Robust matching must not silently guess. Name matching can be used for the user-facing table, but ambiguous or unmatched students must be blocked or resolved locally before publishing.
12. At the end of the whole evaluation, import only the **global Formative result** into Gestion des notes, then send that result to Mozaïk.

This target supersedes the more complicated experimental idea based on correction sessions, visible `R001` codes, extra connectors, or per-question assignments in Gestion des notes.

## Important current version rule

The last extension version known to work in real use is **v0.8.2**. It successfully handled:

- Gestion des notes -> Formative grade push for a linked single question.
- Formative -> Gestion des notes import/linking.
- Mozaïk sync, including non-bulletin activities.

The current test candidate is **v0.9.3 beta**, archived at:

`resultats/mozaik/releases/experimental/cardinal-mozaik-extension-v0.9.3-beta.zip`

It implements the simplified correction bridge, discreet Formative popup launch, global Formative import path, and safer Mozaïk group/roster autodiscovery. It is **implemented but not yet the production baseline** until real end-to-end tests pass.

Older experimental `v0.9.0` / `v0.9.1-beta` ideas are not the production baseline and should not be promoted merely because of their version number.

Always read `resultats/docs/CURRENT_STATE.md` for the current version status before telling Kevin to install anything.

## Mozaïk autodiscovery rule

The extension should minimize annual manual Mozaïk configuration, but discovery must be conservative.

- Prefer IDs observed from real portal/API traffic.
- A previous stored mapping may be currentized and used as a navigation hint, not as proof that the new mapping is correct.
- Read the official roster locally from the authenticated Mozaïk portal when validation is needed.
- Send only the discovered group metadata plus school-email/name roster to the authenticated backend.
- Let `school-roster` validate roster overlap against active Gestion students before changed `school_mozaik_groups` identifiers are saved.
- If validation fails, preserve the existing configuration and continue/fail safely rather than guessing.
- Never send the Mozaïk bearer outside the browser extension.

## Security invariants

Never ask Kevin to paste or expose:

- Mozaïk bearer tokens or cookies
- Formative Authorization headers or cookies
- Supabase service-role keys
- passwords
- fiche numbers
- HAR files containing active session credentials unless absolutely required for diagnostics, and never commit them

Mozaïk and Formative authentication should remain local in the browser extension whenever possible.

The Formative authorization captured by the extension must not be sent to GitHub, Supabase, ChatGPT prompts, or another server.

Student identity data should be minimized in copied ChatGPT correction payloads. However, usability matters: do not introduce visible technical codes merely for theoretical purity. If names are used for the user-facing correction table, use local validation and never silently match ambiguous names.

## Change-management rules

For GitHub writes, always fetch the current file and use its current blob SHA. Sequential updates to the same path must use the SHA returned by the previous write.

For Supabase DDL, use migrations. For Edge Functions, inspect the live source first, then deploy a new version. Keep custom authentication behavior intact when `verify_jwt=false` is intentional.

Never deploy a backend or extension rewrite and call it stable without a real end-to-end test of the affected path.

When a change is experimental, keep it clearly labeled experimental/beta and preserve the last known-good source.

## What Kevin should be able to say in a future chat

The intended recovery sentence is simply:

> Lis `CHATGPT_PROJECT_INSTRUCTIONS.md` dans `techno-cardi/Exercices-francais`, puis continue Gestion des notes à partir de l'état actuel.

After reading the docs and inspecting the live repo/Supabase state, the new ChatGPT should be able to continue development without asking Kevin to retell the project history.
