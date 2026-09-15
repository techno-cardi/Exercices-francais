# Current state

Last updated: **2026-09-15**

This file is the first status file a future ChatGPT should read after `CHATGPT_PROJECT_INSTRUCTIONS.md`.

## Executive status

The production system is usable today for:

- manual assignment creation in Gestion des notes;
- entering/editing grades and feedback in Gestion des notes;
- student result viewing;
- sending a Gestion assignment/results to Mozaïk;
- linking/importing Formative questions into Gestion des notes;
- pushing Gestion grades back to one linked Formative question;
- deleting an assignment from Gestion des notes without deleting the external Formative/Mozaïk item;
- group-specific average and median display.

The **next development goal is NOT another backend connector**. It is a simple ChatGPT correction bridge inside the existing Chrome extension.

Desired end-user flow:

`Formative question -> ChatGPT correction -> results back into that Formative question -> when evaluation is complete, global Formative result -> Gestion des notes -> Mozaïk`

## Extension status

### Known-good baseline

**v0.8.2 is the last extension version verified in real use.**

Exact archived ZIP:

`resultats/mozaik/releases/cardinal-mozaik-extension-v0.8.2.zip`

SHA-256:

`aeb96f880da6c25d744ad52eca676c961c6d192990ccca5c5ab2ec5964708721`

That ZIP contains the exact verified code, including the full fixed `background-v081.js` used in the working build.

Real behaviors confirmed with this baseline:

- Formative authentication/header capture works locally in Chrome.
- Gestion -> Formative grade push works for a single linked question.
- Kevin successfully pushed the real Dilemme du collier grades from Gestion des notes into Formative.
- Formative -> Gestion linking/import works.
- Mozaïk sync works after the non-bulletin `ponderation:null` fix.
- Dilemme du collier was successfully sent from Gestion des notes to Mozaïk.

### Important source-directory warning

The checked-in directory:

`resultats/mozaik/extension/`

currently still identifies itself as **0.8.1** and its checked-in `background-v081.js` is an older overlay that imports `background-v08.js`.

It is **not an exact textual mirror of the verified v0.8.2 ZIP**.

Therefore, when starting the next stable extension version, unpack/use the archived v0.8.2 ZIP as the baseline and compare deliberately. Do not assume the current `/extension/` directory is the known-good source merely because it is in `main`.

Only replace/synchronize the public `/extension/` source and installer after the new version passes controlled end-to-end tests.

### Experimental archive

Historical prototype only:

`resultats/mozaik/releases/experimental/cardinal-mozaik-extension-v0.9.1-beta.zip`

SHA-256:

`094bc156559e62cb6954f4e07ea134f73c6fa9f2a5f5f2b3c5eff80f20b77aa4`

This beta explored automatic batching, ChatGPT correction sessions, rubric guards and retry logic. Its correction UX became too complicated and was superseded by the simpler design below.

**Do not promote or install it as the production baseline just because its version number is higher.**

## Next extension design to implement

The new version should start from the v0.8.2 known-good archive and add the smallest possible correction workflow.

### On Formative

Provide a simple action such as:

`Corriger avec ChatGPT`

or

`Copier les réponses pour ChatGPT`

For the selected/open question, the extension should prepare/copy:

- Formative/evaluation context needed to avoid writing to the wrong place;
- question number/text;
- maximum points;
- student responses;
- enough hidden/included instructions that any ChatGPT knows to return a consistent, human-readable import table.

Kevin must be free to discuss/calibrate normally in ChatGPT afterward. No extension form should force him to define a rubric ahead of time.

Examples of normal calibration Kevin may do in chat:

- “Je trouve que tu es trop généreux.”
- “Cette réponse devrait avoir 6,5.”
- “Voici mon barème.”
- “Voici trois exemples de réponses et les notes que je donnerais.”
- “Revois tout le groupe avec cette logique.”
- “Notes seulement, pas de commentaires.”

### On ChatGPT

Use the **same Chrome extension**, not a second connector/plugin.

Preferred UX: detect a compatible assistant correction response and offer a button such as:

`Envoyer les résultats dans Formative`

A simple copy/paste fallback must remain available if ChatGPT DOM/UI changes.

Do not require visible technical identifiers like `R001`, `batchId`, raw JSON, or a special command from Kevin.

A human-readable final response table such as `Élève | Note | Commentaire` is appropriate. Comments may be absent.

### Before writing Formative

The extension must locally validate and preview:

- correct Formative/evaluation;
- correct question;
- recognized students;
- ambiguous/unmatched students;
- old score -> proposed score;
- score in the valid `0..possiblePoints` range;
- which comments will be added if comments were requested.

Never silently guess an ambiguous student match.

Nothing is written until Kevin confirms the preview.

Notes and comments are separate choices. Comments are optional.

### After the evaluation is fully corrected

Do **not** create one Gestion assignment per Formative question.

Formative is the source of truth for all question-level grading, including Formative auto-corrected questions.

Add a simple action:

`Envoyer le résultat global dans Gestion des notes`

This should import/create one Gestion assignment representing the full evaluation and each student's final Formative total.

The exact reliable Formative overall-result query/mapping must be confirmed against live Formative data before implementation. Do not invent a total field.

Then use the existing Gestion -> Mozaïk workflow.

## Manual work remains first-class

`+ Nouveau travail` in Gestion des notes must stay available.

Manual work such as a paper dictation does not need Formative:

`Nouveau travail -> Dictée -> enter grades in Gestion -> Mozaïk`

`Dictée` is already one of the frontend activity types.

## Production frontend state

Main page:

`resultats/index.html`

It currently loads:

```text
app.js
app-patch-v04.js?v=7
app-patch-v05.js?v=7
app-patch-v06.js?v=2
```

`app-patch-v06.js` currently adds/preserves:

- post-Mozaïk-sync teacher-data refresh so cards do not show a stale error/sync state;
- teacher-data refresh on navigation;
- work statistics loader;
- assignment deletion UI;
- optional Formative feedback bridge loader.

`work-stats-v01.js` displays mean and median for the selected group and updates after grade edits/group changes.

`formative-feedback-bridge-v01.js` was added during the question-level feedback experiment. Keep it optional. The product should not be forced to duplicate every Formative question comment into Gestion des notes.

## Assignment deletion

`TEST synchro Mozaïk S5 - à supprimer` was removed from Gestion des notes. Database cascades removed its local test results and Mozaïk link.

The teacher UI now has `Supprimer le travail` in assignment settings.

Deletion from Gestion must not automatically delete the external activity in Mozaïk or Formative.

## Dilemme du collier

Real Gestion assignment ID:

`0080e18b-9209-478d-a069-0f2c94225fb5`

Title:

`SAÉ - Le dilemme du collier`

Important history:

- Gestion des notes contained the real grades.
- Early Formative values were used as development/test data and must not be treated as authoritative historical grades.
- Kevin later successfully pushed the real Gestion grades to Formative.
- The assignment successfully synchronized to Mozaïk after fixing the non-bulletin weighting payload.

Use this assignment as a regression reference, but do not overwrite its grades casually during development.

## Mozaïk regression rule

For `reportCardEnabled=false`, the official portal behavior proved:

`parametresEvaluation.ponderation = null`

Do not regress this.

See `MOZAIK_PROTOCOL.md` for the authoritative observed object and endpoint behavior.

## Formative regression rules

Known working numeric grade mutation and feedback mutations are documented in `FORMATIVE_PROTOCOL.md`.

Do not invent a Formative edit-feedback mutation.

Do not assume empty `rubricLevels` is safe for rubric-enabled questions.

Do not turn unanswered/incomplete responses into zero automatically.

## Backend status

Supabase project:

`ojyswaxuqwnqilrvtjll`

See `BACKEND_AND_DB.md` for the current function IDs, schema, auth boundaries and API behaviors.

The live Supabase function is authoritative when deploying a backend change. Fetch it first with the Supabase connector.

## What is NOT implemented yet

As of this update, the following desired features are **design decisions, not production features**:

- a ChatGPT-page button that sends correction results directly back to Formative;
- the final simplified `Corriger avec ChatGPT` workflow described above;
- robust parsing/matching of a ChatGPT human-readable grade table into the selected Formative question;
- one-click import of the **global Formative evaluation result** into Gestion des notes.

Do not tell Kevin these are already live until they have actually been built and tested.

## Safe next development sequence

1. Start from the archived v0.8.2 source, not the stale checked-in 0.8.1 overlay.
2. Add only the simple Formative -> ChatGPT copy/export step first.
3. Test on one harmless Formative question.
4. Add ChatGPT response recognition/import with preview, preserving the copy/paste fallback.
5. Test notes-only on one question.
6. Test comments separately.
7. Confirm/read the full-evaluation Formative totals from the real API.
8. Implement global-result -> Gestion import.
9. Regression-test Gestion -> Mozaïk, including Dilemme/non-bulletin behavior.
10. Only then promote a new extension version as stable and synchronize `resultats/mozaik/extension/` + installer.
