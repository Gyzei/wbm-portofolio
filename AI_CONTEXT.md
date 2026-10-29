# AI Context

## Project
PHP/MySQL portfolio and admin CMS with an interactive branching-video editor.

## Current State
Interactive video supports separate scenarios; persistence passed 27 isolated-database checks and editor regression passed 122 browser checks with mocked saves. Uploads use `uploads/`; legacy `assets/` remains supported. Admin setup is CLI-only.

## TODO
- [ ] Fix admin CSRF gaps, unsafe SVG uploads and project URL schemes; see [[docs/technical/REPOSITORY-AUDIT]].
- [ ] Add login throttling.
- [ ] Verify scenario creation and switching in an authenticated browser at desktop and mobile widths.
- [ ] Verify successful first-admin setup on a disposable database.
- [ ] Confirm existing administrator password is not the former default before deployment.
- [ ] Verify upload and media deletion end-to-end for `uploads/` using a disposable database.

## Critical Constraints
- Preserve source media, auth/CSRF, server-side graph/media validation, and revision locking.
- Run persistence tests only against isolated `portofolio_review_*` databases.

## References
- Root entrypoint: [[README]]
- Docs index: [[docs/INDEX]]

## Session Handoff
Use Laragon PHP's absolute path in testing notes. Never run provisioning/persistence tests against the live database.
