# Current state

Last updated: **2026-09-15**

This is the first status file a future ChatGPT should read after the project instructions.

## Executive status

The production flow is stable and usable for:

- Formative question correction assisted by ChatGPT;
- guarded return of notes/comments to the exact Formative question;
- global Formative evaluation -> one Gestion des notes assignment/result;
- manual assignment creation and grade entry in Gestion des notes;
- student result viewing;
- Gestion des notes -> Mozaïk synchronization;
- assignment deletion from Gestion without silently deleting the external Formative/Mozaïk item;
- group-specific statistics and dynamic group handling.

Preferred evaluation flow:

`Formative -> ChatGPT-assisted question correction -> verified return to Formative -> global Formative result -> Gestion des notes -> Mozaïk`

Formative remains the source of truth for question-level correction. Gestion normally stores the final/global evaluation result rather than one assignment per question.

## Current stable extension

Current release: **Cardinal - Gestion des notes v1.0.2 STABLE**.

Distribution: manual unpacked extension.

Published release metadata lives in `resultats/mozaik/cardinal-extension-latest.json`.

SHA-256 for v1.0.2:

`91ca00c93181d6909db66f2ac9cb60a4b70d12ef2b62b02045c4fa34ff4448ef`

### Stable behaviors that must not regress

- `Préparer une correction` resumes automatically after a Formative reload, so one click is sufficient;
- Formative session headers are held in `chrome.storage.session`, not persisted as long-lived local secrets;
- the normal UI does not expose the diagnostic button;
- DraftJS/fill-in-the-blank question text is decoded into the real instruction;
- the ChatGPT result is bound to the active Formative question/session and stale-question publication is blocked;
- the Formative mutation response must contain every requested answer ID with the requested points;
- after writing notes, Cardinal re-reads the server state and verifies the points before reporting success;
- the Formative decoder supports structured QCM choices (`choices` -> `choiceLabels`) and ordered blanks;
- Mozaïk group discovery remains dynamic and validated rather than hardcoded;
- no MutationObserver may rewrite the observed Formative DOM. The old self-triggering approach previously froze Formative and must never return.

## Cardinal evaluation protocol

v1.0.2 ships **Protocole Cardinal d’évaluation v1.1** inside every correction prompt. This makes the correction method independent of ChatGPT account memory.

Core rules:

- current Formative points are reference-only and must not anchor the correction;
- criteria are established from the instruction, detected correction reference and sources actually supplied;
- do not invent text facts, line/page locations or unsupported evidence;
- if a required source is missing, do not guess a definitive grade;
- grade meaning rather than exact keywords unless exact language is what is being assessed;
- identical or semantically equivalent answers receive the same treatment;
- multi-part answers are evaluated element by element and duplicates are not counted twice;
- reasonable ambiguity in the question is not charged against students;
- perform a second silent consistency pass before returning the final table;
- a teacher-provided corrigé, rubric, expected answer or examples become the primary pedagogical reference, unless they clearly conflict with the instruction or a verifiable source, in which case the conflict must be surfaced rather than silently resolved.

Cardinal also performs local consistency checks before allowing publication, including detection of identical/equivalent responses receiving inconsistent grades and objective reference answers that are not awarded the expected full score.

## Gestion des notes frontend

Main page: `resultats/index.html`.

Direct load chain:

- `app.js`
- `app-patch-v04.js`
- `app-patch-v05.js`
- `app-patch-v06.js`

`app-patch-v05.js` then loads the active Formative client/safety layer and UI patches v08, v09, v10 and v11.

Important responsibilities:

- v04: grade rounding, roster merge, unified visibility, assignment opening;
- v05: routing persistence, Formative client loading, UI patch orchestration and immediate Mozaïk progress feedback;
- v06: work statistics/feedback bridge loading, post-sync refresh and safe assignment deletion;
- v08: dynamic groups, dashboard rebuild and Mozaïk discovery coordination;
- v09: copy-work settings and persistent Mozaïk mapping status;
- v10: new-work group UX;
- v11: compact new-work presentation and creation-mode layout.

Do not collapse these patches casually just to make the file count smaller. They wrap shared functions in a deliberate order; a large refactor needs regression testing of every workflow.

### Branding/icon cleanup

The active Gestion icon has one authoritative visible source:

`resultats/assets/cardinal-extension-icon-v1004.svg?v=1004`

`index.html` references it directly for the favicon and visible site logos. Do not reintroduce JavaScript that rewrites the favicon/logo after page load; that caused profile-specific cache confusion.

Older `.b64`/v1003 icon assets are retained for backward compatibility with cached historical code. They are not the visible source for the current page and should not be deleted until old cached clients are no longer relevant.

## Current live backend versions

Supabase project: `ojyswaxuqwnqilrvtjll`

- `school-results`: v1
- `school-student-auth`: v1
- `school-teacher-api`: v4
- `school-roster`: v5
- `mozaik-sync`: v4
- `school-formative-link`: v1
- `school-teacher-delete-assignment`: v1
- `school-formative-feedback`: v1

The deployed Supabase source is authoritative. Fetch the live function before editing/deploying.

`verify_jwt=false` remains intentional for the relevant functions because the application uses its existing publishable-key + application-session-token validation. Do not flip this blindly.

## Mozaïk durability rules

- no active business-rule allow-list for groups 31/32/51;
- active groups come from the current roster/data;
- previous mapping is a navigation/ranking hint, not proof;
- changed mapping must pass backend roster validation before being saved;
- ambiguous candidates are rejected instead of guessed;
- the academic year is derived primarily from authenticated Mozaïk identifiers actually observed;
- for `reportCardEnabled=false`, preserve official portal behavior `parametresEvaluation.ponderation = null`.

The browser-local Mozaïk bearer must never be sent to GitHub, Supabase or ChatGPT.

## Repository hygiene note

`resultats/mozaik/extension/` contains older historical source files and its old manifest is not the release-version authority. Before using that directory as a build source, compare it against `cardinal-extension-latest.json` and the current installed/stable package. Do not accidentally rebuild a current release from a legacy 0.8.x manifest.

Historical files are being retained rather than aggressively deleted because several old cache paths and rollback references still exist. Prefer making active entry points explicit over deleting history during a stability pass.

## Regression checklist before any future stable release

1. Open Formative on a real results question and use `Préparer une correction` once, including the reload path.
2. Verify the prompt contains the real question text, structured answers and Cardinal evaluation protocol.
3. Return a valid `Élève | Note | Commentaire` table and verify the ChatGPT button names the correct question.
4. Preview and publish to Formative; require `relecture serveur confirmée` before considering the write successful.
5. Verify a stale Q2/Q3 mismatch is blocked.
6. Verify global Formative -> Gestion creates/updates one evaluation and preserves corrected-question selection.
7. Open an existing Gestion assignment, enter/edit grades and verify refresh/navigation persistence.
8. Verify first Mozaïk sync discovers/validates the current group/year and subsequent sync reuses the mapping when valid.
9. Verify an already linked activity updates instead of duplicating.
10. Verify non-bulletin activity behavior preserves `ponderation:null`.
11. Verify new-work UX, copy-settings, deletion and icon rendering in both a normal and private Chrome profile.

When a stable flow passes, avoid changing the core engine without a concrete bug or requirement.