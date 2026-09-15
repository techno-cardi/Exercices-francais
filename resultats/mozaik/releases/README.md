# Extension release archive

This folder exists so a future ChatGPT can recover the exact extension source that Kevin actually tested, instead of guessing from a later/stale working directory.

## Stable baseline

### `cardinal-mozaik-extension-v0.8.2.zip`

Status: **last known-good real-use baseline**

SHA-256:

`aeb96f880da6c25d744ad52eca676c961c6d192990ccca5c5ab2ec5964708721`

Confirmed behaviors include:

- local Formative auth capture;
- Formative -> Gestion import/link;
- Gestion -> Formative numeric grade push for a linked single question;
- real Dilemme du collier grade push into Formative;
- Gestion -> Mozaïk synchronization;
- non-bulletin Mozaïk activity creation with `ponderation:null`.

Use this ZIP as the rollback/source baseline until a newer build completes real end-to-end testing.

Important: `resultats/mozaik/extension/` is not automatically authoritative just because it is the public source directory. Compare it with the exact tested archive before promotion/recovery.

## Current test candidate

### `experimental/cardinal-mozaik-extension-v0.9.3-beta.zip`

Status: **implemented beta, ready for controlled testing, not yet production**

SHA-256:

`52c422480b3b3c8fa77f67223970c6b555c56588e324345b87a9995e1cfeaf7d`

Git blob SHA:

`97d7c2b2aa34e7429d5a55c60617afa0169e3719`

Companion notes/source additions:

`experimental/v0.9.3-source/`

Main changes:

- Formative stays visually untouched on normal page load;
- teacher actions start from the Chrome extension popup;
- temporary Formative UI is injected only after an explicit action and uses stealth/neutral wording;
- automatic Formative class/question detection;
- simple Formative -> ChatGPT -> Formative correction bridge with local preview;
- optional comments and guarded grade writes;
- global Formative evaluation -> one Gestion result path;
- automatic Mozaïk group/course/matter discovery;
- official Mozaïk roster extraction and backend validation before changed group IDs are saved.

Do not promote v0.9.3 until the test sequence in `resultats/docs/CURRENT_STATE.md` has passed.

## Older experimental archive

### `experimental/cardinal-mozaik-extension-v0.9.1-beta.zip`

Status: **historical prototype, not production**

SHA-256:

`094bc156559e62cb6954f4e07ea134f73c6fa9f2a5f5f2b3c5eff80f20b77aa4`

This prototype explored automatic correction batching, question sessions, retry logic and rubric guards. Its UX was intentionally abandoned because it became too complicated for Kevin's daily correction workflow.

Do not promote it merely because its version is higher than 0.8.2. Useful low-level ideas may be selectively reused after review.

## Promotion rule

A new extension version becomes the stable baseline only after real end-to-end testing of the paths it changes.

After promotion:

1. archive the exact tested ZIP here;
2. record its SHA-256;
3. update `resultats/docs/CURRENT_STATE.md`;
4. synchronize the public `resultats/mozaik/extension/` source/installer only when it matches the tested build.
