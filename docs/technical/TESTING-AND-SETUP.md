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

## Current verification limitation
The browser test URL previously returned `502 Bad Gateway`; rerun it once the local web stack is available. The browser suite, persistence test, and production deployment have not been verified in this audit.

## Security follow-up
`auth.php` provisions an administrator using a hard-coded initial password when the users table is empty. Whether this local bootstrap is reachable in any deployed environment is unknown. Before deployment, replace it with a safe first-run provisioning/reset flow and verify existing installations do not depend on the bootstrap behavior.
