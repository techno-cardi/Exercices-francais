# Mozaïk protocol

This file records behavior that was actually observed/tested. Do not infer undocumented Mozaïk semantics when the authenticated portal can be inspected directly.

## Role of Mozaïk

Mozaïk receives the final assignment and student results from Gestion des notes.

The Chrome extension owns live browser authentication. Never ask Kevin to paste a bearer token or cookies. The bearer is discovered/used locally in the authenticated Mozaïk browser context.

Base API:

`https://apiaffaires.mozaikportail.ca`

## Current observed 2026 mappings

Current establishment: `732157`

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

These are current observations, not permanent configuration constants.

## Durable discovery V3 (extension v0.9.4.0)

The live Mozaïk portal is authoritative for group/course/matter identifiers.

Discovery order:

1. passively observe real Mozaïk portal/API resource URLs;
2. extract establishment, group suffix, course/matter ID, subject code and academic-year start encoded in the IDs;
3. group candidate IDs by establishment and encoded academic year;
4. read official roster data through the Mozaïk members API;
5. if identifiers are incomplete, intentionally navigate to the official group roster page so Mozaïk reveals current resources;
6. use the last validated mapping only as a navigation/ranking hint when live discovery is incomplete;
7. send one or more candidate mappings plus school-email roster to the authenticated `school-roster` backend;
8. allow the backend to save a mapping only after it validates strongly against active Gestion students in the target group.

Important changes from the older discovery implementation:

- the school year is derived first from the IDs observed in Mozaïk, not from today's date;
- the calendar-derived year is only a last navigation fallback;
- group codes are not limited to 31/32/51;
- `CFRA` is not an authorization requirement;
- multiple plausible candidates are not guessed locally;
- ambiguous candidates are refused by the backend until live portal context disambiguates them.

## Backend validation gate

`school-roster` v5 is the server-side authority for changed mappings.

For a candidate mapping:

- course and matter IDs must end with the exact requested Gestion group code;
- both IDs must begin with the same establishment ID;
- both IDs must encode the same four-digit academic-year start immediately after that establishment prefix;
- if `academicYearStart` is supplied, it must match the year encoded in both IDs;
- `subject_code` must match the numeric subject encoded in the matter ID;
- school-email roster membership is compared with active `school_students` for the exact target group;
- changed mappings require sufficient expected-group coverage and detected-roster precision;
- changed mappings also require a reasonably complete detected roster;
- official first/last names can only be updated for recognized active students in that exact group;
- fiche numbers are not part of this discovery write path.

The previous stored mapping is never sufficient proof by itself to replace identifiers.

## Members endpoint

Observed endpoint pattern:

`GET /api/organisationscolaire/groupes/{establishmentId}/{groupMatterId}/membres`

Roster extraction uses school email plus first/last name where available.

## Dynamic group rule

Gestion/backend no longer use a fixed allow-list of `31`, `32`, `51` for assignment creation, Formative global import or Mozaïk preparation.

A target group must have a safe code, exist among active Gestion students, belong to the assignment and have a validated Mozaïk mapping before synchronization.

This means future groups such as 41, 42 or 52 should not require a code change once their real roster exists.

## Critical non-bulletin rule

A real portal-created non-bulletin activity proved:

`parametresEvaluation.ponderation` must be `null` when `porteeAuBulletin` is false.

Sending the Gestion weight as Mozaïk `ponderation` for a non-bulletin activity caused HTTP 400.

Observed authoritative object for the test activity `Test21`:

```json
{
  "id": "f5b461aa-c4e4-44d2-87b3-c3a596660da3",
  "idGroupe": "7321572026M132506-51",
  "codeEtape": "1",
  "titre": "Test21",
  "dateActivite": "2026-09-04",
  "periode": 1,
  "faitALaMaison": false,
  "afficheeDansHoraire": true,
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

Do not generalize `competence: "1"` as universally meaning Lecture. The extension resolves competencies from live Mozaïk data and maps semantic intent (`lecture`, `ecriture`, `oral`) to current subject competence data.

## Activity create/update

Observed create endpoint pattern:

`POST /api/evaluation/apprentissage/{establishmentId}/activites/groupe/{groupMatterId}`

For non-bulletin activities preserve `ponderation:null`.

For bulletin activities, a successful real sync used numeric weighting with `reportCardEnabled=true`.

## Result write

Working grade-update payload shape:

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

Fiche numbers are sensitive. Never log/commit/expose them to ChatGPT prompts. They remain local/server-side where already protected.

Mozaïk accepts decimal results. Gestion currently prefers one decimal for outgoing Mozaïk grades for consistency. Do not claim Mozaïk rejects two decimals.

## Known endpoint families used during diagnostics

The project has successfully interacted with endpoint families for:

- group details/members;
- subject competencies;
- evaluation configuration;
- activities;
- planning;
- stage results;
- activity results.

If Mozaïk behavior changes, inspect fetch/XHR traffic in the authenticated portal and reproduce the exact request made by the official UI. Do not guess undocumented payload fields.

## Sync architecture

Gestion talks to the Supabase `mozaik-sync` Edge Function to prepare/manage sync state.

The browser extension performs authenticated Mozaïk API calls locally.

Relevant tables:

- `school_mozaik_groups`
- `school_mozaik_links`
- `school_mozaik_sync_jobs`

Current relevant live functions after the durability update:

- `school-roster` v5
- `mozaik-sync` v4
- `school-teacher-api` v4

When a Gestion grade or assignment changes after a successful Mozaïk sync, mark the assignment/link dirty so the UI does not incorrectly show it as current.

## Proven real assignment

`SAÉ - Le dilemme du collier` successfully synchronized from Gestion des notes to Mozaïk after the non-bulletin `ponderation:null` correction.

Use it as a regression reference. Any future Mozaïk rewrite must preserve that behavior.

For the detailed future-year/group architecture, see `MOZAIK_DURABILITY_V094.md`.