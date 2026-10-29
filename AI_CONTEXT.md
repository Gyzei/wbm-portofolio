# AI Context

## Project
PHP/MySQL portfolio and admin CMS with an interactive branching-video editor.

## Current State
Scenario navigation verified. Story Flow library toggle and editor regression passed 112 browser checks. New uploads use `uploads/`; legacy `assets/` remains supported. Admin setup is CLI-only.

## TODO
- [ ] Run editor browser regression after logging in to verify Rapikan changes.
- [ ] Verify successful first-admin setup on a disposable database.
- [ ] Confirm existing administrator password is not the former default before deployment.
- [ ] Verify and fix undo grouping when edits switch between different fields within 700 ms.
- [ ] Verify upload and media deletion end-to-end for `uploads/` using a disposable database.

## Critical Constraints
- Preserve source media, auth/CSRF, server-side graph/media validation, and revision locking.
- Run persistence tests only against isolated `portofolio_review_*` databases.

## References
- Design: [[docs/design/DESIGN]]
- Architecture: [[docs/architecture/ARCHITECTURE]]
- Decisions: [[docs/decisions/DECISIONS]]
- Docs index: [[docs/README]]
- Feature map: [[docs/features/interactive-video-draft]] and [[docs/README]]
- Testing: [[docs/technical/TESTING-AND-SETUP]]

## Session Handoff
Use Laragon PHP's absolute path in testing notes. Never run provisioning/persistence tests against the live database.
