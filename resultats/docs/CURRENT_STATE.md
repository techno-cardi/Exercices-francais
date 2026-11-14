# Current state — Cardinal / Gestion / Mozaïk

Reference: coordinated release 1.3.54, 13 November 2026 (Québec).
Baseline 1.3.53 was deployed by PR #1 and Kevin confirmed a successful real import.

## New requirement and behavior

In the SAME dialog, independently choose Gestion or Mozaïk for (1) weighting and bulletin inclusion and (2) maximum points. New jobs explicitly set alignmentVersion=1 and maximumSource; old jobs retain their frozen 1.3.53 behavior. No choice is selected by default. Mozaïk sources require an existing identified activity.

Both systems are aligned only after the teacher confirms the preview and the native write is fully reread. When Mozaïk's maximum is selected, Gestion scores are converted proportionally (56/70 → 80/100), rounded once to a tenth. Canonical bases are retained when consistent, preventing repeated scale-rounding. Empty grades stay empty; feedback, visibility, native special codes and outside-batch rows are preserved. The preview shows current Gestion values, current Mozaïk values, and selected final values.

The PostgreSQL checkpoint validates the choices, original source snapshot, exact target and each matched grade before native writing. Finalization atomically updates local metadata, converted scores, link and completion receipt. A lost completion response is replayable without reconverting. A newer Gestion edit is never overwritten by stale recovery: the old native job may finish, but the current source stays dirty for a new preview. External Mozaïk and PostgreSQL are NOT one distributed transaction; the journal handles interruptions.

The editor is inert during sync. A failed post-alignment reload leaves editing blocked until refresh, rather than allowing stale denominators to be saved.

## Compatibility and installation

Required unpacked extension: Cardinal 1.3.54. Never rebuild from historical resultats/mozaik/extension. Install by replacing the current unpacked extension files, reload it, then reload Gestion and Mozaïk. Permissions and unrelated Formative/Classroom code are unchanged. The existing Formative import workflow remains unchanged; this alignment applies when confirming a Mozaïk synchronization, not continuous background synchronization.

Archive: Cardinal_1.3.54_Parametres_Mozaik_Gestion.zip
SHA-256: 05577a5f2f9737526107dc5ac9bf62fa568767e3b09b461b4e738c1608a18309

## Validation and deployment boundary

306 local Node tests passed (0 failed, 0 skipped), including four combinations with the actual extension engine plus isolated PostgreSQL; only Mozaïk HTTP is simulated. Nine focused extension tests passed and 84 JS files pass syntax checks. Browser tests exercised all combinations, cancellation and disabled Mozaïk choices on a new activity. No actual student results were sent or changed in testing.

Migration: 20261114001000_mozaik_parameter_alignment.sql. Edge Function preserves existing custom authentication and verify_jwt=false. Check the actual deployed version, merged PR and Pages deployment before stating that this release is live. The first real authenticated synchronization of 1.3.54 remains a user confirmation, not a test performed here.

## Historical state

Complete previous state: archive/CURRENT_STATE_before_1354.md. Existing 1.3.53 fixes (native PUT descriptions, protected cancellation, explicit weighting) remain. Never publish HARs, tokens, fiches or real results. Read CHATGPT_PROJECT_INSTRUCTIONS.md and relevant protocol docs before changes.
