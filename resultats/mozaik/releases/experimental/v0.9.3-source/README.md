# Cardinal v0.9.3 beta

This beta starts from the known-good v0.8.2 extension lineage and the v0.9.2 correction prototype, then makes the Formative experience discreet and the Mozaïk discovery safer.

## Formative

- No Cardinal button and no ChatGPT wording are injected automatically into the Formative page.
- Formative remains visually unchanged until the teacher opens the Cardinal extension action.
- The Chrome extension popup offers `Préparer une correction` and `Envoyer le résultat global dans Gestion`.
- When needed, `formative-simple-ui.js` and `formative-stealth-v093.js` are injected together.
- The selected Formative class and question are detected from the live URL when available. Otherwise the actual classes/questions returned by Formative are offered for selection.
- The correction prompt lets the teacher calibrate freely in ChatGPT with examples, rubric details or note adjustments.
- The final result returns through a preview before any write to Formative.
- Notes and comments remain independent.
- Structured-rubric note writes stay blocked until rubric-level writes are explicitly supported.
- Media-dependent questions/responses are not graded blindly.

## ChatGPT

- The same Chrome extension is used. No second connector is required.
- A return button appears on ChatGPT only while a Formative correction context exists.
- The extension parses the final human-readable `Élève | Note | Commentaire` table.
- Manual paste remains as a fallback if the ChatGPT DOM changes.
- Changing ChatGPT account does not break the workflow because the active Formative context is stored locally in the extension, not in the ChatGPT account.

## Mozaïk

- Group/course/matter IDs are learned passively from the real portal/API traffic.
- At sync time, the last known Gestion mapping can be used only as a navigation hint to open the correct group roster.
- Old IDs are currentized to the current academic year before navigation.
- The live official roster is read from the Mozaïk members API.
- Supabase `school-roster` v3 validates the discovered roster against the active students already assigned to that Gestion group before changed Mozaïk identifiers are allowed to replace the stored configuration.
- If validation is insufficient, the existing configuration remains unchanged and normal sync falls back to it.
- No fiche number is persisted by this discovery layer.

## Production boundary

This is still a controlled beta. v0.8.2 remains the last version verified in real use until v0.9.3 passes controlled Formative, ChatGPT, Gestion and Mozaïk end-to-end tests.

The exact beta ZIP is archived under `resultats/mozaik/releases/experimental/` and is the authoritative binary for this beta.