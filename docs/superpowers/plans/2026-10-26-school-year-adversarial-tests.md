# School years and archives — adversarial test specification

Date: 2026-10-26. Companion: [implementation plan](2026-10-26-school-years.md).

This is a test specification, not an execution report. It assumes only the proposed interfaces: `yearContext`, `yearPreview(kind)`, `yearConfirm(operation UUID)`, `school_year_operations`, and the year/enrollment/assignment-roster tables described in the companion plan. Adapt transport and fixture setup to the implementation; do not weaken the behavioral assertions to accommodate a test harness. Use synthetic records only. Do not execute these scenarios against production.

## Release invariants

1. A year transition never changes an existing result, response, feedback, canonical score base, private-copy reference, or dictation attempt/progress record.
2. A reused group code does not grant a new cohort access to the previous cohort's work or comments.
3. An assignment's historical members remain visible to the teacher after moves, departures, deactivation, and rollover. Published student access follows the recorded assignment membership and authenticated identity, subject to existing visibility and account authorization rules.
4. `school_students.active` remains account authorization. Rollover does not deactivate former pupils or reactivate deliberately disabled accounts. Only explicitly staged new profiles can become newly active through the year workflow.
5. Every accepted mutation has an explicit, valid annual context. A stale browser cannot silently create or import into whichever year is active when its request arrives.
6. Archive protection is enforced in the database as well as in API/UI code. An archive selected for viewing is not reopened.
7. Confirmation is atomic, bound to its teacher and stored plan, idempotent, and invalidated by relevant context changes.
8. External imports/sync require the active year even when an older archive has been explicitly reopened for manual correction.

## Synthetic fixture and evidence

Prepare two years: `2026` open and active, `2027` draft. Both contain group `31`; additionally use `77` and an alphanumeric group `A-2`. Keep a third draft `2028` for competing activations.

Use these synthetic identities, with nonproduction addresses:

| Identity | 2026 | Proposed 2027 | Special evidence |
|---|---|---|---|
| Alice | Group 31 | Group 77 | Published result with a fractional grade and multiline feedback |
| Bob | Absent | Group 31 | New profile staged inactive; valid synthetic fiche supplied |
| Carol | Group 31 | Not enrolled | Account active; old grade zero and response text |
| Dan | Group 31 | Group 31 | Account explicitly disabled before roster preparation |
| Eve | Group 31 | Not enrolled | Formative comment only, no `school_results` row |
| Finn | Group 31 | Not enrolled | Dictation feedback/copy/progress only, no grade |

Have two authorized teacher accounts, T1 and T2, and an inactive teacher T0. Teacher assignment visibility remains the application's established school-wide policy: do not invent per-teacher assignment ownership. Operations, however, are owner-bound and must not be transferable between T1 and T2.

Create a single-group work W26 and a separate W27. Include hidden and published work, result `visible=false`, an ungraded assignment member, and a legacy split parent/children with an old dictation slug. Include archived/shared legacy fixtures separately for bootstrap ambiguity tests.

Before each destructive-looking scenario, capture canonical, deterministically ordered representations of existing rows in results, Formative feedback, dictation feedback/progress/history, assignment membership, external links, and authentication credentials. Use exact numeric values such as `33.3333`, zero, null, French accents, quotes, and newlines. Compare full values, not only row counts. Never put real credentials or copy URLs into fixtures, logs, or this document.

## Bootstrap and historical attribution

| ID | Adversarial action | Required outcome |
|---|---|---|
| B01 | Apply the approved 2026 bootstrap to the reviewed current dataset shape. | Every intended work receives 2026 explicitly with provenance; no existing results, feedback, credentials, or progress values change. Both split parents and children retain valid identities and routes. |
| B02 | Include a work with a missing or contradictory date/year signal. | Bootstrap reports or isolates the unresolved work; it does not silently assign the current calendar year. No partial committed bootstrap masquerades as complete. |
| B03 | Shared work has a result with no historical group; the student's current group happens to match one candidate. | Current membership is not used as proof. The historical group remains unresolved or confirmation blocks until explicit resolution. |
| B04 | `result_group_code` disagrees with the work's groups or another trusted membership record. | Conflict is explicit; do not overwrite the result or pick one source silently. |
| B05 | Eve and Finn have comments/dictation records but no result row. | Both appear in assignment membership and teacher history; associated feedback and old copy/progress remain accessible. |
| B06 | A historic student is now inactive or in another current group. | Preserve the relationship from the work's evidence. Do not omit the student because the current roster query excludes them. |
| B07 | Capture current, ungraded pupils while bootstrapping an existing work. | Mark these rows as migration-time/current-roster capture, not as proven original membership. Capture only the reviewed cohort; do not enrich every historical work from today's roster. |
| B08 | Run bootstrap/recovery a second time after a partial deployment. | No duplicate roster rows, history events, operation results, or new credentials. Unexpected conflicting existing state blocks safely. |
| B09 | Existing Mozaik link has `school_year=null` while current configuration derives 2026. | Do not manufacture certainty about the old activity from the current group code alone. Preserve legacy scope unless the reviewed migration explicitly verifies that association. |
| B10 | New assignment-roster FK becomes visible to split dependency discovery. | Historical splitting handles that dependency, including members without results; it does not unexpectedly fail as `split_unhandled_dependency` or discard membership. |
| B11 | Actual bootstrap sees an unknown FK/conventional `assignment_id` dependency. | Report and preserve it; no broad cascade or silent omission. Record the decision before enabling year enforcement. |

Bootstrap conservation assertions must cover private-copy references, secret hashes, lock counters, attempt numbers/history, Formative item/message IDs, result visibility, canonical score bases, and existing login/password hashes. Names captured at migration must not be presented as verified names from an earlier date.

## Draft roster, profiles, and enrollment history

| ID | Adversarial action | Required outcome |
|---|---|---|
| R01 | Create 2027 and import its draft list while W26 is open in another browser. | No change to active context, current-year assignment lists, membership, authentication, external configuration projection, or existing work. |
| R02 | Import Bob without a fiche, with malformed fiche, or without a usable credential hash. | Preview identifies the unmet new-profile requirement; activation cannot produce an unusable or weakly provisioned active account. No fabricated/shared credential is inserted. |
| R03 | Import an existing account with a supplied different fiche or password-like field. | Existing authentication material is unchanged. Credential reset is not an implicit roster-import side effect. |
| R04 | Dan is disabled before preparation, or is deliberately disabled after preview. | Draft import and activation do not reactivate Dan. Distinguish a profile staged inactive by this operation from a previously disabled account. |
| R05 | Existing active Carol is absent from the next cohort. | Carol's account remains active; enrollment and current-year eligibility change, not historical account authorization. |
| R06 | Duplicate email appears twice with conflicting groups/names, including case/whitespace variants. | Normalize identities and reject conflicting rows before confirmation. No last-row-wins assignment and no second identity. |
| R07 | Two draft years provision the same new email with different fiche/name data. | One identity cannot be silently overwritten or attributed to a different person. Second confirmation rechecks identity existence/provisioning state and rejects conflicts. |
| R08 | Use group `A-2`, a previously unseen numeric group, and invalid markup/overlong group strings. | Valid groups work end to end; invalid codes reject. Remove the database-only `31/32/51` restriction without allowing arbitrary markup or unsafe identifiers. |
| R09 | Replace a draft list with an empty or truncated CSV. | Preview clearly identifies removals and empty groups. No implicit active-cohort replacement. Confirmation is bound to the exact reviewed roster. |
| R10 | Alice changes group within an open year. | Current annual membership changes with an append-only before/after history event. Existing assignment roster group/name snapshot remains unchanged. |
| R11 | Teacher appends a late pupil to W26, then retries the same operation. | One membership is added once; existing members and grades remain unchanged. Pupil must be eligible in W26's year, not merely the global active projection. |
| R12 | Attempt direct removal or reassignment of an old assignment member with a grade, comment, or dictation record. | Historical membership remains intact. Any supported correction requires its own explicit audited operation, not an ordinary roster refresh. |
| R13 | Import synthetic fiche marker and inspect persisted operation/request/plan/history fields and error logs. | No raw fiche survives. Persist only necessary compatible hashes in access-restricted locations; do not return hashes in preview responses. |
| R14 | Edit/delete an old enrollment-history entry or modify enrollments of an archived year directly. | Append-only history and archived enrollment protection reject unauthorized changes. |

## Activation, archive, reopen, and idempotency

| ID | Adversarial action | Required outcome |
|---|---|---|
| Y01 | Confirm activation 2026 to 2027. | One transaction changes config and revisions, archives 2026, opens/activates 2027, and updates compatibility projections. No results/comments/progress/links are copied into the new year. |
| Y02 | Inject an error after part of projection/enrollment updates. | All state changes roll back, including account activations and history rows. Active context still describes a coherent original year. |
| Y03 | Repeat confirmation, including after the response was lost. | Return the stored result with no additional events, identities, or mutations. |
| Y04 | Reuse an operation ID with changed target year, roster content, kind, or teacher. | Reject payload/owner conflict; never reinterpret the previous confirmation. |
| Y05 | Select/view 2026 archive; then explicitly reopen it. | Viewing changes no server state. Reopening is audited and permits only the specified historical correction scope; it does not change active_year=2027 or enable 2026 external sync/import. |
| Y06 | Try to archive the active year without a valid replacement. | Reject unless an explicit, implemented no-active-year workflow is part of the contract. Do not leave config pointing to an archived year with ordinary mutations enabled. |
| Y07 | Draft target has unresolved pupils, conflicting groups, or mismatched external config. | Activation rejects with a concrete reviewable reason and no partial transition. |
| Y08 | Source has a ready/claimed or externally unresolved Mozaik job. | Activation blocks. Expiry alone must not prove external writes did not happen; unresolved checkpoint/activity state requires reconciliation. |
| Y09 | Restore/reverse a transition after new-year grades already exist. | No snapshot overwrite or deletion of those grades. A supported reverse transition is a fresh audited operation and preserves both years. |
| Y10 | Rollover with identical group codes but entirely different pupils. | Dashboard, creation choices, membership, and compatibility mappings all represent the target cohort; archives still represent the source cohort. |

## Authorization and object-reference attacks

Test API transport and database privileges separately. The privileged service client is expected to bypass RLS; application-trigger/RPC invariants must still hold for ordinary mutations made with that client.

| ID | Adversarial action | Required outcome |
|---|---|---|
| A01 | No token, expired token, or T0 calls catalog/preview/confirm. | Reject according to the existing auth contract, including cached confirmation retries. No operation contents or sensitive roster data leak. |
| A02 | T2 confirms or reads T1's preview by guessing its UUID. | Owner-bound rejection; no plan, hashes, private pupil details, or cached result disclosed. |
| A03 | Modify response preview rows, counts, assignment IDs, target year, or roster before `yearConfirm`. | Only the stored authoritative plan is executable; reject extra execution data or ignore it safely. |
| A04 | Supply an existing W26 ID with year 2027, or W27 with year 2026. | API rejects mismatched scope; it cannot reinterpret the assignment's immutable year. |
| A05 | Bob authenticates and requests Alice's result, email, old group, Formative feedback, or dictation slug. | Authentication identity plus recorded membership determines access. Caller-supplied email/group does not override it. |
| A06 | Alice moves to group 77 in 2027 and requests her own published W26 result/comments/copy. | Access survives the move, subject to per-work visibility. New members of 2027 group 31 get none of Alice's 2026 material. |
| A07 | Guess a hidden work or result with `visible=false` through the year/archive endpoint. | Existing publication/result visibility rules remain effective; archive membership alone does not publish content. |
| A08 | Use anonymous/authenticated database roles to read or mutate operations, roster imports, credential hashes, or history directly. | RLS/grants deny access unless an intentional, reviewed policy exists. SECURITY DEFINER RPCs are not executable by those roles. |
| A09 | Call an RPC directly with forged teacher_email, without the Edge auth flow. | Unprivileged roles cannot execute it. Service-only RPCs validate active teacher and operation ownership; caller authentication remains the Edge boundary. |
| A10 | Send year/context/archived fields through generic assignment patch or result payload. | Fixed allowlists reject unsupported identity/state fields. No ordinary edit can reassign year, reopen archive, or bypass a roster restriction. |

## Stale context and delayed requests

| ID | Adversarial action | Required outcome |
|---|---|---|
| S01 | Prepare creation/import in 2026, activate 2027, then confirm the old preview. | Reject stale context before any assignment/result/link write. Explicit target assignment identity is not enough to bypass archive state. |
| S02 | Change target draft roster after activation preview. | Confirmation detects roster/context revision mismatch, even if totals and group names happen to be unchanged. |
| S03 | Change an assignment roster after a settings/import preview. | Existing operation snapshot/revision comparison detects the membership change. |
| S04 | Send a cached old-client new-work request with no annual context after rollout. | Require refresh/context; do not default silently to 2027. |
| S05 | Prepare with 2026 config, switch away and back so active year again equals 2026. | Context revision detects the intervening transition; year equality alone is insufficient. |
| S06 | A slow 2026 dashboard/detail response arrives after UI switches to 2027. | Navigation/context guard discards the response; it cannot replace roster, selected group, save target, or creation choices. |
| S07 | Both years have groups 31/77 and identical counts. | Group UI fingerprint still changes with year/context; state cannot remain associated with the old year's work. |
| S08 | Switch year while a grade is saving, including an eventual failure. | Navigation waits or rejects cleanly. The response/rollback applies only to its original work, token, and context. |
| S09 | Confirm an expired preview or an operation after its teacher was disabled. | Reject without mutation; idempotency must not bypass current authentication checks. |

## Concurrent transaction schedules

These require two independent database connections or equivalent true concurrent sessions. A single-session emulator can cover rollback and stale snapshots but cannot establish these locking guarantees. Use deterministic barriers around lock acquisition; do not rely on arbitrary sleeps or assume a specific function name.

### C01 — Grade update versus activation

- Session A starts an authorized W26 grade update and pauses after acquiring its year/context mutation protection.
- Session B confirms activation to 2027.
- A commits; B continues and archives 2026.
- Assert that A's acknowledged grade is preserved in the archive and B did not publish a partly switched context.
- Repeat with B obtaining transition protection first. A must reject as archived/stale after B commits. A must never acknowledge a write using the obsolete active context.

### C02 — Competing activations

- T1 and T2 preview transitions from the same config revision to 2027 and 2028.
- Confirm simultaneously.
- Exactly one transition succeeds from that revision; the other is stale. It must not silently archive the winning target and activate its own target using the stale source preview.
- Config, year statuses, compatibility projections, and account activation history all agree with the winner.

### C03 — Roster preparation versus activation

- A previews activation of draft roster revision N.
- B commits a roster modification to N+1 while A is confirming.
- Serialize to either a rejected stale activation or a transition using exactly the reviewed roster; never activate a hybrid list.
- Include removal/addition that leaves the total pupil count unchanged.

### C04 — Duplicate confirmation and transport retry

- Two connections confirm the same operation UUID concurrently.
- One set of writes and one logical result are produced. Both authorized callers receive the same stable result or a documented retryable contention response followed by that result.
- A later changed-payload retry cannot add writes.

### C05 — New identity collision

- Two draft-roster confirmations stage the same new email concurrently, using incompatible profile/credential data.
- No credential overwrite and no ambiguous identity merge. One plan must revalidate/reject after the first creates the identity.
- Include a concurrent deliberate account disable; activation must not undo it.

### C06 — Mozaik preparation/claim versus rollover

- Pause prepare or claim before job insertion/claim transition while activation checks for active jobs.
- Exactly one ordering wins: a valid old-year job blocks activation, or activation makes the pending prepare/claim fail.
- A check followed by an unguarded insert is not sufficient. No ready/claimed old-year job may appear after activation has concluded there were none.

### C07 — Archive versus legacy direct writer

- Race archive with direct result upsert, Formative feedback upsert, dictation progress update/restart, assignment delete, and roster-name/member mutation through their actual endpoints.
- Each write commits wholly before archive or fails wholly afterward. No endpoint remains an unguarded service-role bypass.
- Deadlocks may be reported as retryable transaction failures; partial commits or falsely successful responses are unacceptable.

### C08 — Concurrent late-member append and import

- Import preview targets W26's roster revision N while another operation appends a member.
- Confirmation rejects stale evidence or validates a documented compatible merge; it cannot drop the appended member or overwrite snapshots silently.
- Two identical append confirmations never duplicate a member or history event.

### C09 — Read consistency during transition

- Continuously request year context, dashboard, and creation metadata while activation changes projections.
- Each response is internally associated with one committed annual context/revision. If multiple queries cannot guarantee that, API must detect revision drift and retry/reject instead of returning mixed-year data.

## External source and dictation regression cases

| ID | Adversarial action | Required outcome |
|---|---|---|
| X01 | Formative source has same questionnaire/title/group code in two years. | Destination year and explicit association govern; no automatic update of the old work. |
| X02 | Legacy Formative link/saveBatch endpoint writes to archived W26 or attaches wrong-year source. | Same archive/context protections as the new import endpoint; hardcoded group allowlists removed safely. |
| X03 | Mozaik config says 2027 but assignment says 2026, including a link with null legacy scope. | Reject mismatch before external preparation; null legacy metadata is not permission to overwrite a different year. |
| X04 | Discover 2027 mapping for group 31. | 2026 mapping/link history remains unchanged; active compatibility projection cannot become the source of archived mapping truth. |
| X05 | Resume/reconcile or `claimLatest` selects an old-year job after active year changes. | Explicit correct-year reconciliation semantics or rejection; never transparently target the new year's group. |
| X06 | Open old dictation slug after student moves or split creates child assignments. | Resolve the child's recorded membership, not current group; preserve copy URL, feedback, and attempt history. |
| X07 | Open archived dictation with `started_at=null`. | Pure read: no started_at, counters, progress, or attempt-history mutation. Write actions reject as read-only without losing load access. |
| X08 | Teacher views archived dictation status with departed/comment-only members. | Historical roster is used. No current-group 31/32 filter removes those pupils or includes the next cohort. |
| X09 | Delete an archived assignment through dedicated delete endpoint or direct SQL. | Reject before cascading into results, feedback, membership, or private-copy/progress references. |
| X10 | Reuse work parameters in 2027. | New IDs and target-year roster; no copied result/comment/progress, publication state, Formative/Mozaik association, or ambiguous reused slug. Explicitly review the metadata allowlist. |

## SQL guard review checkpoints

Use these checkpoints when reviewing the actual migration and functions, before enabling `school_year_config.enforced`.

- **Trigger coverage:** enumerate actual insert/update/delete writers to assignments, results, assignment roster, enrollments, Formative feedback, dictation feedback/progress, year groups/config, and Mozaik links/jobs. Direct service-role endpoints must not bypass year/archive checks.
- **Lock ordering:** identify the year/config lock acquired by every mutation and transition. Check prepare/claim/job insertion, not only final grade confirmation. Document deliberate deadlock/retry behavior; ensure callers do not retry a partially applied external mutation blindly.
- **Immutable identities:** ordinary patches cannot change assignment year, member assignment/email/year/group, or archived external scope. Enrollment changes append history. Any maintenance/split exception must be narrow and audited.
- **Cross-table consistency:** a roster row's year equals its assignment year; group belongs to that year; any enrollment reference matches the same identity/year. Do not trust duplicate client-supplied year columns without validation.
- **Snapshot completeness:** membership changes alter the stale-preview evidence used by existing import/settings/split operations. Updating only a separate roster table without revising snapshots is insufficient.
- **Operation binding:** teacher, kind, request hash/content, source and target year revisions, roster revision, expiry, and stored confirmation result are checked under appropriate locks. Cached results are returned only after authorization.
- **Archive delete guard:** test parent deletion and cascades. The year guard must execute before dependent data can disappear; `ON DELETE CASCADE` is not an archive policy.
- **Split compatibility:** new roster dependencies participate in preview/confirm, correct child attribution, preserved year, and audit snapshots. Unknown dependencies remain fail-closed.
- **Security-definer hygiene:** fixed/empty search_path, qualified table references, fixed patch allowlists, bound values, no public/anon/authenticated execute grants on privileged RPCs. RLS on new exposed tables; service-role access intentionally limited to the API workflow.
- **Maintenance bypasses:** inspect any session settings, trigger-disable mechanisms, `enforced=false` branches, or helper parameters. Unprivileged callers and ordinary API payloads cannot select a bypass. Enabling enforcement cannot strand existing rows silently.
- **Credential boundary:** no roster operation writes existing fiche/password/session/reset hashes. Activation of staged new profiles cannot reactivate old disabled profiles by a broad `active=false` predicate.
- **Projection boundary:** historical readers do not authorize with `school_students.group_code`, current `active` enrollment, or the global group mapping. Global account `active` still applies to authentication.
- **No implicit year:** absence of annual context on creation/import rejects. Server clock, work title, and current group are not fallback evidence for old membership or external associations.
- **Reopen semantics:** reopening an archive for manual corrections does not change active config or allow external operations for that year. Historical corrections remain constrained to recorded membership.
- **Deployment compatibility:** keep enforcement disabled until all reader/writer versions are compatible, but verify the disabled mode cannot be invoked through an ordinary request. Re-enable only after bootstrap conservation and endpoint coverage checks pass.

## Completion evidence

Record test IDs executed, implementation revision, fixture version, and outcome. Separate SQL transaction tests, Edge/API tests, browser tests, and genuine concurrent-session tests. For every conservation test, record compared table sets and canonical before/after equality; a count-only check is insufficient. Report unexecuted concurrency or endpoint coverage explicitly rather than labeling the whole feature verified.

Do not archive the real current year as a deployment smoke test. Verify production installation through schema/function version checks and read-only conservation evidence; run destructive/transition scenarios only against synthetic isolated fixtures.
