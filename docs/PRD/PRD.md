# Product Requirements — Portfolio CMS

## Overview
The project is a public personal-portfolio site backed by an administrator CMS. Administrators maintain portfolio projects, featured highlights, profile details, uploaded media, and separate branching interactive-video scenarios.

## Users and objectives
- **Portfolio visitor:** browse project work, featured highlights, and profile information.
- **Administrator:** manage the public content and compose/preview branching video stories using library media.

## Functional requirements and observed implementation
- Public site reads profile, project, and highlight data from MySQL (`index.php`). Highlights are limited to five; project ordering is stable per visitor session and prioritizes linked projects.
- Admin can create/update/delete projects, choose up to five highlights, reorder them, update profile/account settings, and upload/rename/delete media (`admin.php`). Media uploads are limited to 10 MB and an extension allowlist.
- Interactive editor supports up to 100 scenes and eight choices per scene; graph nodes can be positioned, reordered, connected/reconnected, assigned a video, and previewed (`dashboard/interactive.js`).
- Choice timers are optional seconds (0–86,400); timed buttons appear during playback when reached, while untimed choices appear at video end. Timer value is stored on the choice.
- Interactive draft saves use revision checking, CSRF token verification, and server-side validation (`dashboard/interactive-api.php`, `dashboard/interactive-store.php`). Media referenced by the draft cannot be removed; deleting a scene does not delete media.

## Quality and safety constraints
- Preserve authentication and server-side input validation on admin writes.
- Never allow a failed media/database operation to delete or orphan source files; preserve stale-draft conflict behavior.
- Browser interaction should remain keyboard-accessible and responsive; verify UI behavior with the browser regression page.

## Acceptance checks
- Visitors see stored portfolio content; admin edits persist in MySQL.
- A valid interactive graph saves/reloads, stale revisions do not overwrite it, and invalid or unavailable media is rejected.
- A timer choice appears at its configured playback time without pausing video; unset choices appear at video end.
- A media item in use is protected from deletion.

## Scope exclusions and unknowns
- A public interactive-video player is not implemented; scenarios are managed and previewed in the admin editor.
- Production hosting/deployment requirements and supported browser matrix are **unknown** from repository evidence.
- No package manifest or automated build configuration is present in the project root.
