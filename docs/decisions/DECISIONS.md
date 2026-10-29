# Decisions

#### CLI-only first administrator provisioning
- Web requests initialize the users schema but never create an account. `setup-admin.php` accepts credentials through environment variables, rejects invalid input, and refuses existing installations under a table lock.
- Existing users and passwords remain unchanged; old/default credentials must be changed through authenticated Settings before deployment.
- Evidence: `auth.php`, `setup-admin.php`, and `tests/setup-admin-test.php`. Invalid-input checks and web denial were tested; successful setup on an empty disposable database is unverified.

#### Single shared administrator draft
- Status: Accepted (verified implementation).
- Context: The current admin login accepts the primary account; the editor maintains one project-wide draft.
- Decision: Store one interactive-video graph in MySQL, protected by an integer revision and row locking.
- Evidence: `auth.php` (`requireLogin`/`primaryAccountId`), `dashboard/interactive-store.php` (`interactive_video`, `saveInteractiveDraft`).
- Consequences: Separate stories would require a story identifier and a revised persistence model.

#### Optional per-choice timer
- Status: Accepted (implemented; browser regression still needs execution).
- Context: A branch choice can become available during video playback.
- Decision: Save nullable `timeSec` on a choice; null means display at video end. Validate values from 0 through 86,400 seconds.
- Evidence: `dashboard/interactive.js` (inspector and preview), `dashboard/interactive-store.php` (`validateInteractiveGraph`), `tests/interactive-store-test.php`.
- Consequences: Legacy choices without the field normalize to null; timed and untimed choices have different preview timing.

#### Preserve in-use media
- Status: Accepted (verified implementation).
- Context: Interactive scenes reference existing Media Library records and files.
- Decision: Protect referenced entries (including aliases to the same canonical file) from deletion; unlink unused files only after the database deletion commits.
- Evidence: `dashboard/interactive-store.php` (`deleteInteractiveMedia`), `tests/interactive-persistence-test.php`.
- Consequences: Media deletion can return an in-use or cleanup-failed result; keep file and database failure handling coordinated.
