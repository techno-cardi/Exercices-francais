# Clear, guarded Mozaïk preview

**Goal:** make the existing 1.3.54 confirmation easier to inspect without changing either backend or grade-writing engine.
**Architecture:** standalone presentation-only review module loaded before assignment-actions; pure analysis + DOM renderer. Existing sync still receives only the teacher's Boolean confirmation and the original unmodified payload.
**User authorization:** user explicitly requested selecting and coding useful improvements. Choices below are implementation decisions, not additional teacher grading policies.

## Decisions and constraints
- Improve the confirmation view instead of a large refactor or new automatic sync behavior.
- Summarize additions, result modifications, scale conversions and identical rows, comparing BOTH systems when local alignment is active.
- A proportional conversion rounded to one decimal is not labeled a lowered grade; zero and absence are distinct.
- Search and display filters NEVER select or exclude outgoing grades. Display this explicitly.
- Require additional acknowledgment only for positive-to-zero replacement, replacing a special code, and newly making results visible. This does not alter the existing extension zero guard.
- Invalid/empty/incomplete preview blocks confirmation; unknown state is not inferred as valid.
- Stale reconciliation never claims that Gestion will be overwritten or aligned. Preserve current 1.3.54 protocol and version requirement.
- No database migration, no new permissions, no real student writes, no logs or persistence of displayed identities.

## Implementation and verification
- [x] Baseline suite with actual 1.3.54 archive and isolated PGlite runtime.
- [x] Pure tests fail before module exists; implement classifiers, summary, filters, risks.
- [x] Real Chromium tests fail on old confirmation; integrate renderer, risk acknowledgment, clear labels and CSS.
- [x] Test all four source combinations still select as before, recovery wording, empty filter cannot bypass guard, XSS strings are text, close/Escape cancels.
- [x] Run full inherited suite, syntax checks, new Node and browser tests; review exact diff.
- [ ] Publish isolated PR, confirm CI, merge bounded UI improvement and verify Pages; no extension archive change.

## Workspace ledger
Base main: 59b2a8827af6896b9a7fe825748acf1b4927a41d, fetched via GitHub. Full snapshot from verified 1.3.54 Actions artifact.
Container cannot clone GitHub (DNS). Working on separate local branch from downloaded source; connector used for writes with exact remote head/blob checks.
Initial suite: 297 passed, 3 fixture-path ENOENT failures; tests hard-code ../cardinal-gestion-candidate. Supply symlink to exact 1.3.54 archive, not a product code change.

Additional review: no subagent runtime is available; performed inline full diff review plus real Chromium checks, not an independent reviewer claim. Added close-event/settled handling; Escape cancels; unknown/null metadata is labeled honestly; scoped CSS keeps footer visible and table horizontally scrollable on 390px viewport. Backend, extension, max/weight choice logic and native HTTP remain untouched.
