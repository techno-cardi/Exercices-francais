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

Use this ZIP as the source baseline for the next stable extension version.

Important: `resultats/mozaik/extension/` currently contains an older 0.8.1-style source state and must not be treated as an exact mirror of this archive.

## Experimental archive

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
