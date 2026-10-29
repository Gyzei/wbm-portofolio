# Administrator access and settings

`login.php` authenticates the primary account with its password hash, regenerates the session on login, and redirects to the dashboard. `auth.php` enforces the primary-account rule for admin pages; `logout.php` ends the session. Settings allow the administrator to update display name, username and password.

First-account creation is CLI-only through `setup-admin.php` and refuses to change installations where users already exist. Inputs and safe operational instructions are in [[docs/technical/TESTING-AND-SETUP]]; no credentials belong in project memory. Existing accounts are not reset by setup. See [[docs/decisions/DECISIONS]].

**Verification:** earlier checks covered invalid setup inputs and HTTP denial; successful setup on an empty disposable database and the current account's password remain unverified.

## Related project files
- [auth.php](../../auth.php), [login.php](../../login.php), and [logout.php](../../logout.php) — session access and login.
- [setup-admin.php](../../setup-admin.php) and [tests/setup-admin-test.php](../../tests/setup-admin-test.php) — CLI provisioning and validation tests.
