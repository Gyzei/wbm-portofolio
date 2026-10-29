# Local Setup and Tests

## Environment evidence
The checked-out app uses PHP with `mysqli` and MySQL. This workspace has Laragon-style Windows paths. `koneksi.php` contains the connection configuration and uses database name `portofolio`; inspect/configure that file for the local environment. The app creates/adjusts several tables at runtime. Do not copy local credentials into documentation.

No Composer/package manifest or build script was found. Admin pages require an authenticated session.
The project directory is not a Git repository, so version-control status/history could not be inspected.

## Tests
- `php tests/interactive-store-test.php` — isolated graph validation; no database needed. Executed during memory audit: **22 checks passed**.
- `php -l admin.php` and `php -l dashboard/interactive.php` — syntax checks; executed during audit and passed.
- `tests/interactive-editor-test.html` — browser regression harness; requires the app reachable on localhost and an authenticated session. It mocks draft-save requests in its iframe and is designed not to write test changes to the database.
- `php tests/interactive-persistence-test.php portofolio_review_<suffix>` — database/filesystem integration test. Only use a disposable database whose name begins `portofolio_review_`; the script reads and restores the existing draft row and creates/removes a temporary video fixture. Not executed during this audit.

## Latest verification
- Authenticated browser regression: **106 checks passed**, with mocked saves and no test writes to the server. A stale X/Y-input test now uses dragging and undo instead, since coordinate fields were removed.
- Scenario menu → `scenario=1` editor verified: dashboard sidebar/topbar hidden, canvas present, return link targets the menu.
- Graph validation: **22 checks passed**. Setup validation: `php tests/setup-admin-test.php`, **4 checks passed** without database access.
- PHP lint passed for auth, setup, admin, editor shell/menu, and setup tests. JavaScript test syntax passed.
- PHP is available at `C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe` even when absent from PATH.
- Persistence integration, successful first-account provisioning on a disposable database, and production deployment remain unverified.

## First administrator setup
Web requests no longer create accounts. `setup-admin.php` is CLI-only (HTTP returns 404), requires `PORTFOLIO_ADMIN_USERNAME` and `PORTFOLIO_ADMIN_PASSWORD` environment variables, and refuses to create an account if any user already exists. Username accepts 1–50 ASCII letters, numbers, dot, underscore, or dash; password requires 12–72 bytes. It hashes the password and locks the users table during the empty-table check and insert; the database account needs `LOCK TABLES` permission.

For a new installation, set those environment variables privately in the local terminal, then run `php setup-admin.php` from the project root. Do not pass passwords as command-line arguments or commit them. Remove the environment variables immediately afterwards. Existing accounts are not reset or changed; use authenticated Settings to change an old/default password before deployment. No successful provisioning test was run against the live database.
