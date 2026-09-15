# Current state

Last updated: **2026-09-15**

This is the first status file a future ChatGPT should read after `CHATGPT_PROJECT_INSTRUCTIONS.md`.

## Executive status

The production system is usable for:

- manual assignment creation and grade entry in Gestion des notes;
- student result viewing;
- Formative -> ChatGPT-assisted correction -> guarded return to Formative;
- global Formative evaluation -> one Gestion assignment/result;
- Gestion -> Mozaïk synchronization;
- assignment deletion from Gestion without silently deleting the external Formative/Mozaïk item;
- group-specific average/median display.

Preferred evaluation flow:

`Formative -> question-level correction in Formative -> one global Formative result -> Gestion des notes -> Mozaïk`

Formative remains the question-level source of truth. Gestion normally stores the final/global evaluation result rather than one assignment per Formative question.

## Extension status

### Last fully exercised candidate before durability rewrite

Kevin ran the controlled checklist successfully with **v0.9.3.9** on 2026-09-15, including the Formative/ChatGPT flows and global Formative import behaviors that had been failing in earlier hotfixes.

Important behaviors preserved from 0.9.3.x:

- Cardinal does not leave correction/global buttons visibly injected in the Formative page;
- actions are launched from the extension popup;
- direct `/results/N` Formative URLs can preselect the question;
- ChatGPT recognizes a final `Élève/Nom | Note | Commentaire` table, with Commentaire optional;
- a failed Formative publication remains recoverable as a pending batch;
- comments are preselected when comments exist;
- changed student answers are detected before publishing;
- Formative bridge PING/version handling avoids using an invalid old extension context;
- global Formative import selects only questions with graded points by default and offers `Sélectionner tout` / `Sélectionner les questions corrigées`.

### Current candidate: v0.9.4.0 durable beta

v0.9.4.0 keeps the proven Formative/ChatGPT code path and changes the Mozaïk/group architecture so a future school year or different group numbers do not require hardcoded code edits.

New durability rules:

- no active allow-list of `31`, `32`, `51` in teacher assignment save, global Formative import or Mozaïk sync preparation;
- teacher dashboard groups are generated from active `school_students`;
- Gestion sidebar, dashboard group cards, assignment filter and group choices are rebuilt from the live backend group list;
- Formative section-title group extraction is generic rather than limited to `31|32|51`;
- Mozaïk academic year is derived first from IDs actually observed in the authenticated portal;
- the local calendar is only a navigation fallback;
- previous Mozaïk mapping is only a navigation/ranking hint;
- changed mapping must pass backend roster validation before replacing `school_mozaik_groups`;
- multiple plausible candidates are sent to the backend and ambiguous candidates are refused instead of guessed.

See `MOZAIK_DURABILITY_V094.md` for the detailed architecture and regression requirements.

## Current live backend versions

Supabase project: `ojyswaxuqwnqilrvtjll`

Live versions after the durability work:

- `school-results`: v1
- `school-student-auth`: v1
- `school-teacher-api`: **v4**
- `school-roster`: **v5**
- `mozaik-sync`: **v4**
- `school-formative-link`: v1
- `school-teacher-delete-assignment`: v1
- `school-formative-feedback`: v1

The live deployed source is authoritative. Fetch it from Supabase before editing/deploying.

`verify_jwt=false` remains intentional for the relevant functions because they use the existing publishable-key + application session-token validation. Do not flip this blindly.

## school-roster v5

Important behavior:

- `discoveryConfig` returns the last validated mapping as a hint;
- `syncDiscovery` validates one live candidate;
- `syncDiscoveryCandidates` validates several candidates against the expected active Gestion roster;
- course and matter IDs must end with the exact requested group code;
- course and matter IDs must encode the same academic-year start after the establishment prefix;
- the subject code must match the numeric subject encoded in the matter ID;
- year validity is no longer based primarily on today's calendar date;
- changed mappings require sufficient roster coverage/precision;
- ambiguous similarly strong candidates are rejected rather than selected silently;
- official names are only updated for recognized active students in the exact group;
- fiche numbers are not part of the discovery persistence path.

## mozaik-sync v4

The former hardcoded check for groups 31/32/51 is gone.

A sync group must now:

1. have a safe group-code format;
2. exist among active `school_students`;
3. belong to the assignment being synchronized;
4. have a validated `school_mozaik_groups` mapping.

Normal prepare / claim / complete behavior remains.

## school-teacher-api v4

The former group allow-list is gone from:

- dashboard group counts;
- assignment creation/update;
- Formative global import.

Group lists are derived from active student records and every assignment/import group is validated against those records.

Student authentication itself was inspected and does not contain a 31/32/51 allow-list.

## Gestion frontend

Main page: `resultats/index.html`

It loads `app.js`, v04, v05 and v06. `app-patch-v05.js` now loads `app-patch-v08.js`.

`app-patch-v08.js` provides:

- dynamic group navigation/filter/choices;
- dynamic dashboard group cards;
- Mozaïk discovery V3 coordination;
- server-side candidate validation before normal sync;
- global Formative import helper loading.

The base HTML still contains current-year group placeholders so the page has a usable skeleton before data loads, but v08 replaces those controls from the live backend list. They are not an authorization or business-rule source.

## Mozaïk discovery V3

The extension service worker is `background-v094.js`, layered over the proven 0.9.3 code.

Discovery V3:

1. observes actual Mozaïk URLs/resources;
2. extracts establishment, course ID, matter ID, group suffix, subject and academic-year start;
3. groups candidates by establishment/year;
4. reads the official roster for candidate matter groups;
5. navigates to the official roster page when identifiers are incomplete;
6. uses the previous mapping only as a last navigation hint;
7. sends one or more live candidates to Gestion for authenticated roster validation.

The browser-local Mozaïk bearer remains local and must never be sent to GitHub, Supabase or ChatGPT.

## Current mappings

The production database still contains the validated 2026 mappings for groups 31, 32 and 51. The durability deployment did not rewrite them.

Their course and matter IDs both encode the 2026 academic-year start, which is internally consistent.

Do not create fake production students/groups solely to simulate a future school year. The generic future-group path should be exercised when a real active roster exists.

## Mozaïk regression rule

For `reportCardEnabled=false`, proven official portal behavior is:

`parametresEvaluation.ponderation = null`

Do not regress this.

The real `SAÉ - Le dilemme du collier` synchronization remains an important regression reference. Do not casually overwrite its real grades during development.

## Formative regression rules

- do not turn unanswered/incomplete responses into zero automatically;
- do not invent unsupported feedback mutations;
- do not assume an empty rubric-level payload is safe for rubric-enabled questions;
- preserve preflight checks for changed answers/max scores;
- preserve the pending-batch recovery path;
- keep Formative authorization/cookies inside the local extension;
- avoid MutationObservers that rewrite the same observed Formative DOM, which previously caused a self-triggering freeze.

## Promotion test for v0.9.4.0

Before calling v0.9.4.0 stable:

1. install/reload v0.9.4.0 and hard-refresh Gestion, Formative and ChatGPT;
2. verify Gestion displays the current groups 31, 32 and 51 from backend data;
3. quick regression-test Formative correction -> ChatGPT table -> Formative preview/publish;
4. quick regression-test global Formative -> Gestion and corrected-question selection;
5. open an existing safe Gestion assignment for group 51 and start Mozaïk sync;
6. verify UI reports automatic validation of group 51 and academic year 2026-2027;
7. verify the normal Mozaïk create/update flow completes;
8. if the activity is already linked, verify update rather than duplicate creation;
9. regression-test a non-bulletin activity and preserve `ponderation:null`.

Keep the v0.9.3.9 ZIP available as immediate rollback while testing v0.9.4.0.