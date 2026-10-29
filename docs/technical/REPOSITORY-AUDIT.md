# Repository audit

Audit of application entry points and main persistence paths at Git revision `783202e`. Assumed one administrator, a modest public portfolio, and occasional concurrent editor tabs. Findings are from code inspection; no exploit was attempted against the live database.

## Findings
- **CSRF on admin writes:** `admin.php` accepts project, highlight, upload, and profile POST actions without checking the session token. When an administrator's session cookie is sent with an attacker-origin request, the request can create, alter, or delete content. Apply and test the existing token check to every state-changing action.
- **Active SVG uploads:** `admin.php` checks the filename extension and size but accepts arbitrary SVG into a publicly served directory. A malicious SVG opened directly can run script under the application origin, depending on server headers. Reject SVG or sanitize it and serve uploads from a separate origin with safe headers.
- **Unsafe project links:** `admin.php` accepts arbitrary `project_link` values, and `index.php` uses HTML escaping but does not restrict URL schemes. A `javascript:` link saved through a crafted request can execute when a visitor clicks it. Validate allowed schemes server-side before saving and rendering.
- **Orphan highlights — fixed for future deletions:** project deletion now removes linked highlights transactionally and renumbers the remainder; saving a highlight locks its project. Isolated database checks passed. Existing orphan rows are not automatically removed; authenticated browser and concurrent-request checks remain unverified. See [[docs/features/content-management]].
- **No login throttling:** `login.php` allows repeated password attempts with no application-level rate limit. An exposed login can be guessed repeatedly; add an appropriate shared rate limit and test it.
- **Undo merges different fields:** `dashboard/interactive.js` groups all typing within 700 ms without tracking which field changed. Editing a title and a choice quickly then undoing can undo both. Group only consecutive input on the same field and add a regression check.
- **Orphaned upload on database failure:** `admin.php` moves an uploaded file before inserting its media record and does not remove it if the insert fails. The file remains on disk without a library entry. Catch the insertion failure, remove the newly created file, report failure, and test that path.

## Verification and limits
- `interactive-store-test.php`: 22 checks passed; `setup-admin-test.php`: four invalid-input checks passed; `interactive-media-path-test.php`: path boundary checks passed. PHP syntax for `admin.php` and JavaScript syntax for `dashboard/interactive.js` passed.
- No authenticated browser regression, live-database writes, full upload/deletion end-to-end, deployment configuration, or load/security penetration test was performed. Historical disposable-database persistence results are in [[docs/technical/TESTING-AND-SETUP]].
- Follow-up audit rechecked the main handlers and reran the same no-database checks; the new upload failure finding is based on code inspection, not an induced database failure.
