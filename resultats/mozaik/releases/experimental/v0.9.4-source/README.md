# Cardinal v0.9.4 beta

This is the current controlled beta candidate.

## Main change from v0.9.3

Formative is now truly stealth by default:

- no Formative content script is declared in `manifest.json`;
- no Cardinal/ChatGPT button is injected when a Formative results page merely loads;
- teacher actions start from the Chrome extension popup;
- when the helper is explicitly injected, its own launcher is hidden in the base UI before the stealth layer runs, so there is no visible launcher flash;
- visible Formative helper wording is neutral (`Préparer une correction`, `Copier les réponses`, `Retour de correction`);
- `CARDINAL_SIMPLE_PING` prevents redundant reinjection.

## Preserved behavior

- automatic Formative class/question discovery when the current URL identifies them;
- actual Formative classes/questions offered when auto-detection is not unique;
- flexible correction/calibration in ChatGPT;
- return table parsing and preview before Formative writes;
- notes/comments independent;
- structured-rubric grade writes blocked until explicitly supported;
- media-dependent grading guarded;
- global Formative evaluation import path to one Gestion assignment;
- automatic Mozaïk course/matter/roster discovery at intentional sync time;
- backend validation before a changed Mozaïk mapping is saved;
- no bearer/token/fiche persistence outside the browser-local workflow.

## Dependency chain

`background-v094.js` imports `background-v093.js`, which imports `background-v092.js`, then `background-v091.js`, then the known-good v0.8.2 lineage (`background-v081.js` / `background.js`).

The exact v0.9.4 test ZIP is generated from the complete source folder in the working artifact. The repo keeps this overlay plus the earlier versioned source folders and the canonical handoff docs. Do not promote v0.9.4 to production until real end-to-end tests pass.

SHA-256 of the generated beta ZIP at build time:

`94b1036b851833f50fca1d1d7beed5d5a4fa240ec960ee0825ea4f7aac423150`
