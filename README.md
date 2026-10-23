# Peer Tutoring Management System

Bachelor thesis project: **Design and Development of a Peer Tutoring Management System for Higher Education Institutions.**

## Phase 1: backend foundation

The backend is Laravel 13 with PostgreSQL. The React frontend is a separate Vite application and is not part of this phase. Authentication is intended to use Sanctum's first-party, session-cookie SPA flow; do not store bearer tokens in browser localStorage.

### Local setup

1. Use PHP 8.3 or newer and verify that `pdo_pgsql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `curl`, `fileinfo`, `filter`, `hash`, `intl`, `json`, `pcre`, `session`, and `sodium` are enabled. `pdo_sqlite` is needed only for the isolated test suite described below.
2. Install the locked PHP dependencies with `composer install`.
3. Copy `.env.example` to `.env` if a local environment file does not already exist, generate a local application key with `php artisan key:generate`, then configure PostgreSQL locally. Never commit `.env`.
4. Create a PostgreSQL database for this application and set `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in the ignored local `.env`.
5. Set `CORS_ALLOWED_ORIGINS` to the exact React origin. The default development origin is `http://localhost:5173`; use the matching backend origin `http://localhost:8000` in the React API client. Keep the host names consistent (`localhost` with `localhost`, or `127.0.0.1` with `127.0.0.1`) for cookie authentication.
6. Configure `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` only in local `.env` when ready to provision an admin. Use a unique password of at least 16 characters. The seeder refuses to promote an existing non-admin account.
7. Review the migration list first. The development database has not been migrated automatically. Run `php artisan migrate` only after confirming the target database and the listed changes.
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
| GET | `/api/subjects` | Authenticated | Lists active subjects for applications |
| POST | `/api/tutor-applications` | Authenticated student | Submits an application and subject IDs |
| GET | `/api/tutor-applications` | Authenticated student | Lists only the current user's application history |
| GET | `/api/admin/tutor-applications` | Authenticated admin | Lists pending applications |
| POST | `/api/admin/tutor-applications/{id}/approve` | Authenticated admin, not applicant | Approves once and adds tutor role while retaining student |
| POST | `/api/admin/tutor-applications/{id}/reject` | Authenticated admin, not applicant | Rejects once; requires a reason |

Application submission returns `201`; reads and reviews return `200`; logout returns `204`; validation errors return `422`; unauthenticated and unauthorized requests return `401` and `403`. A partial unique database index enforces one pending application per user while retaining rejected history. Reviews and role assignment run in one transaction.

## Database foundation

- `roles` and `role_user`: a user can keep multiple roles (`student`, `tutor`, `admin`).
- `subjects`: unique active/inactive subject names.
- `tutor_applications`: applicant, motivation, status, reviewer, review time, rejection reason, and timestamps.
- `subject_tutor_application`: normalized proposed subjects for each application.

The role seeder is idempotent. Standard role creation is part of the ordinary `DatabaseSeeder`; initial-admin provisioning is intentionally separate.

## Tests

PHPUnit is configured to force `APP_ENV=testing`, SQLite `:memory:`, and a blank database URL, so the suite cannot inherit the local PostgreSQL settings. The current Laragon runtime may need its SQLite PDO extension enabled for a single command. If `php_pdo_sqlite.dll` is present, invoke PHPUnit using the PHP 8.3 executable with a one-process extension override, for example:

```powershell
& 'C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe' -d extension=php_pdo_sqlite.dll vendor\phpunit\phpunit\phpunit --testdox
```

The command does not change the PHP configuration. Confirm the reported database driver is SQLite before running the suite. Never point tests at the development PostgreSQL database.

## Current scope limits

This phase does not implement bookings, availability, sessions, reviews, chat, notifications, or analytics. Real-time chat and additional application features will be added in later phases.
