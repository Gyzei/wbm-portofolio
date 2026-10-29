# Repository audit

Audit of application entry points and main persistence paths at Git revision `783202e`. Assumed one administrator, a modest public portfolio, and occasional concurrent editor tabs. Findings are from code inspection; no exploit was attempted against the live database.

## Findings
- **CSRF on admin writes:** `admin.php` accepts project, highlight, upload, and profile POST actions without checking the session token. When an administrator's session cookie is sent with an attacker-origin request, the request can create, alter, or delete content. Apply and test the existing token check to every state-changing action.
- **Active SVG uploads:** `admin.php` checks the filename extension and size but accepts arbitrary SVG into a publicly served directory. A malicious SVG opened directly can run script under the application origin, depending on server headers. Reject SVG or sanitize it and serve uploads from a separate origin with safe headers.
- **Unsafe project links:** `admin.php` accepts arbitrary `project_link` values, and `index.php` uses HTML escaping but does not restrict URL schemes. A `javascript:` link saved through a crafted request can execute when a visitor clicks it. Validate allowed schemes server-side before saving and rendering.
- **Orphan highlights — fixed for future deletions:** project deletion now removes linked highlights transactionally and renumbers the remainder; saving a highlight locks its project. Isolated database checks passed. Existing orphan rows are not automatically removed; authenticated browser and concurrent-request checks remain unverified. See [[docs/features/content-management]].
- **No login throttling:** `login.php` allows repeated password attempts with no application-level rate limit. An exposed login can be guessed repeatedly; add an appropriate shared rate limit and test it.
- **Undo merges different fields — fixed:** typing groups now include the field, scene, and choice identity; authenticated browser regression passed 122 checks with mocked saves. See [[docs/features/story-flow-editor]].
- **Orphaned upload on database failure — fixed for confirmed insert errors:** failed inserts remove the newly uploaded file and report failure; cleanup failures are logged. Connection-loss errors retain the file because the insert outcome may be unknown. Isolated database tests passed; see [[docs/features/media-library]].

## Verification and limits
- `interactive-store-test.php`: 22 checks passed; `setup-admin-test.php`: four invalid-input checks passed; `interactive-media-path-test.php`: path boundary checks passed. PHP syntax for `admin.php` and JavaScript syntax for `dashboard/interactive.js` passed.
- During the original audit, no authenticated browser regression, live-database writes, full upload/deletion end-to-end, deployment configuration, or load/security penetration test was performed. Later checks are described in the linked feature notes and [[docs/technical/TESTING-AND-SETUP]].
- The upload failure finding was identified by inspection and subsequently tested with induced insert errors on temporary tables in a disposable database.
