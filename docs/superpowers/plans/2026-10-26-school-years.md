# School years, cohorts and archives — implementation plan

**Goal:** Prepare a new cohort without modifying current work; archive and activate years atomically; preserve assessment membership, grades, comments, copies and progress independently of reused group codes.

**Architecture:** Add integer school-year keys (start year), annual groups and enrollments, immutable assignment membership snapshots, and a singleton active-year context. Keep existing assignment/student IDs and authentication. Existing `school_students.group_code` and `school_mozaik_groups` become active-year compatibility projections; they cannot authorize historical reads. Explicit annual context is required for creation/import; assignment-bound edits verify the assignment year and archive status. RLS-protected persistent previews bind teacher, year revisions and state; confirmation is atomic and idempotent.

**Initial evidence:** All23 existing assignment dates fall in Sep–Oct2026 and verified Mozaïk group IDs indicate2026. Bootstrap year2026–2027 explicitly with provenance. All active work is single-group after the authorized legacy split. Preserve any reliable `result_group_code`; block ambiguous shared membership instead of guessing. Capture current roster at migration with explicit provenance, including comment/dictation-only members. Never modify existing result, feedback, progress or credential values during bootstrap.

**Data contract**
- `school_years(start_year,label,status,revision,created_at,archived_at)`: draft/open/archived; one active year via config, archives read-only until explicit audited reopen.
- `school_year_config(singleton,active_year,revision,enforced)`: stable lock/context; activation never follows a client calendar automatically.
- `school_year_groups(school_year,group_code,mozaik_config)`: namespaced groups and frozen external mapping.
- `school_year_enrollments(school_year,student_email,group_code,name,first_name,last_name,active)`: annual current membership. Enrollment changes additionally append an audit history.
- `school_assignment_roster(assignment_id,student_email,school_year,group_code,name,first_name,last_name,source)`: frozen group/name membership for assessment and authorization; FK cascade allowed only for unarchived assignment deletion. Snapshot included in existing operation stale checks.
- New identities require a valid fiche hash compatible with current PBKDF2 authentication. CSV fiche numbers are hashed server-side before a persistent preview; existing account credentials are never overwritten. New identities staged in a draft remain inactive until year activation; already active former accounts retain access to their own archives.

**User flow**
1. Select year for viewing; archived banner disables editing/import/sync. Current-year choice is distinct from the viewed year and included in routes/preferences.
2. Manage years: prepare next draft, import CSV (email/group/first/last; fiche required only for new identity), preview merge or replace-draft. Never implicitly replace active cohorts.
3. Activation preview names old/new years and counts all preserved work/results/comments; unresolved Mozaïk ready/claimed jobs block switching.
4. Confirm activation once. Archive old year, activate target, update active compatibility projections, invalidate old previews. No copying grades, comments, work IDs or external associations.
5. Late arrivals: explicitly preview/append members to an active assessment; never remove historical members or their notes.
6. Archives can be explicitly reopened for manual correction; merely selecting an archive never opens it or changes active year. External imports/sync remain restricted to the active year. Reuse pedagogical work settings creates new IDs and a new active-year roster, without old results/feedback/links.

7. Group overview: one row per pupil, one column per work, all steps by default, step/search filters, percent/points, red failure cells, explicit missing/unassigned states; frozen annual scope and rejection of delayed replies. No fabricated overall weighted mean.

**Tasks**
- [x] SQL regression harness with2026/2027 same-code cohorts, moved/departed students and comment-only rows; additive schema/bootstrap, guard triggers, year preview/confirm, roster snapshots and operations integration.
- [x] Year-aware teacher dashboard/detail/import/manual-save, roster discovery/configuration, external sync and all student readers (results, Formative feedback, dictation). Preserve old slugs through historical membership. Archived dictation loads perform no writes.
- [x] Year selector/manager, CSV preview, archive read-only state, new-year creation/reuse and late-member update. Reject delayed responses from previous year; stale clients cannot silently create into a different year.
- [x] Tests for archive guards on all write paths, stale previews, repeated confirmation, credentials, incomplete rosters, group reuse, missing grades, pending sync, old slugs and account visibility. Exercise transactions using PGlite; use real PostgreSQL concurrent sessions if available and disclose limits otherwise.
- [x] Astra high review, full test suite and synthetic native UI smoke. Deploy staged components, compare before/after data fingerprints, enable annual context only after compatible readers/writers are deployed. Do not actually archive the real current year during installation.

**Safety:** No raw fiche, student credentials, private copy URLs or actual records in public Git or test fixtures. No deletion of identities, notes or comments for year changes. No inferred historical enrollment presented as original truth. No migration publication until full regression and independent review pass.

