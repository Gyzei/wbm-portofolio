# Media library

Authenticated administrators upload, browse, rename, and delete local media. The upload handler accepts an extension allowlist for images, videos and documents with a 10 MB limit, stores new files under `uploads/`, and records their address and name in MySQL. Renaming changes the display name, not the physical path. Existing files under `assets/` are not moved and remain accessible.

If recording a newly uploaded file fails, the handler reports failure and removes that new file. Cleanup failures are logged. If MySQL reports a lost connection, the insert outcome can be unknown, so the file is retained and logged for reconciliation instead of risking deletion of a recorded file. Existing orphaned uploads are not cleaned automatically.

The interactive editor lists existing MP4, WebM and MOV files under `uploads/` or the legacy `assets/` root. Deletion checks all interactive scenarios and canonical path aliases; referenced videos are protected, and unused files are unlinked after the database deletion commits. Source media remains when a scene is removed. See [[docs/features/story-flow-editor]] and [[docs/decisions/DECISIONS]].

**Verification:** `tests/interactive-media-path-test.php` checks new and legacy roots, aliases and traversal without a database; graph validation also passed. Upload and deletion end-to-end for the new root remain unverified. **Limitations:** the upload handler checks extensions and size; media verification or transcoding is not implemented. Browser codec support varies. Database/filesystem integration tests require a disposable database; see [[docs/technical/TESTING-AND-SETUP]].

`tests/media-upload-test.php` passed with temporary tables on a disposable database: it checks successful recording, failed inserts in strict and non-strict MySQL modes, and preservation of unrelated files. Real HTTP upload, connection-loss ambiguity, and failed file cleanup were not tested.

## Related project files
- [admin.php](../../admin.php) — upload and media management actions.
- [dashboard/media-store.php](../../dashboard/media-store.php) — upload record and failure cleanup.
- [tests/media-upload-test.php](../../tests/media-upload-test.php) — isolated upload recording and cleanup checks.
- [dashboard/interactive-store.php](../../dashboard/interactive-store.php) — media paths and deletion safeguards.
- [tests/interactive-media-path-test.php](../../tests/interactive-media-path-test.php) — path boundary checks.
