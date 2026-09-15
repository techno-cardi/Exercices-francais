# v0.9.2 beta source overlay

This folder documents the source overlay used to build the experimental `0.9.2` beta on 2026-09-15.

It is **not yet the production extension**. The last version verified in real use remains `../cardinal-mozaik-extension-v0.8.2.zip`.

## Build ancestry

The beta keeps the proven Mozaïk/Formative core and layers the simple workflow on top:

1. Start from the known-good `v0.8.2` archive for the proven Mozaïk core and fixed Formative auth/header capture.
2. `background-v091.js` comes from `../experimental/cardinal-mozaik-extension-v0.9.1-beta.zip` and is retained only for its robust Formative read/preflight/write functions.
3. Overlay the source files in this directory.
4. The manifest service worker is `background-v092.js`.

Do not restore the complicated v0.9.1 user interface. v0.9.2 deliberately uses `formative-simple-ui.js` instead.

## Product behavior in this beta

### Formative -> ChatGPT -> Formative

- The Formative content script detects the open Formative ID from the URL.
- It asks the Formative API for the real list of sections/classes and questions.
- `selectedAssignmentId` and `selectedFormativeItemId` from the current Formative URL are used to preselect the class and question when available.
- The teacher clicks `Corriger avec ChatGPT`, then normally only confirms the detected question.
- The extension copies the question, maximum points, exact student names and textual responses, then opens/focuses ChatGPT.
- No email, fiche number, bearer token, Formative Authorization header or cookie is included in the ChatGPT prompt.
- The prompt tells ChatGPT to finish every grading/regrading response with a complete `Élève | Note | Commentaire` Markdown table, so Kevin does not need to remember an import command.
- The same Chrome extension runs on ChatGPT and can parse the latest assistant table.
- If the ChatGPT DOM changes, a manual paste fallback remains available.
- Name matching happens locally, with accent/spacing normalization and an ambiguity block. Nothing is silently guessed.
- Formative shows a local preview with old score, new score and optional feedback before any write.
- Notes and comments are separate. Comments are off by default.
- The inherited v0.9.1 preflight rereads Formative immediately before publication and blocks changed answers, invalid scores and unsafe rubric writes.

### Global Formative result -> Gestion des notes

The `Résultat global -> Gestion` action reads the exact Formative section and sends the whole snapshot to Gestion with `globalImport=true`.

The Gestion helper `resultats/formative-global-v01.js` preselects all questions. Existing `formativeImport` logic then sums the numeric question scores into one result for the evaluation. Auto-corrected Formative questions are therefore naturally included. Students with incomplete selected-question grading remain untouched rather than being converted to zero.

### Mozaïk automatic discovery

- The extension passively observes the real Mozaïk portal/API URLs used in the current browser session.
- It discovers current-year course-group and matter-group IDs instead of depending only on hardcoded mappings.
- Before a Gestion -> Mozaïk sync, `app-patch-v07.js` asks v0.9.2 to rediscover the selected group.
- If the exact matter ID has not yet been observed, the extension opens that group’s `Liste des élèves` view so Mozaïk itself requests `/membres`; the exact matter-group ID is then learned from the real request.
- The extension reads the official roster using the existing Mozaïk members API helper and returns only email, first name and last name to Gestion.
- Fiche numbers are never persisted by discovery. The proven Mozaïk write engine still reads them only locally at sync time to address grade writes.
- `school-roster` v2 stores refreshed group identifiers and verified names. Discovery failure falls back to the previously stored mapping rather than breaking a sync that already worked.

## Current-year filtering

When multiple observed IDs share the same short group code, v0.9.2 prefers IDs containing the current school-year start year, then prefers the French course ID containing `CFRA`. This prevents an old-year route observed in the browser from silently replacing the current group mapping when a current-year candidate is available.

## Required controlled tests before promotion

1. One Formative text question, notes only.
2. Recalibrate the correction in ChatGPT and resend the revised complete table.
3. Comments only, separately.
4. Confirm ambiguous/unmatched names are blocked.
5. Confirm an answer changed after export is blocked at final preflight.
6. Import one complete Formative evaluation as one global Gestion result and verify auto-corrected questions are included.
7. Mozaïk discovery for groups 31, 32 and 51, including official roster names.
8. Regression: Gestion -> Mozaïk non-bulletin activity still sends `ponderation:null`.
9. Regression: Dilemme du collier values are not overwritten during testing.

Only after those tests should `/resultats/mozaik/extension/` and the public installer be promoted to 0.9.2 or a later stable version.
