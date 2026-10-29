# Content management

The authenticated dashboard in `admin.php` manages projects, featured highlights, and the public profile. Administrators can create, edit, and delete projects with title, category, description, cover, and link. Editing a project synchronizes associated highlight content. Highlights reference projects with covers, can be reordered or removed, and are limited to five. The profile form updates public name, username, email, phone, photo, and description.

Projects and highlights are stored in MySQL; image selection uses [[docs/features/media-library]]. The public result is described in [[docs/features/public-portfolio]].

Deleting a project also deletes its linked highlights and renumbers the remaining highlights in the same transaction; unrelated highlights and media are preserved. Saving a highlight locks its selected project to coordinate with project deletion. Existing orphan highlights from before this change are not removed automatically.

**Verification:** `tests/project-delete-test.php` passed against temporary InnoDB tables in an isolated `portofolio_review_*` database. It checks linked and unrelated highlights, ordering, a missing project, and a database-error path. Browser workflows and concurrent highlight creation/deletion remain unverified.

## Related project files
- [admin.php](../../admin.php) — project, highlight, and profile handlers.
- [dashboard/project-store.php](../../dashboard/project-store.php) — transactional project and highlight deletion.
- [tests/project-delete-test.php](../../tests/project-delete-test.php) — isolated project deletion checks.
- [dashboard/dashboard.js](../../dashboard/dashboard.js) — dashboard interactions.
