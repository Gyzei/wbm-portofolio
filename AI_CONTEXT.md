# AI Context

## Project
PHP/MySQL portfolio and admin CMS with an interactive branching-video editor.

## Current State
Interactive video now supports separate scenarios; legacy migration and persistence passed 27 checks on isolated databases. Browser verification remains outstanding. Uploads use `uploads/`; legacy `assets/` remains supported. Admin setup is CLI-only.

## TODO
- [ ] Fix admin CSRF gaps, unsafe SVG uploads and project URL schemes; see [[docs/technical/REPOSITORY-AUDIT]].
- [ ] Fix orphaned highlights when deleting a project and add login throttling.
- [ ] Handle failed media database inserts without leaving uploaded files behind.
- [ ] Verify scenario creation, switching and editor regression in an authenticated browser at desktop and mobile widths.
- [ ] Verify successful first-admin setup on a disposable database.
- [ ] Confirm existing administrator password is not the former default before deployment.
- [ ] Fix undo grouping when edits switch between different fields within 700 ms.
- [ ] Verify upload and media deletion end-to-end for `uploads/` using a disposable database.

## Critical Constraints
- Preserve source media, auth/CSRF, server-side graph/media validation, and revision locking.
- Run persistence tests only against isolated `portofolio_review_*` databases.

## References
- Design: [[docs/design/DESIGN]]
- Architecture: [[docs/architecture/ARCHITECTURE]]
- Decisions: [[docs/decisions/DECISIONS]]
- Docs index: [[README]]
- Feature map: [[docs/features/interactive-video-draft]]
- Testing: [[docs/technical/TESTING-AND-SETUP]]

## Session Handoff
Use Laragon PHP's absolute path in testing notes. Never run provisioning/persistence tests against the live database.
