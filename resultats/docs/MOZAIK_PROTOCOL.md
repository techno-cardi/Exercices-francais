# Mozaïk protocol

This file records behavior that was actually observed and tested. Do not infer undocumented Mozaïk semantics when the portal can be inspected directly.

## Role of Mozaïk

Mozaïk receives the final assignment and student results from Gestion des notes.

The Chrome extension owns the live browser authentication. Never ask Kevin to paste the bearer token or cookies. The token is discovered locally from the authenticated Mozaïk portal context and used by the extension.

Base API:

`https://apiaffaires.mozaikportail.ca`

## Current groups

Establishment ID:

`732157`

Current academic-year IDs are generated dynamically by the extension. The current observed 2026 values are:

### Groupe 31

- course group: `7321572026CFRA3SE-31`
- matter group: `7321572026M132308-31`
- subject code: `132308`

### Groupe 32

- course group: `7321572026CFRA3SE-32`
- matter group: `7321572026M132308-32`
- subject code: `132308`

### Groupe 51

- course group: `7321572026CFRA5SE-51`
- matter group: `7321572026M132506-51`
- subject code: `132506`

Do not hardcode the year forever. Existing extension logic currentizes IDs based on the school-year start.

## Automatic group and roster discovery

v0.9.3 beta adds a safer discovery layer so future academic-year/group identifiers can be learned from the real portal rather than manually rewritten.

The preferred discovery order is:

1. passively observe real Mozaïk portal/API resource URLs already loaded by the teacher;
2. identify course-group and matter-group IDs whose suffix matches the Gestion group code;
3. prefer the current academic year and the French course pattern where multiple candidates exist;
4. if passive discovery is incomplete during an intentional sync, retrieve the last stored Gestion mapping as a navigation hint only;
5. currentize the old IDs to the current academic year, open the official group roster page, and let Mozaïk reveal the live current identifiers;
6. read the official roster from the members API locally in the authenticated browser;
7. send only the discovered group metadata and school-email/name roster to the authenticated `school-roster` backend;
8. allow the backend to replace `school_mozaik_groups` only if the roster validates against active Gestion students in that target group.

Important boundaries:

- autodiscovery should run as part of an intentional Gestion -> Mozaïk sync, not by randomly opening Mozaïk while Kevin is teaching;
- previous IDs are a fallback/navigation hint, never sufficient proof by themselves to replace the mapping;
- if a changed mapping cannot be validated by roster overlap, keep the existing stored mapping;
- the browser-local bearer remains local and is never sent to GitHub, Supabase or ChatGPT;
- fiche numbers are not persisted by the autodiscovery flow;
- `school-roster` v3 is the server-side validation gate for changed identifiers.

The members endpoint pattern used by the extension is:

`GET /api/organisationscolaire/groupes/{establishmentId}/{groupMatterId}/membres`

The roster extraction uses school email plus first/last name where available. Official names may be written back to `school_students` only when the email matches an active student in the exact Gestion group.

## Critical non-bulletin rule

A real portal-created non-bulletin activity proved that:

`parametresEvaluation.ponderation` must be `null` when `porteeAuBulletin` is false.

Sending the Gestion weight as Mozaïk `ponderation` for a non-bulletin activity caused HTTP 400.

Observed authoritative object for the test activity `Test21`:

```json
{
  "id": "f5b461aa-c4e4-44d2-87b3-c3a596660da3",
  "idGroupe": "7321572026M132506-51",
  "codeEtape": "1",
  "titre": "Test21",
  "notePublique": null,
  "notePrivee": null,
  "dateActivite": "2026-09-04",
  "periode": 1,
  "faitALaMaison": false,
  "afficheeDansHoraire": true,
  "contientResultats": "Aucun",
  "liens": [],
  "parametresEvaluation": {
    "evaluee": true,
    "competence": "1",
    "noteMaximale": 11,
    "porteeAuBulletin": false,
    "idCategoriePonderation": null,
    "ponderation": null,
    "resultatsDisponibles": false,
    "legende": "MEN"
  }
}
```

Do not generalize `competence: "1"` as universally meaning Lecture. The extension resolves competencies dynamically from the Mozaïk API and maps semantic intent (`lecture`, `ecriture`, `oral`) to the current subject's competence data.

## Activity create/update

Observed create endpoint pattern:

`POST /api/evaluation/apprentissage/{establishmentId}/activites/groupe/{groupMatterId}`

For non-bulletin activities, preserve the portal semantics above, especially `ponderation: null`.

For bulletin activities, a successful real sync used a numeric weighting and `reportCardEnabled=true`.

## Result write

The working grade update payload is:

```json
{
  "eleves": [
    {
      "fiche": "STUDENT_FICHE",
      "resultat": "100"
    }
  ]
}
```

Fiche numbers are sensitive. Never log them into GitHub docs, commit them, or expose them to ChatGPT prompts. They remain local/server-side where already protected.

Mozaïk accepts decimal results. Gestion des notes currently prefers to round outgoing Mozaïk grades to one decimal for consistency. Do not claim Mozaïk rejects two decimals.

## Known endpoints used during diagnostics

The project has successfully interacted with endpoint families for:

- group details/members
- subject competencies
- evaluation configuration
- activities
- planning
- stage results
- activity results

If Mozaïk behavior changes, use a fetch/XHR diagnostic interceptor in the authenticated portal and reproduce the exact request the official UI makes. Do not guess undocumented payload fields.

## Sync architecture

`resultats/app.js` talks to the Supabase `mozaik-sync` Edge Function to prepare/manage sync state.

The browser extension performs authenticated Mozaïk API calls locally.

Relevant DB tables include:

- `school_mozaik_groups`
- `school_mozaik_links`
- `school_mozaik_sync_jobs`

When a Gestion grade or assignment changes after a successful Mozaïk sync, mark the assignment/link dirty so the UI does not incorrectly show it as current.

## Proven real assignment

`SAÉ - Le dilemme du collier` was successfully synchronized from Gestion des notes to Mozaïk after the non-bulletin `ponderation:null` correction.

This is an important regression test. Any future Mozaïk rewrite must preserve that behavior.
