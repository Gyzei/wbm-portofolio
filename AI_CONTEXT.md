# AI Context

## Project
PHP/MySQL portfolio and admin CMS with an interactive branching-video editor.

## Current State
The editor has a floating/reopenable scene inspector, searchable custom pickers, video-duration-bounded `MM:SS` timers, lazy video thumbnails, and bounded in-memory undo/redo. JS syntax checks pass; browser regression is pending.

## TODO
- [ ] Run authenticated `tests/interactive-editor-test.html` and verify floating inspector, picker, timer, undo/redo, and editor behavior.
- [ ] Replace hard-coded first-admin bootstrap in `auth.php` before deployment.

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
Start local Laragon PHP/MySQL and run the authenticated browser regression; CLI PHP was unavailable on PATH and the prior local URL returned 502.
