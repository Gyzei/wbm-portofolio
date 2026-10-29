# Media library

Authenticated administrators upload, browse, rename, and delete local media. The upload handler accepts an extension allowlist for images, videos and documents with a 10 MB limit, stores new files under `uploads/`, and records their address and name in MySQL. Renaming changes the display name, not the physical path. Existing files under `assets/` are not moved and remain accessible.

The interactive editor lists existing MP4, WebM and MOV files under `uploads/` or the legacy `assets/` root. Deletion checks the shared interactive draft and canonical path aliases; referenced videos are protected, and unused files are unlinked after the database deletion commits. Source media remains when a scene is removed. See [[docs/features/story-flow-editor]] and [[docs/decisions/DECISIONS]].

**Verification:** `tests/interactive-media-path-test.php` checks new and legacy roots, aliases and traversal without a database; graph validation also passed. Upload and deletion end-to-end for the new root remain unverified. **Limitations:** the upload handler checks extensions and size; media verification or transcoding is not implemented. Browser codec support varies. Database/filesystem integration tests require a disposable database; see [[docs/technical/TESTING-AND-SETUP]].
