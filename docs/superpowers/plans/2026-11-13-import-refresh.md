# Import visibility repair

Goal: confirmed Mozaik metadata and Formative imports refresh the accepted catalogue and both cards views without browser reload. Preserve group, year, filters, grades and sync engine.

1. Reproduce missing post-import render in both existing UI harnesses.
2. Add opt-in renderViews to refreshTeacherData, reject late same-year reads and old session/year responses.
3. Repaint after each confirmed import; retain the confirmation receipt for a READ-ONLY refresh retry if catalogue read fails. Never report a committed import as a failed write or create a duplicate for a refresh. Never reopen work after navigation/session changes.
4. Tests: both paths, delayed reads, failed reads, retry, double click, filters preserved and session/year transitions; full offline suite and browser smoke.
5. Publish frontend only after exact source verification and CI. Keep Cardinal 1.3.54 and existing APIs/schema.
