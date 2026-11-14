# Current state — Cardinal / Gestion / Mozaïk

Reference: release 1.3.53, 13 November 2026. Read this file first.

## Current release

The coordinated Mozaïk correction is in PR #1 (`fix/mozaik-ponderation-source-20261113`). The Supabase `mozaik-sync` function v8 and the `mozaik_cancel_reviewed_planned` migration were deployed on 13 November. This frontend is intended to be published by merging that PR after the final CI check. Check the actual PR merge/build status before describing the frontend as deployed.

Required unpacked extension: **Cardinal 1.3.53**. The page refuses earlier extension versions before a new sync. The historical `resultats/mozaik/extension` folder and old latest.json are NOT the source for this archive. Do not rebuild 1.3.53 from them.

Archive: `Cardinal_1.3.53_Mozaik.zip`, SHA-256 `bae02a6f31e5d17e65e87122792af1e977d2e9d3637a68863433a469fb6be9fd`.
Actual legacy-service-worker.js SHA-256: `261853d79d64a410a321e88bca02b62b9e9ea087709fdbdb5fe0a5fe5cc36271`.

## Behavior and safeguards

Each NEW group-specific job requires an explicit choice of weighting authority: Gestion or the freshly read, exact Mozaïk activity. The chosen authority also supplies report-card inclusion. Non-bulletin = null weight, never an invented zero. Choosing Mozaïk never silently overwrites Gestion metadata. The maximum remains Gestion's; every scale change and affected outside-batch row is shown before confirmation.

Backend preparation explicitly acknowledges the choice; the claimed job and extension preview must match it. Resume and recovery validate exact assignment/group. A stale UI context, incompatible worker, changed native activity/results or incomplete verification blocks publication. Descriptions are serialized with the native PUT model without discarding their HTML.

The independent cancellation button calls the existing authenticated RPC. A reviewed planned job may be abandoned only for an exact existing activity link and before the durable parameters_verified checkpoint required before grade writes. Unknown/inflight native activity requests are preserved. Owner checks and service-role-only execution remain. Cancellation does not remove grades or restore activity settings; the teacher sees that warning and must prepare a new preview.

No real student grades or activity records were used for testing or modified by the release procedure. The existing failed job was not cancelled automatically. The teacher must install/reload the extension and confirm the real group32 import.

## Verification

294 actual local Node tests passed, including the native sync engine with simulated Mozaïk responses, PostgreSQL journal integration, cross-group identity, outside-batch rescaling, preserved special grades and interrupted-job handling. The extension has 9 focused behavior tests; 84 JavaScript files passed node --check. Chromium exercised the actual weighting dialog. These are NOT an authenticated end-to-end test on the user's Mozaïk account.

CI runs the coordinated UI/backend contract plus isolated PostgreSQL regressions. The extension-dependent destination-switch suite needs the supplied current unpacked extension and is included in local release validation, not standalone CI. Do not represent a selective CI pass as all 294 tests.

## Historical project state preserved

The complete preceding CURRENT_STATE.md is retained byte for byte at [archive/CURRENT_STATE_before_1353.md](archive/CURRENT_STATE_before_1353.md). Consult it for Formative, annual rosters, dictation feedback, deployment history and earlier constraints. Its older version/live-status statements are historical, not current release authority.

Keep reading `CHATGPT_PROJECT_INSTRUCTIONS.md`, `FORMATIVE_PROTOCOL.md`, `MOZAIK_PROTOCOL.md` and `BACKEND_AND_DB.md` as appropriate. Never publish HAR data, bearer/session secrets, fiches or individual student results in GitHub. Fetch deployed Supabase source before changing it; preserve custom authentication and verify_jwt=false.
