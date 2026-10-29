# Architecture

## Verified stack
- PHP 8 (locally checked with PHP CLI 8.3.30), `mysqli`, MySQL/InnoDB.
- Server-rendered PHP pages with browser-native JavaScript, HTML dialogs, SVG, and CSS; no framework or package manifest was found.
- Local project is laid out for Laragon/Windows (`C:\laragon\www\wbm\uts`); production/deployment setup is not documented.

## Application structure
- `index.php` is the public portfolio entry point. It reads slide, profile, and project records and renders the visitor page.
- `admin.php` is the authenticated admin router and form-action handler for projects, highlights, profile, account settings, and media. It loads dashboard page modules and scripts.
- `auth.php` starts the session, loads the database connection, ensures the admin table exists, provisions a default account if none exists, and enforces the primary-account login rule.
- `koneksi.php` creates the MySQL connection and ensures base content tables (`projects`, `slides`, `fileBrowser`, `profile`) exist, with compatibility alterations.
- `dashboard/interactive.php` renders the interactive-video editor; `interactive.js`/`interactive.css` implement its client; `interactive-api.php` and `interactive-store.php` implement its JSON persistence, validation, and media safeguards.
- `dashboard/dashboard.js` and stylesheets support shared admin navigation, dialogs, responsive layout, and media controls.
- `assets/` contains local image/video files; `fileBrowser` stores their relative paths and display names.

## Data and trust boundaries
MySQL is authoritative for account and CMS records. The interactive graph is JSON in one `interactive_video` row with an integer revision. Media paths are resolved under `assets/`; only existing video files under that root are eligible for interactive scenes. The API gates writes on the primary logged-in account, POST, 1 MB request limit, session token, revision, graph schema, and current media IDs.

The public page and admin share the same MySQL content database. Uploads write media to disk and then create a `fileBrowser` record. Database connection defaults are in `koneksi.php`; no environment-variable configuration is evidenced.

Operational and test details: [[docs/technical/TESTING-AND-SETUP]].
