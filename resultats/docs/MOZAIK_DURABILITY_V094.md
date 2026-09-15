# Mozaïk durable discovery - v0.9.4.0

Date: 2026-09-15

This document records the durability rules introduced for future school years and group changes. It complements `MOZAIK_PROTOCOL.md`, `BACKEND_AND_DB.md` and `CURRENT_STATE.md`.

## Core rule

No Mozaïk group ID, matter ID, subject code, establishment ID, group code or school year should be treated as permanently valid merely because it worked in a previous year.

The live authenticated Mozaïk portal is the discovery source. Gestion des notes is the authority for the expected local group roster. A changed Mozaïk mapping is saved only after the two agree strongly enough.

## v0.9.4.0 discovery flow

1. The Chrome extension passively observes real Mozaïk portal/API resource URLs.
2. It extracts course-group and matter-group IDs, establishment, group suffix, subject code and the academic-year start encoded in the IDs.
3. The academic year is derived from the live IDs first. Calendar date is only a navigation fallback when no current live ID has yet been observed.
4. The previous validated mapping may be retrieved from `school_mozaik_groups`, but it is used only as a navigation/ranking hint.
5. The extension opens the official roster page when necessary so Mozaïk reveals current identifiers and the members endpoint.
6. Candidate mappings are paired with official school-email rosters read locally in the authenticated browser.
7. One or more candidates are sent to the authenticated `school-roster` Edge Function.
8. The backend compares each candidate roster with active `school_students` for the requested Gestion group.
9. A unique sufficiently strong candidate can replace the stored mapping. Ambiguous candidates are refused rather than guessed.
10. Only after that validation does normal Gestion -> Mozaïk synchronization prepare a job.

## Dynamic groups

As of the v0.9.4 durability work, production backend logic no longer contains an allow-list of `31`, `32`, `51` for:

- teacher dashboard group counts;
- assignment creation/update;
- global Formative import;
- Mozaïk sync preparation.

A group is accepted when:

- its code has a safe simple format;
- it exists among active `school_students`;
- the target assignment is associated with that group.

The Gestion frontend reconstructs its group navigation, dashboard cards, work filter and assignment group choices from the groups returned by the teacher dashboard. Future groups such as `41`, `42` or `52` therefore do not require a code release, provided the active roster has been updated.

## School-year validation

`school-roster` v5 no longer decides validity by requiring IDs to match the server's calendar-derived current year.

Instead:

- the course ID must encode a four-digit academic-year start after the establishment prefix;
- the matter ID must encode the same year;
- both IDs must end with the exact requested group code;
- the numeric subject encoded in the matter ID must equal the supplied subject code;
- if the extension supplies `academicYearStart`, it must match the year encoded by both IDs.

This avoids a hard failure around summer/year rollover while still rejecting inconsistent identifiers.

## Candidate ambiguity rule

`school-roster` action `syncDiscoveryCandidates` accepts multiple live candidates and validates them against the expected Gestion roster.

The backend refuses automatic selection if two candidates have very similar roster coverage/precision. The intended recovery is to open the correct group roster in Mozaïk and retry, allowing live portal traffic to disambiguate. Cardinal must never choose a plausible but ambiguous group silently.

## Validation safeguards

Preserved safeguards include:

- school-email-only roster comparison;
- minimum overlap with active Gestion students;
- minimum precision of the detected roster;
- stronger completeness requirement before replacing an existing mapping;
- official names updated only for recognized active students in the exact target group;
- fiche numbers excluded from the discovery persistence path;
- browser-local Mozaïk bearer never sent to GitHub, ChatGPT or the roster backend.

## Current live backend versions after this change

- `school-roster`: v5
- `mozaik-sync`: v4
- `school-teacher-api`: v4

All three preserve the existing custom publishable-key + application session authentication model. `verify_jwt=false` remains intentional for those functions.

## Regression requirements

Before promoting v0.9.4.0 as stable:

1. verify Gestion still lists groups 31, 32 and 51 from the live roster;
2. verify an existing group 51 assignment can synchronize to Mozaïk;
3. confirm the UI reports that the group was validated for 2026-2027 before sync preparation;
4. confirm an already-linked Mozaïk activity is updated rather than duplicated;
5. regression-test Formative -> ChatGPT -> Formative and global Formative -> Gestion;
6. preserve the proven non-bulletin rule `parametresEvaluation.ponderation = null` when `porteeAuBulletin=false`.

Do not create fake production students merely to simulate a future group. The future-group path is structurally covered by dynamic group validation; a real new group should be validated when its real active roster exists.