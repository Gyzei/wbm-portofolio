# Content management

The authenticated dashboard in `admin.php` manages projects, featured highlights, and the public profile. Administrators can create, edit, and delete projects with title, category, description, cover, and link. Editing a project synchronizes associated highlight content. Highlights reference projects with covers, can be reordered or removed, and are limited to five. The profile form updates public name, username, email, phone, photo, and description.

Projects and highlights are stored in MySQL; image selection uses [[docs/features/media-library]]. The public result is described in [[docs/features/public-portfolio]].

**Verification:** routes and handlers were inspected during mapping; create/edit/delete workflows and database writes were not tested in this task.

## Related project files
- [admin.php](../../admin.php) — project, highlight, and profile handlers.
- [dashboard/dashboard.js](../../dashboard/dashboard.js) — dashboard interactions.
