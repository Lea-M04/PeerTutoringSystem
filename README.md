# Peer Tutoring Management System

Bachelor thesis project: **Design and Development of a Peer Tutoring Management System for Higher Education Institutions.**

## Current implementation snapshot (2026-10-24)

The Laravel backend implements registration/login, role membership, subjects used for tutor applications, tutor application/review, and user/tutor profile APIs. The separate React + Vite frontend provides a landing page, registration, login, dashboard, and user/tutor profile forms. Tutor search, availability, bookings, session completion, reviews, chat, notifications, and administration statistics remain planned. The project owner reports that browser registration, session persistence, logout, and dashboard protection were manually verified; profile browser flows have not yet been checked. The latest Laravel suite run completed 26 tests and 99 assertions against isolated SQLite `:memory:`. Phase 5 profile migrations are new and have not been applied to PostgreSQL.

## Phase 1: backend foundation

The backend is Laravel 13 with PostgreSQL. The React frontend is a separate Vite application; this section documents the backend foundation. Authentication uses Sanctum's intended first-party, session-cookie SPA flow; do not store bearer tokens in browser localStorage.

### Local setup

1. Use PHP 8.3 or newer and verify that `pdo_pgsql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `curl`, `fileinfo`, `filter`, `hash`, `intl`, `json`, `pcre`, `session`, and `sodium` are enabled. `pdo_sqlite` is needed only for the isolated test suite described below.
2. Install the locked PHP dependencies with `composer install`.
3. Copy `.env.example` to `.env` if a local environment file does not already exist, generate a local application key with `php artisan key:generate`, then configure PostgreSQL locally. Never commit `.env`.
4. Create a PostgreSQL database for this application and set `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in the ignored local `.env`.
5. Set `CORS_ALLOWED_ORIGINS` to the exact React origin. The default development origin is `http://localhost:5173`; use the matching backend origin `http://localhost:8000` in the React API client. Keep the host names consistent (`localhost` with `localhost`, or `127.0.0.1` with `127.0.0.1`) for cookie authentication.
6. Configure `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` only in local `.env` when ready to provision an admin. Use a unique password of at least 16 characters. The seeder refuses to promote an existing non-admin account.
7. Review the migration list first. The project owner reports that the existing migrations are already applied. Phase 5 added two profile migrations, which have not been run against PostgreSQL. Check the database target and migration status before applying them; see the Phase 5 migration instructions below.
8. Seed standard roles with `php artisan db:seed --class=Database\Seeders\RoleSeeder`. When ready, provision the first administrator separately with `php artisan db:seed --class=Database\Seeders\InitialAdminSeeder --no-interaction`.

Do not run `migrate:fresh` or `db:wipe` against a database containing data.

### SPA authentication

For the local React app at `http://localhost:5173` and API at `http://localhost:8000`, first request `GET /sanctum/csrf-cookie` with credentials enabled. Then use `POST /login`, `POST /register`, and `POST /logout` with credentials enabled and the returned CSRF cookie/header. The server is configured for explicit origins and credentials; it does not use wildcard credentialed CORS. Production origins must be deliberately configured in the environment and Sanctum stateful domain list.

## Phase 1 API endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | Public, rate limited | Creates an account with the student role only |
| POST | `/login` | Public, rate limited | Starts a session-cookie login |
| POST | `/logout` | Authenticated | Ends the session |
| GET | `/api/user` | Authenticated | Returns the current user and roles |
| PATCH | `/api/user` | Authenticated | Updates the signed-in user's first/last name, faculty/university, study program, and biography; email and roles cannot be changed here |
| GET | `/api/tutor-profile` | Authenticated Tutor | Returns the signed-in tutor's tutor-specific biography |
| PATCH | `/api/tutor-profile` | Authenticated Tutor | Creates or updates the signed-in tutor's biography; identity comes from the session |
| GET | `/api/subjects` | Authenticated | Lists active subjects for applications |
| POST | `/api/tutor-applications` | Authenticated student | Submits an application and subject IDs |
| GET | `/api/tutor-applications` | Authenticated student | Lists only the current user's application history |
| GET | `/api/admin/tutor-applications` | Authenticated admin | Lists pending applications |
| POST | `/api/admin/tutor-applications/{id}/approve` | Authenticated admin, not applicant | Approves once and adds tutor role while retaining student |
| POST | `/api/admin/tutor-applications/{id}/reject` | Authenticated admin, not applicant | Rejects once; requires a reason |

Application submission returns `201`; reads and reviews return `200`; logout returns `204`; validation errors return `422`; unauthenticated and unauthorized requests return `401` and `403`. A partial unique database index enforces one pending application per user while retaining rejected history. Reviews and role assignment run in one transaction.

Profile reads use `200`; updating the current user profile returns `200`, while the first tutor-profile write may return `201` when it creates the one-to-one row. Requests cannot specify another user ID or change email/roles. Tutor-profile operations require the Tutor role, which the application workflow grants only after Admin approval while retaining Student.

## Database foundation

- `roles` and `role_user`: a user can keep multiple roles (`student`, `tutor`, `admin`).
- `subjects`: unique active/inactive subject names.
- `tutor_applications`: applicant, motivation, status, reviewer, review time, rejection reason, and timestamps.
- `subject_tutor_application`: normalized proposed subjects for each application.

The role seeder is idempotent. Standard role creation is part of the ordinary `DatabaseSeeder`; initial-admin provisioning is intentionally separate.

The Phase 5 migrations add nullable profile fields to `users` and create `tutor_profiles` with one unique foreign key to `users`. The approval action creates the tutor profile in the same transaction as the role grant. The profile fields and relationship were exercised by the SQLite in-memory feature suite; these new migrations have not been run against PostgreSQL.

Before applying them, confirm that the local Laravel configuration targets the intended `peer_tutoring` database and inspect the two migration files. Then review pending status and SQL preview using the project's explicit PHP 8.3 executable:

```powershell
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' artisan migrate:status
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' artisan migrate --pretend
```

After reviewing those results and approving the target, apply pending migrations with:

```powershell
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' artisan migrate
```

No migration command was run as part of this phase.

## Tests

PHPUnit is configured to force `APP_ENV=testing`, SQLite `:memory:`, and a blank database URL, so the suite cannot inherit the local PostgreSQL settings. The current Laragon runtime may need its SQLite PDO extension enabled for a single command. If `php_pdo_sqlite.dll` is present, invoke PHPUnit using the PHP 8.3 executable with a one-process extension override, for example:

```powershell
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' -d extension=php_sqlite3.dll -d extension=php_pdo_sqlite.dll vendor\phpunit\phpunit\phpunit --testdox
```

The command does not change the PHP configuration. Confirm the reported database driver is SQLite before running the suite. Never point tests at the development PostgreSQL database.

The suite was verified during Phase 5 on 2026-10-24: **26 tests passed, 99 assertions**.

## Current scope limits

This phase does not implement bookings, availability, sessions, reviews, chat, notifications, or analytics. Real-time chat and additional application features will be added in later phases.

## Separate React frontend (Phase 3)

The presentation tier lives in `frontend/` and runs separately from Laravel. The request path is **React + Vite → Laravel REST API → PostgreSQL**; the browser never connects to PostgreSQL. This frontend foundation includes a landing page, registration, login, a protected dashboard placeholder, and a centralized API client. It does not implement tutoring workflows yet.

### Run locally

Use two terminals from the repository root. Keep the backend and frontend host names consistent (`localhost` for both) so browser cookies work as expected.

**Terminal 1 — Laravel API:**

```powershell
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' artisan serve --host=localhost --port=8000
```

The backend is available at `http://localhost:8000`.

**Terminal 2 — React + Vite:**

```powershell
Set-Location frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install
npm run dev -- --host=localhost --port=5173
```

The frontend is available at `http://localhost:5173`. `frontend/.env.example` sets `VITE_API_BASE_URL=http://localhost:8000`; `.env.local` is ignored. If `.env.local` already exists, keep it and check only that its API URL points to the local Laravel origin. Do not put passwords, tokens, or database credentials in `VITE_*` variables because frontend values are public in the built application.

The backend's local CORS allow-list must include the exact frontend origin (`http://localhost:5173`) and Sanctum must treat the matching host as stateful. The repository already has these development defaults. If you change hosts or ports, update local Laravel configuration deliberately; do not use wildcard credentialed CORS. The browser API client requests `/sanctum/csrf-cookie` before state-changing requests and uses credentialed cookies. Browser authentication has not been verified end-to-end as part of this frontend scaffold.

### Frontend checks

```powershell
Set-Location frontend
npm run build
```

No frontend lint script is configured yet. The Laravel PHPUnit suite remains isolated to SQLite `:memory:` according to `phpunit.xml`; use the PHP 8.3 command in the Tests section above. Do not run Laravel migrations automatically as part of frontend setup.
