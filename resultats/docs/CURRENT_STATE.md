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

The preferred Formative architecture is:

`Formative question -> ChatGPT-assisted correction when needed -> results back into that Formative question -> global Formative evaluation result -> Gestion des notes -> Mozaïk`

Formative remains the source of truth for question-level grading, including its auto-corrected questions. Gestion des notes should normally contain one final/global result for a Formative evaluation, not one assignment per question.

## Extension status

### Known-good production baseline

**v0.8.2 is still the last extension version verified in real use.**

Exact archived ZIP:

`resultats/mozaik/releases/cardinal-mozaik-extension-v0.8.2.zip`

SHA-256:

`aeb96f880da6c25d744ad52eca676c961c6d192990ccca5c5ab2ec5964708721`

Real behaviors confirmed with this baseline:

- Formative authentication/header capture works locally in Chrome.
- Gestion -> Formative grade push works for a single linked question.
- Kevin successfully pushed the real Dilemme du collier grades from Gestion des notes into Formative.
- Formative -> Gestion linking/import works.
- Mozaïk sync works after the non-bulletin `ponderation:null` fix.
- Dilemme du collier was successfully sent from Gestion des notes to Mozaïk.

### v0.9.3 beta, current test candidate

Exact archived beta ZIP:

`resultats/mozaik/releases/experimental/cardinal-mozaik-extension-v0.9.3-beta.zip`

SHA-256:

`52c422480b3b3c8fa77f67223970c6b555c56588e324345b87a9995e1cfeaf7d`

Git blob SHA:

`97d7c2b2aa34e7429d5a55c60617afa0169e3719`

Companion source/notes:

`resultats/mozaik/releases/experimental/v0.9.3-source/`

This beta is **implemented but not yet verified end-to-end in real use**. Do not call it the stable version until controlled tests pass.

Important v0.9.3 behavior:

- **Formative receives no Cardinal content script on ordinary page load.** Opening or projecting Formative should look completely normal.
- Teacher actions are launched from the Chrome extension popup.
- Only when the teacher explicitly chooses `Préparer une correction` or `Envoyer le résultat global dans Gestion` does the extension inject the Formative helper UI.
- Injected Formative UI is immediately put in stealth mode: no persistent launcher, no visible ChatGPT branding, and correction wording is neutral.
- Formative class and selected question are detected automatically from live Formative state/URL when possible; otherwise the actual Formative classes/questions are offered for selection.
- The correction prompt carries the question, points and responses so Kevin can calibrate naturally in ChatGPT with a rubric, examples, stricter/looser expectations or individual adjustments.
- A ChatGPT-side button appears only while a Formative correction context exists.
- The final human-readable `Élève | Note | Commentaire` table is parsed by the extension, with paste fallback if ChatGPT DOM detection ever changes.
- Before any write, Formative gets a local preview. Ambiguous/unmatched names and invalid grades are not silently accepted.
- Notes and comments remain independent choices.
- Structured-rubric note writes remain blocked until rubric-level writes are explicitly supported.
- Media-dependent questions/responses are not graded blindly.
- The active correction context is stored locally in the extension, so switching ChatGPT accounts does not invalidate the Formative mapping.

### Mozaïk automatic discovery in v0.9.3

The goal is that annual/group IDs should not need manual hardcoding when the portal exposes the current values.

v0.9.3 now:

- observes real Mozaïk portal/API traffic to learn current group/course/matter identifiers;
- currentizes a previously known group ID only as a navigation hint when needed;
- can open the official group roster page during a requested sync if passive discovery is incomplete;
- reads the official roster through the Mozaïk members API using the browser-local bearer;
- never sends the Mozaïk bearer to GitHub, Supabase or ChatGPT;
- does not persist student fiche numbers through this discovery flow;
- sends the discovered group configuration plus school-email roster to the authenticated `school-roster` backend;
- requires backend roster validation before a changed Mozaïk group mapping can replace the stored configuration;
- falls back to the existing stored configuration if discovery cannot be validated.

Automatic discovery runs as part of an intentional Gestion -> Mozaïk synchronization. It should not randomly open Mozaïk while Kevin is teaching.

### Older experimental archive

Historical prototype only:

`resultats/mozaik/releases/experimental/cardinal-mozaik-extension-v0.9.1-beta.zip`

SHA-256:

`094bc156559e62cb6954f4e07ea134f73c6fa9f2a5f5f2b3c5eff80f20b77aa4`

That beta explored a more complex batching/session workflow and was superseded. Do not promote it just because its version number is above v0.8.2.

## Important source-directory warning

The public checked-in directory:

`resultats/mozaik/extension/`

is not yet the promoted v0.9.3 source. Do not overwrite production from an experimental folder until v0.9.3 passes real tests.

For recovery, the exact archived ZIPs are authoritative for their respective builds.

## Production frontend state

Main page:

`resultats/index.html`

It directly loads:

```text
app.js
app-patch-v04.js?v=7
app-patch-v05.js?v=7
app-patch-v06.js?v=2
```

`app-patch-v05.js` now also loads `app-patch-v07.js?v=3` dynamically.

`app-patch-v07.js` adds:

- safe automatic Mozaïk group/roster discovery before sync when extension >= 0.9.3;
- retrieval of the currently stored Mozaïk group mapping only as a fallback/navigation hint;
- backend validation through `school-roster` before changed IDs are saved;
- loading of `formative-global-v01.js` for global Formative import defaults.

`app-patch-v06.js` preserves:

- post-Mozaïk-sync teacher-data refresh so cards do not show stale state;
- teacher-data refresh on navigation;
- work statistics loader;
- assignment deletion UI;
- optional Formative feedback bridge loader.

`work-stats-v01.js` displays mean and median for the selected group and updates after grade edits/group changes.

## Backend status

Supabase project:

`ojyswaxuqwnqilrvtjll`

The live deployed function remains authoritative when changing backend behavior.

### `school-roster`

Function ID:

`0f7a3f03-325b-4b47-a9f4-123b16165d83`

Live version:

`3`

Live deployment SHA-256:

`6996eb8ac6ae30c3cc7310a0b49a319d18312040eae5ed8285ed9eab3d747696`

Important v3 behavior:

- custom teacher-session + publishable-key authentication remains in place;
- `discoveryConfig` returns the existing stored mapping for one known Gestion group;
- `syncDiscovery` validates discovered school-email roster membership against active `school_students` before changed IDs can replace `school_mozaik_groups`;
- when a roster is supplied, discovery requires meaningful overlap, including at least 60% match ratio under the implemented denominator rule;
- if IDs are changing and no roster can be validated, the backend refuses the replacement;
- official first/last names are only updated for recognized active students in that group.

See `BACKEND_AND_DB.md` for the rest of the functions/schema/auth boundaries.

## Global Formative result

`formative-global-v01.js` and the v0.9.3 beta include a beta path for importing a whole Formative evaluation as one Gestion assignment.

The intended rule remains:

- Formative handles all question-level points, including auto-corrected questions;
- the full evaluation is sent to Gestion only after correction is complete;
- Gestion stores the one global assessment result for each student;
- then the existing Gestion -> Mozaïk workflow is used.

This path is **not yet considered verified** until it is tested on real Formative data. Do not claim production reliability yet.

## Manual work remains first-class

`+ Nouveau travail` in Gestion des notes remains available.

For work that does not come from Formative, for example a paper dictation:

`Nouveau travail -> Dictée -> enter grades in Gestion -> Mozaïk`

`Dictée` is already one of the frontend activity types.

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
- Early Formative values were development/test data and must not be treated as authoritative historical grades.
- Kevin later successfully pushed the real Gestion grades to Formative.
- The assignment successfully synchronized to Mozaïk after fixing the non-bulletin weighting payload.

Use this assignment as a regression reference, but do not overwrite its real grades casually during development.

## Mozaïk regression rule

For `reportCardEnabled=false`, the official portal behavior proved:

`parametresEvaluation.ponderation = null`

Do not regress this.

## Formative regression rules

Known working numeric-grade and feedback mutations are documented in `FORMATIVE_PROTOCOL.md`.

Do not invent a Formative edit-feedback mutation.

Do not assume empty `rubricLevels` is safe for rubric-enabled questions.

Do not turn unanswered/incomplete responses into zero automatically.

Do not expose Formative Authorization headers/cookies outside the local browser extension.

## What is implemented but still needs real testing

The following now exist in v0.9.3 beta but are **not yet promoted as stable**:

- discreet extension-popup launch from Formative with no automatic visible Formative UI;
- automatic Formative class/question detection;
- Formative answer export to ChatGPT for natural calibration;
- ChatGPT result-table recognition and return to the original Formative question;
- local preview and guarded Formative publication;
- optional comments;
- global Formative evaluation import into Gestion;
- automatic Mozaïk group/course/matter discovery plus official-roster validation.

## Safe test sequence before promotion

1. Keep v0.8.2 available as rollback.
2. Install v0.9.3 beta on a test browser/profile or controlled Chrome extension load.
3. Open Formative and verify **nothing Cardinal/ChatGPT appears on the page before opening the extension popup**.
4. Test `Préparer une correction` on one harmless text question with known answers.
5. Verify the correct class and question are auto-selected.
6. Correct/calibrate in ChatGPT and return notes only.
7. Confirm preview, student matching and grade range validation before publishing.
8. Test comments separately.
9. Test global evaluation -> Gestion on a non-critical Formative assessment and compare every global total before accepting it.
10. Test Gestion -> Mozaïk on a disposable/safe assignment and verify group + roster autodetection.
11. Regression-test a non-bulletin activity so `ponderation:null` is preserved.
12. Only after these tests, synchronize/promote `resultats/mozaik/extension/` and installer, then mark v0.9.3 stable.
