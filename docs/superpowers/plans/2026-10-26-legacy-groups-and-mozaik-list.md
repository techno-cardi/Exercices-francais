# Independent historical works and compact Mozaïk import

**Goal:** Separate both historical shared dictations without losing results or progress, and simplify importing missing Mozaïk works into Gestion.

**Architecture:** Reuse the atomic preview/confirmation split. Add explicit support for dictation feedback and resolve old student URLs through the audited split mapping. Attribute unrecorded historical groups using the current roster only with the user's explicit authorization (received in this conversation).

**Tasks**
- [x] Diagnose actual dependencies and prepare regression tests for the compact list.
- [x] Compact list, sort missing first, identify linked works with ✅, bulk-preview missing only, preserve explicit confirmation and incomplete-read guards.
- [x] Test full-row dictation progress preservation, feedback-only pupils, stale previews and independent edits.
- [x] Extend split implementation and preserve original student links and teacher views.
- [x] Run relevant suites and obtain a final review; deploy and execute the two authorized splits with atomic full-row equality checks.
- [ ] Verify four independent works, 114 results, all dictation progress and group-specific Mozaïk links; publish frontend and report evidence.

No note values, student secrets, copy URLs or personal records belong in this document or public Git.

**Live maintenance:** Both splits committed with in-transaction full-row equality assertions on results, dictation records and Mozaïk links. Group counts: first dictation 29/30 results and correction records; second 27/28 results. Total 114 results, 59 correction records, 2 group-specific links. Original rows retained in private database audit snapshots; archived original assignments reject writes. Endpoint deployed as version 9. Reviewer found a teacher group-filter regression, now covered by a failing-then-passing test and fixed; no remaining concrete blockers.
