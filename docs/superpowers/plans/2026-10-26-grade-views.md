# Grade views implementation plan

**Goal:** Comparable percentage averages, accessible failure highlighting/filtering, reliable group and term navigation.

**Design:** Keep original points and saved grades unchanged. Classify against an explicit configurable 60% threshold using unrounded values; missing/invalid scores are not failures. Combine failure filter with group and name search. Preserve focus and keyboard navigation during edits; no table rebuild per keystroke. Guard view changes while saves are pending. Harmonize detail mean/median with list percentages. Use actual active roster groups for new work and dynamic known groups for browsing. Add shared explicit term controls instead of fixing term 1.

**Annual boundary:** Group UI is not historical enrollment storage. Do not infer old membership or claim annual isolation; historical enrollment needs its own inspected data contract before any migration. This pass changes presentation and navigation without assigning or modifying student records.

- [x] Regression tests for denominator, zero/missing values, exact threshold, filter/search/group combinations, save failure and keyboard stability.
- [x] Implement percentage cards/detail statistics and compact grade toolbar/summary with failure filter, threshold and accessible row status.
- [x] Dynamic empty/changed groups, active-only creation groups, remembered selected term across dashboard/list; retire duplicate dashboard override.
- [x] Run all relevant tests and Astra high final review; inspect the full patch chain in Chrome using synthetic data before publishing.

**Verification:** 172 tests pass. Native local QA: 0%, 59.99%, exactly60%, ungraded, failure-only search, Tab from corrected passing row to next failing pupil, and step2 list all verified. New creation offers active31/32/77, excludes historicalOLD, and inherits selectedstep2. Mean and median show percentages primarily. No-edit precision baseline covers33.3333 rendered33.333 with zero writes. Same-field 5→15→5 saves serialize, failed saves restore status, and status-refresh failure cannot revert acknowledged grades. Astra high initial audit and final review completed with no remaining concrete blocker. Live note data was not used for edit tests.

**Maintenance:** Removed duplicate dynamic dashboard override and its800ms group-polling interval. Both v08 group rebuilding and v09 creation choices use active roster groups for creation; old groups remain navigable. Annual enrollment snapshots were not inferred or migrated.

**Public follow-up:** Live smoke identified list69.55% versus detail69.53% for the same work. Root cause was server rounding the raw mean before percentage conversion. Added failing regression, removed only that early arithmetic rounding, retained all write paths and authentication. Astra high confirmed the change; 173 tests pass. school-teacher-api version6 deployed, frontend already public. No live grades changed.
