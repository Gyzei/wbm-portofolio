# AI Context

## Project
PHP/MySQL portfolio and admin CMS with an interactive branching-video editor.

## Current State
Scenario navigation verified; authenticated editor regression passed 106 checks. Automatic default-admin creation replaced by CLI-only setup; existing accounts unchanged. See testing notes for commands and limits.

## TODO
- [ ] Verify successful first-admin setup on a disposable database.
- [ ] Confirm existing administrator password is not the former default before deployment.

## Critical Constraints
- Preserve source media, auth/CSRF, server-side graph/media validation, and revision locking.
- Run persistence tests only against isolated `portofolio_review_*` databases.

## References
- Design: [[docs/design/DESIGN]]
- Architecture: [[docs/architecture/ARCHITECTURE]]
- Decisions: [[docs/decisions/DECISIONS]]
- Docs index: [[docs/README]]
- Testing: [[docs/technical/TESTING-AND-SETUP]]

## Session Handoff
Use Laragon PHP's absolute path in testing notes. Never run provisioning/persistence tests against the live database.
