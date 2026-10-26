# Peer Tutoring Management System — Project Specification

**Thesis title:** Design and Development of a Peer Tutoring Management System for Higher Education Institutions  
**Project name:** Peer Tutoring Management System (PTMS)  
**Document role:** Source of truth for agreed requirements and current implementation status  
**Status:** Initial specification; unresolved decisions are identified explicitly  

This document separates requirements from evidence in the repository. A requirement below is not evidence that the corresponding feature has been implemented. The current application state is summarized in Section 15.

## 1. Project overview and objectives

The PTMS is a web application intended to help a higher education institution coordinate peer tutoring. Students should be able to find tutoring support and manage tutoring sessions. Eligible students may apply to become tutors. Administrators review those applications and oversee the system. Students and tutors should be able to communicate privately, and completed tutoring sessions should support feedback.

The project objectives are to:

- provide a clear, role-aware process for student and tutor participation;
- support tutor applications, subject selection, availability, and session booking;
- preserve application and session history;
- provide a secure API and a separate browser-based user interface;
- demonstrate an understandable, testable, incremental software engineering process suitable for a bachelor thesis.

## 2. Problem statement and motivation

Peer tutoring programs need a practical way to connect students seeking help with student tutors who can offer support. When tutor applications, subject interests, schedules, bookings, cancellations, and communication are managed through disconnected or manual processes, it can be difficult to track decisions, prevent scheduling conflicts, preserve history, and give participants a consistent experience.

The PTMS is intended to centralize those workflows. The repository does not contain institution-specific research findings or measured evidence about an existing institution's process. Such evidence should be added from the thesis research rather than inferred from this software specification.

## 3. Scope and limitations

### In scope

- Account registration and session-based login.
- Student and tutor participation, including a person holding both roles.
- Tutor applications with administrative approval or rejection and preserved reapplication history.
- Tutor subject selection, profile information, and availability.
- Bookings, booking decisions, cancellation, and completion tracking.
- Reviews for completed sessions.
- Persistent private student–tutor text chat, with WebSockets intended for real-time delivery.
- In-app notifications; email notifications are optional.
- Administrative management and basic statistics.
- Server-side validation, authorization, persistence, testing, and documentation.

### Limits and decisions still to be made

- The initial release is a web application. A native mobile application is not specified.
- No video/voice calling, payment processing, or public/group chat requirement has been established. They are outside the current defined scope unless approved later.
- No institution-specific identity provider, student information system, or email service is selected.
- Exact student/tutor profile fields, tutor discovery filters, administrative powers, statistics, notification events, and retention rules remain to be specified.
- Booking state names and transition details, slot overlap rules, time zone handling, and the exact interpretation of the 12-hour cancellation rule require confirmation during detailed design. The rule itself is agreed: a student must cancel at least 12 hours before the scheduled session.
- Any Student may initiate a persistent conversation with an approved Tutor without a booking. There is one conversation per student–tutor pair. Booking cancellation does not remove chat history or by itself revoke chat access.
- The WebSocket/broadcasting package and production hosting arrangement remain to be selected and configured.

## 4. System actors and permissions

All permissions must be enforced by the Laravel backend. Hiding a button in React is not authorization.

| Actor | Intended permissions |
| --- | --- |
| **Guest** | Register as a student and log in. A guest cannot submit or review tutor applications, book a session, or access private user data. Whether guests may browse public tutor profiles is unresolved. |
| **Student** | Manage their own student profile; apply to become a tutor; select proposed subjects; view their own application history; browse tutors and availability when implemented; request bookings; cancel their bookings only within the agreed deadline; use eligible private chat; review their own completed sessions. A student cannot review applications or assign roles. |
| **Tutor** | A tutor is an approved student and retains the Student role. In addition to student capabilities, a tutor may manage the tutor profile, subjects, and availability; accept/reject bookings; cancel with a reason; control completion of sessions; use eligible private chat; and receive reviews. Exact tutor editing and booking transition permissions need detailed rules. |
| **Administrator** | Review pending tutor applications, approving or rejecting them with a reason for rejection. Approval adds the Tutor role without removing Student. Administrative account, subject, user, and reporting permissions beyond this application workflow and basic statistics remain to be defined. An administrator must not impersonate users or bypass audit history without an explicitly approved requirement. |

Role membership is many-to-many. Registration must never let a public user select `tutor` or `admin`.

## 5. Functional requirements

The requirements below are intended system behavior. **Current** status is assessed separately in Section 15.

| ID | Requirement |
| --- | --- |
| **FR-01** | The system shall allow a guest to register an account and shall assign the Student role through a trusted server-side process. |
| **FR-02** | The system shall authenticate users and provide login and logout. The browser client shall use the agreed first-party session-cookie flow. |
| **FR-03** | The system shall allow a user to be both a Student and a Tutor. Tutor approval shall add the Tutor role and preserve the Student role. |
| **FR-04** | The system shall provide a self-managed user profile with first name, last name, faculty or university, study program, and a short biography. The account email remains read-only in this phase. |
| **FR-05** | A Student shall submit a tutor application containing motivation and one or more proposed active subjects. The user identity shall come from the authenticated session, not from client input. |
| **FR-06** | The system shall allow at most one pending tutor application per user. It shall preserve rejected applications and allow a new application after rejection. |
| **FR-07** | An authorized Administrator shall list and review pending applications. Approval shall grant Tutor role membership. Rejection shall require a non-empty reason. A user shall not review their own application, and reviewed applications shall not be reviewed again. |
| **FR-08** | The system shall provide a tutor-only profile with a short tutoring biography for users granted the Tutor role through approval. Tutor subject offerings remain a separate future feature from subjects recorded on tutor applications. |
| **FR-09** | Tutors shall define availability and students shall be able to view it. Availability shall use fixed slot durations of 30, 60, or 90 minutes. Recurrence, time zones, lead times, and conflict rules remain unresolved. |
| **FR-10** | Students shall request tutoring session bookings. Tutors shall be able to confirm or reject a pending request. The system shall prevent conflicting bookings according to rules to be finalized. |
| **FR-11** | A Student shall be able to cancel their booking only at least 12 hours before the scheduled start. A Tutor shall be able to cancel a booking and provide a reason. Exact status names and behavior at the 12-hour boundary require detailed acceptance criteria. |
| **FR-12** | The system shall track tutoring sessions and allow the Tutor to mark a session completed. Students shall not mark sessions complete on behalf of tutors. Exception handling for disputes or missed sessions remains unresolved. |
| **FR-13** | After a completed session, a Student shall be able to submit a review with a rating from 1 to 5. Review text, editability, and duplicate-review handling remain unresolved. |
| **FR-14** | A Student may initiate one persistent private conversation with an approved Tutor without a booking. Participants may exchange persisted text and JPEG, PNG, or WebP image messages with optional captions. Each image is limited to 5 MiB and retrieved through an authorized private endpoint. Received messages support read receipts. Booking status alone does not grant or revoke access. Group chat and message editing/deletion are excluded; retention rules remain open. |
| **FR-15** | The system shall provide in-app notifications for relevant actions. Email notifications may be added as an optional delivery channel. Exact notification events, preferences, and email provider are unresolved. |
| **FR-16** | The system shall provide administrative management and basic dashboard statistics. The managed entities, metrics, and reporting permissions require approval. |
| **FR-17** | The system shall expose the frontend's required operations through the Laravel REST API, with consistent validation errors and server-side authorization. |
| **FR-18** | The system shall preserve relevant workflow history, including rejected tutor applications and booking/session decisions, subject to a retention policy to be decided. |
| **FR-19** | The system shall allow students to browse subjects and search/browse approved tutors and their subject offerings. Search filters, guest visibility, and ranking remain unresolved. |

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| **NFR-01** | The system shall follow the Three-Tier Client–Server Architecture in Section 8. The React client shall never connect directly to PostgreSQL. |
| **NFR-02** | Authentication, role checks, business rules, validation, and database operations shall be enforced by the Laravel backend. |
| **NFR-03** | Passwords shall be stored using Laravel's supported password hashing. Passwords, hashes, session secrets, and environment credentials shall not be returned in API responses or committed. |
| **NFR-04** | Cookie-based SPA authentication shall retain CSRF protection and use explicit credentialed CORS origins. Wildcard credentialed CORS and browser localStorage token storage are prohibited. |
| **NFR-05** | Sensitive and role-specific data shall be returned only to authorized actors. Input shall be validated and mass assignment constrained. |
| **NFR-06** | Multi-record operations whose partial completion could corrupt workflow state (including application review and role grant) shall be transactional. Database constraints shall protect important uniqueness and referential-integrity rules. |
| **NFR-07** | The application shall be maintainable and understandable for a bachelor thesis: use Laravel conventions, clear naming, focused responsibilities, and avoid unnecessary abstractions. |
| **NFR-08** | Each increment shall have automated tests for its important behavior, authorization boundaries, validation, and failure cases. Tests shall use an isolated database and must not damage development data. |
| **NFR-09** | The application shall preserve required business history rather than overwriting prior rejected applications or decisions. |
| **NFR-10** | The API, environment setup, and operational requirements shall be documented sufficiently for another developer to run the project without access to committed secrets. |
| **NFR-11** | Performance, availability, accessibility, supported browsers, backup, and data-retention targets have not been quantified; define measurable targets before production evaluation. |

## 7. Main use cases

### UC-01 — Register and start a student session

- **Primary actor:** Guest.
- **Preconditions:** Registration endpoint is available; the email is not already registered.
- **Main flow:** Guest submits valid name, email, and password; Laravel validates the request; the account and Student role relationship are created; Laravel starts a session and returns a safe user representation.
- **Alternative flows:** Invalid or duplicate input returns validation errors; a request to choose a role is rejected; a server failure does not leave a partially created account/role relationship.
- **Postconditions:** An authenticated account with Student role exists; no client-selected privileged role is assigned.

### UC-02 — Apply to become a tutor

- **Primary actor:** Student.
- **Preconditions:** The user is authenticated, has Student role, and at least one active subject exists.
- **Main flow:** Student supplies motivation and subject IDs; Laravel validates active subjects, checks for an existing pending application, creates a new pending application, and links the selected subjects.
- **Alternative flows:** Unauthenticated/non-student users are denied; invalid or inactive subjects are rejected; a second pending application is rejected; a prior rejected application remains in history and does not prevent reapplication.
- **Postconditions:** A pending application and its subject links exist, or no partial application is persisted.

### UC-03 — Review a tutor application

- **Primary actor:** Administrator.
- **Preconditions:** Administrator is authenticated and authorized; application is pending; reviewer is not the applicant.
- **Main flow:** Administrator lists pending applications and chooses approve or reject. Approval records reviewer/time and adds Tutor role without removing Student. Rejection records reviewer/time and a non-empty reason. Review and role assignment commit together.
- **Alternative flows:** Non-admin or applicant is denied; missing rejection reason is rejected; a repeated review is rejected; a failed role assignment rolls back the approval.
- **Postconditions:** Application has one terminal review outcome and its prior history is retained.

### UC-04 — Create and manage a tutoring booking (planned)

- **Primary actors:** Student and Tutor.
- **Preconditions:** Student and approved Tutor are authenticated; Tutor has suitable availability; the selected slot is eligible and unbooked.
- **Main flow:** Student requests a slot; Tutor confirms or rejects the request; the system records the decision and prevents overlapping bookings.
- **Alternative flows:** Slot is no longer available; a party cancels according to its role-specific rule; student cancellation is accepted only at least 12 hours before start; tutor cancellation records a reason.
- **Postconditions:** Booking history reflects the request, decision, or cancellation. Exact status labels and conflict policy remain to be decided.

### UC-05 — Complete a session and leave a review (planned)

- **Primary actors:** Tutor and Student.
- **Preconditions:** A booking reached the institution-approved state for a session to take place.
- **Main flow:** Tutor marks the session completed; Student submits a rating from 1 to 5.
- **Alternative flows:** Unauthorized user attempts completion/review; session is not eligible; rating is outside the range; review duplicate or dispute behavior is handled under rules still to be defined.
- **Postconditions:** Completion and eligible feedback are preserved.

### UC-06 — Exchange private messages (foundation implemented; real-time delivery planned)

- **Primary actors:** Eligible Student and Tutor.
- **Preconditions:** Both users are authenticated and authorized for the private conversation.
- **Main flow:** Any authenticated Student starts or reopens the single conversation with an approved Tutor. Either participant sends text or a supported private image through the authenticated Laravel API. Persisted history is available after refresh; unread messages can be marked read.
- **Alternative flows:** Nonparticipants and administrators are denied; invalid images or failed requests show an error. Booking cancellation, rejection, or completion does not remove conversation history or revoke access by itself.
- **Postconditions:** The two participants can retrieve persistent history and authorized image attachments. WebSocket delivery, typing indicators, and presence remain future work.

## 8. System architecture

The mandatory architecture is a **Three-Tier Architecture based on the Client–Server model**:

```text
Presentation Tier                 Application / Business Logic Tier      Data Tier
React.js + Vite  --HTTP/REST-->   Laravel REST API  ------------------>   PostgreSQL
        <---------------- JSON    validation, authorization, rules, ORM     persistence
```

- **Presentation tier:** Separate React.js application built and served with Vite. It renders screens, collects input, calls API endpoints, and displays results. It contains no direct PostgreSQL connection or authoritative business rules.
- **Application/business tier:** The existing Laravel application exposes REST endpoints. It authenticates requests, validates input, enforces permissions and workflow rules, and accesses persisted data using Laravel's database layer.
- **Data tier:** PostgreSQL stores account, role, application, subject, booking, chat, review, and notification data as those phases are implemented.
- **Communication:** Normal browser operations follow React → HTTP/REST → Laravel → PostgreSQL and return through Laravel as JSON/HTTP responses. For chat, a later WebSocket/broadcast transport may connect the React client to Laravel-managed channels; channel authorization, persistence, and business decisions remain in Laravel. A WebSocket connection must not bypass the application tier or expose database access.

The repository contains both the Laravel root application and a separate React + Vite application in `frontend/`. Laravel's original Blade and Vite scaffold remains at the repository root; it has not been removed or repurposed. The React client calls the Laravel REST API and has no direct PostgreSQL access. The backend's `/` route still serves Laravel's welcome Blade view, while Vite serves the React application on its own development origin.

## 9. Technology stack

| Concern | Selected technology | Current repository evidence / status |
| --- | --- | --- |
| Backend/API | Laravel 13 | `composer.lock` resolves Laravel Framework 13.38.0; controllers/routes exist for the initial backend slice. |
| PHP | PHP 8.3 or newer | `composer.json` requires `^8.3`; project environment previously verified PHP 8.3.36. |
| Frontend | React.js with Vite | Separate JavaScript application exists in `frontend/`; installed versions verified by `npm ls` are React/React DOM 19.3.1, React Router 7.18.4, and Vite 8.3.5. The root Laravel Vite/Tailwind setup remains separate and intact. |
| Database | PostgreSQL | Required target and PostgreSQL migration support is present. The current `.env.example` defaults to `pgsql`; the real ignored `.env` was intentionally not inspected. |
| SPA authentication | Laravel Sanctum cookie-based SPA authentication | `laravel/sanctum` 4.3.3 is in Composer dependencies; Laravel stateful API middleware, CSRF route integration, and CORS configuration exist. |
| Real-time messaging | WebSockets via a Laravel-compatible broadcaster | Required for intended chat; package, deployment topology, and configuration are not selected or implemented. |
| Tests | PHPUnit | PHPUnit 12.5 is locked; project tests force an isolated SQLite in-memory connection. |

Version numbers are evidence of the checked repository lock/configuration, not a promise that these versions will remain current. Pin/verify versions when starting a new implementation increment.

## 10. High-level database model and relationships

### Implemented schema files

- **users** — Laravel account identity, email, password hash, timestamps, and standard session/password-reset scaffolding.
- **roles** — unique role names. The seeder creates `student`, `tutor`, and `admin` idempotently.
- **role_user** — many-to-many user/role pivot with composite key and foreign keys.
- **subjects** — unique subject name and active flag.
- **tutor_applications** — applicant, motivation, status, reviewer, review time, rejection reason, timestamps. A partial unique index limits each user to one pending application.
- **subject_tutor_application** — many-to-many proposed subject links for an application.
- **User profile fields** — the Phase 5 migration adds nullable first name, last name, faculty/university, study program, and biography columns to the existing `users` table; the existing `name` field is retained for compatibility.
- **tutor_profiles** — the Phase 5 migration creates an optional one-to-one tutor biography row with a unique, foreign-keyed `user_id`. The approval action creates it transactionally when it grants the Tutor role. Existing approved tutors can receive an empty profile on first update.

The Phase 5 migrations are present in source but have **not been applied to the PostgreSQL database during this phase**. The project owner reported that the prior migrations had been applied successfully before this phase; that database state was not independently queried here.

### Intended relationships

```text
User *---* Role
User 1---* TutorApplication (applicant)
User 1---* TutorApplication (reviewer, optional)
TutorApplication *---* Subject
User 1---0..1 TutorProfile
```

### Proposed future entities (not implemented)

These are design recommendations only; no corresponding migrations or models exist yet. Reuse `users` and `subjects` rather than introducing duplicate identity or subject tables.

- **Tutor profile:** one-to-one with `users` (unique `user_id`); exists only for approved tutors. The basic student/user profile fields are implemented on `users`; add a separate student profile entity only if later requirements justify it.
- **Tutor subject offerings:** many-to-many between the tutor profile/user and existing `subjects`, separate from `subject_tutor_application`. Application subjects are historical evidence of what was proposed; approved offerings describe the tutor's current catalogue.
- **Availability slots:** belong to a tutor; store concrete start/end times and enforce the agreed 30/60/90-minute duration rule. Recurrence, time zone, lead time, and whether slots are reusable or consumed by a booking must be decided before schema design.
- **Bookings:** belong to one student, one tutor, one subject, and the selected availability/time. Store the booking state and actor-specific decision/cancellation data needed to preserve request, acceptance/rejection, and cancellation history. Add database-backed protections against overlapping confirmed bookings; the exact strategy depends on whether availability is represented as fixed slot rows or arbitrary intervals.
- **Tutoring sessions:** recommended as a one-to-one record created from an accepted booking if session execution/completion metadata differs from booking decisions. Alternatively a single booking lifecycle record may suffice; decide before implementation to avoid duplicating status or schedule data.
- **Reviews:** belong to a completed session and its student reviewer/tutor recipient. Use a rating constraint of 1–5 and a unique session/reviewer constraint if one review per student per session is approved. The backend must enforce completion eligibility and prevent reviews of another user's session.
- **Conversations and messages (implemented source; migrations pending):** one conversation belongs to a Student and an approved Tutor profile, with a unique student/tutor pair and no booking foreign key. Messages belong to the conversation and authenticated sender, use a per-sender idempotency UUID, and have a nullable `read_at` suitable for one-to-one receipts. Image metadata is stored separately from image bytes, which use private storage. Booking status does not control access.
- **Notifications:** Laravel's notification persistence can associate each item with its recipient user and store type/data/read timestamp. Define events, retention and whether email is enabled before adding delivery behavior. Admin statistics should be derived from domain records unless a demonstrated performance need justifies stored aggregates.

Proposed relationship sketch:

```text
User 1---0..1 TutorProfile; TutorProfile *---* Subject
TutorProfile 1---* AvailabilitySlot
Student(User) 1---* Booking *---1 Tutor(User); Booking *---1 Subject
Booking 1---0..1 TutoringSession; TutoringSession 1---0..1 Review
Conversation 1---* Message; Message *---1 User(sender)
User 1---* Notification
```

These relationships do not settle booking/session status names, slot recurrence, interval conflict handling, review text/visibility, message retention, or notification lifecycle.

## 11. API and authentication approach

### Existing initial endpoints

| Method and path | Current purpose and access |
| --- | --- |
| `POST /register` | Public, rate-limited registration; always attaches Student role. |
| `POST /login` | Public, rate-limited session login. |
| `POST /logout` | Authenticated session logout. |
| `GET /api/user` | Authenticated current-user data and roles. |
| `PATCH /api/user` | Authenticated user updates their own profile fields; account email and roles are prohibited. |
| `GET /api/tutor-profile` | Authenticated Tutor reads their own tutor biography. |
| `PATCH /api/tutor-profile` | Authenticated Tutor creates or updates their own tutor biography. |
| `GET /api/subjects` | Authenticated list of active subjects. |
| `POST /api/tutor-applications` | Authenticated Student submits motivation and active subject IDs. |
| `GET /api/tutor-applications` | Authenticated Student gets their own application history. |
| `GET /api/admin/tutor-applications` | Admin lists pending applications. |
| `POST /api/admin/tutor-applications/{id}/approve` | Admin approves one pending application, except their own. |
| `POST /api/admin/tutor-applications/{id}/reject` | Admin rejects one pending application with a required reason, except their own. |

These paths are present in `routes/web.php` and `routes/api.php`; tests exercise the main application workflows. They are not a complete or versioned API contract. API versioning, pagination, filtering, and a formal OpenAPI document have not been decided.

### Authentication

The current approach is Sanctum's first-party SPA cookie/session model, not personal access tokens stored in the browser. Laravel's `statefulApi()` middleware is enabled. The frontend should first obtain the CSRF cookie at `/sanctum/csrf-cookie`, then make credentialed requests to the backend and send the CSRF token as required by the browser/Laravel client integration. CORS has an explicit `CORS_ALLOWED_ORIGINS` setting and credential support; the default is `http://localhost:5173`. Sanctum's default stateful list includes local `localhost`/`127.0.0.1` React and backend ports. Production origins and cookie settings must be deliberately configured.

The existing PHPUnit tests authenticate primarily with Laravel's `actingAs`; they do not by themselves prove the browser's end-to-end CSRF, CORS, and cookie behavior. The React API client requests the CSRF cookie, sends credentialed requests, and uses the configured API routes, but browser authentication has not been verified end-to-end.

## 12. Security and authorization rules

1. The Laravel API is the authority for identity, role membership, validation, and permissions.
2. Registration assigns Student only; role fields are prohibited. Tutor role is granted only after approved application review; admin provisioning is a separate local seeder.
3. API identity and reviewer identity are derived from the authenticated session. Never trust client-supplied applicant/reviewer IDs.
4. Students may submit only their own application and read only their own application history. Admin listing and review are server-authorized.
5. A review is allowed only for a pending application and cannot be made by its applicant. Approval, review metadata, and tutor-role grant are transactional.
6. Rejection requires a reason. Active subjects, motivation, and subject IDs are validated. The pending-application database index handles concurrent duplicate submissions.
7. Eloquent fillable/hidden attributes and explicit API resources limit mass assignment and sensitive response fields. Password and remember-token fields are hidden; password hashing uses Laravel's hashed cast and hash service.
8. Login and registration routes have named rate limits. Sanctum stateful authentication, CSRF, and explicit-origin credentialed CORS must remain enabled; do not use wildcard credentialed CORS.
9. WebSocket channels (when added) must authorize each participant and must not allow clients to subscribe by guessing another user's conversation ID.
10. Never commit `.env`, credentials, app keys, database passwords, session secrets, or production secrets. The root `.gitignore` ignores `.env` and `/laravel-temp/`.

**Implementation limitations to close in a later security increment:** the schema does not currently have check constraints tying terminal status to reviewer/review timestamp or requiring rejection reason for every rejected row; these invariants are presently enforced by the API path rather than all possible database writers. Cookie/CSRF/CORS browser behavior has not been demonstrated with a React client. Define account verification, password reset, lockout policy, audit access, data retention, and production cookie policy before deployment.

## 13. Development methodology

Use **Agile with incremental development**. Work in small, reviewable increments. Each increment must state its user-visible behavior, implementation tasks, automated tests, and acceptance criteria before it is considered complete. Maintain this specification as the agreed baseline; change it when the product owner approves a requirement change.

This does not assert Scrum. No Scrum roles, ceremonies, artifacts, or sprint cadence have been adopted in the inspected project plan.

Recommended iteration cycle:

1. Select and refine a small requirement and acceptance criteria.
2. Implement the smallest end-to-end change across API, database, and UI as applicable.
3. Add/adjust isolated automated tests and run relevant checks.
4. Review security, data integrity, accessibility/usability, and documentation impacts.
5. Demonstrate the increment, record remaining issues, then begin the next increment.

## 14. Incremental implementation roadmap

| Phase | Intended functionality and work | Exit criteria |
| --- | --- | --- |
| **0 — Requirements and environment baseline** | Confirm detailed rules, local PHP/dependency configuration, PostgreSQL target, Git safety, and React/API origins. | Approved requirements and safe repeatable developer setup. |
| **1 — Backend foundation and tutor applications** | Roles, subjects, student registration/session authentication, tutor application submission/history, admin review, role grant, API resources, initial tests. | Current initial slice meets its tested acceptance criteria; migrations are reviewed before any non-test database is migrated. |
| **2 — Separate React/Vite client and authenticated shell** | **Foundation implemented:** separate frontend, landing/register/login, protected dashboard placeholder, API client, CSRF-cookie/session request handling. | Remaining: browser integration confirms cookie, CSRF, CORS, 401/403, and logout behavior without localStorage tokens. |
| **3 — Profiles, subjects and tutor catalogue** | **User and tutor profile foundations implemented:** profile fields/endpoints, tutor-only profile endpoint, React profile forms. Continue with subject browsing, tutor subject offerings and search after the new PostgreSQL migrations are reviewed and applied. | Profile behavior passes isolated tests; approved tutors manage only their own tutor profile. Discovery scope and profile API behavior are verified. |
| **4 — Availability and booking** | Model 30/60/90-minute slots; define time zone, recurrence and conflict rules; request/confirm/reject/cancel flows and 12-hour student cancellation boundary. | Tested transitions prevent double booking and enforce actor-specific cancellation behavior, including boundary cases. |
| **5 — Session completion and reviews** | Tutor-controlled completion, eligible Student rating (1–5), review visibility and duplicate/edit policy. | Tests enforce completion and review eligibility and preserve session history. |
| **6 — Private chat foundation** | **Source foundation implemented:** unique student/tutor conversations, text/image messages, read state, authenticated private downloads, and React chat UI. Migration files are pending and have not been executed. | Apply migrations only after separate database review/approval; execute isolated backend/frontend tests; verify private access and upload limits. |
| **6b — Real-time chat and notifications** | Select/configure compatible Laravel broadcaster; authorize private channels; add after-commit message events, typing indicators, presence, and in-app notifications/optional email. | Two authenticated sessions demonstrate authorized delivery, reconnect/history recovery, read events, and no unauthorized channel delivery. |
| **7 — Administration, statistics, security and thesis evaluation** | Finalize user/subject administration and metrics, hardening, accessibility, performance/backup/retention targets, end-to-end evaluation and documentation. | Approved admin scope, acceptance tests, documented results and limitations suitable for thesis evaluation. |

## 15. Current implementation status

Status below is based on inspected files and tests. “Implemented” means repository code and tests support the stated behavior; it does not mean the PostgreSQL development database has been migrated or a browser flow has been demonstrated.

### Implemented

- Laravel 13 backend and API route loading; Laravel 13.38.0 is locked, and `composer.json` requires PHP `^8.3`.
- Sanctum 4.3.3 dependency, stateful API middleware, CORS configuration, session login/logout, public Student-only registration, and current-user API response.
- Student, Tutor, and Admin roles in a many-to-many role model; role seeder uses `firstOrCreate`.
- Subject table and active-subject API lookup.
- Tutor application schema/model, normalized subject links, applicant/reviewer relationships, status/review data, and one-pending-application partial unique index for PostgreSQL/SQLite.
- Student application submission and own history, active subject validation, Admin pending list, approve/reject authorization, required rejection reason, role retention on approval, and reapplication history behavior in application logic.
- Separate initial-admin seeder with environment/config input, password hashing, validation, and refusal to promote an existing ordinary user.
- Feature tests cover authentication boundaries, registration role protection, application submission/validation, inactive subjects, duplicate pending/reapplication, review access/reason/repeat review, role retention, rollback on simulated role-write failure, and prevention of accidental admin promotion.
- PHPUnit configuration forces testing environment, a test-only application key, SQLite `:memory:`, and a blank DB URL. On 2026-10-24, the suite completed **26 tests / 99 assertions** successfully using the PHP 8.3.36 executable and process-local SQLite extension overrides.
- Separate JavaScript React + Vite application in `frontend/`, with landing, registration, login, protected dashboard placeholder, not-found page, React Router, responsive styles, and centralized Laravel API client. The frontend has a production build script and its dependencies are locked in its own `package-lock.json`.
- User profile API and frontend page for first/last name, faculty/university, study program, and biography. The existing email is read-only; the existing account `name` is kept synchronized with first and last name.
- Tutor profile model, one-to-one migration, role-gated self-service API, React page, and transactional profile creation on tutor approval. A student cannot grant themselves Tutor through these profile endpoints.
- Project owner reports that PostgreSQL migrations were applied successfully before this phase and that registration, refreshed-session persistence, logout, and dashboard protection were manually checked. Those facts were not independently retested here. New profile migrations remain unapplied to PostgreSQL.

### Partially implemented

- **Authentication:** Server routes, middleware, and a React session/CSRF API client are implemented. The project owner reports that registration, session persistence after refresh, logout, and dashboard protection were manually verified. The CSRF/CORS browser exchange was not independently retested in this phase. Frontend startup session failures currently appear only in the developer console rather than as visible status feedback.
- **Profiles:** New user/tutor profile code and feature tests are implemented. The migration changes were verified by PHPUnit on SQLite `:memory:`; the two new migrations still need review and application to the intended PostgreSQL database. Browser profile forms were not manually tested against the live API in this phase.
- **Tutor application review:** Core workflow is implemented, but conditional database constraints for all review metadata are absent; API logic enforces the expected flow. Review authorization of an Admin who is also the applicant is denied by current policy, which is stricter than the minimum Student-only restriction.
- **PostgreSQL setup:** Migrations are written for PostgreSQL as well as SQLite for tests, and `.env.example` currently defaults to PostgreSQL. The project owner reports that existing migrations were run successfully before Phase 5; this audit did not inspect the real `.env`, connect to PostgreSQL, or verify the database migration state. The two new Phase 5 migrations remain pending. Composer's `setup` script includes `artisan migrate --force`, so do not run that script until the database target and migration plan have been reviewed.
- **Frontend/API integration:** React UI tests cover chat components, but no live browser/API route rendering, cookie login, CORS, or CSRF round trip has been verified. No frontend lint script is configured.
- **Private chat:** Source code includes one conversation per student–approved tutor pair, text/image messages, paginated history, read receipts, authorized private image retrieval, aggregate and per-conversation unread counts, and a responsive React page. Laravel Reverb and Laravel Echo are wired for private message, read-receipt, and unread-count events; four-second polling remains as a fallback. Live delivery has not yet been verified in two browsers. Chat migrations remain pending and have not been run. Typing indicators and presence are deferred.
- **Laravel scaffold:** Blade welcome view and root Laravel Vite/Tailwind configuration remain. They are separate from the React frontend and are not known to conflict with its own Vite server; the Laravel `/` route still renders Blade.

### Not yet implemented

- Subject browsing and tutor search/catalogue pages and API.
- Tutor catalogue/search and tutor profile subject management.
- Tutor availability and 30/60/90-minute scheduling.
- Booking, confirmation/rejection, cancellation, 12-hour rule, and conflict prevention.
- Session lifecycle and tutor-controlled completion.
- Rating/review endpoints and pages.
- Realtime delivery, notifications, and analytics.
- In-app notifications and optional email delivery.
- Administrative user/subject management and dashboard statistics.
- End-to-end frontend/API tests and a production-ready deployment configuration.

### Repository state observed during this inspection

At the start of the Phase 5 implementation, the current branch was `main` at commit `4c499e0`. `origin` was configured as `https://github.com/Lea-M04/PeerTutoringSystem.git` for fetch and push. The worktree already had uncommitted `.env.example`, README, and specification changes plus the untracked `frontend/` directory from earlier work. No GitHub fetch or push was performed. Phase 5 source and documentation changes are also unstaged; nothing was committed.

## 16. Testing strategy and acceptance criteria

### Testing strategy

- **Unit tests:** Pure domain/helper behavior where it can be isolated usefully; avoid creating tests that merely restate framework behavior.
- **Feature/API tests:** Exercise HTTP requests, validation, authentication, authorization, response shape/status, role changes, and failure handling.
- **Database tests:** Run against an explicitly isolated testing database. The current PHPUnit configuration forces SQLite `:memory:`; never let tests inherit the local PostgreSQL `.env` settings.
- **Frontend integration tests (future):** Verify React session state, CSRF cookie exchange, credentialed CORS, role-specific access, and error handling against a test backend.
- **Real-time tests:** `tests/Feature/Api/ChatBroadcastingTest.php` covers private-channel authorization and broadcast payload safety. PHPUnit could not reach bootstrap in the current execution environment (`vendor/autoload.php` is readable through `fopen()`/`require`, but PHP `is_readable()` reports false); these backend tests remain unexecuted. A two-browser Reverb delivery check is still required.
- **Manual acceptance checks:** Demonstrate complete student, tutor, and admin journeys and boundary times with seeded test data only. Do not use or reset production/personal data.

### Acceptance criteria for the current foundation

1. Guests cannot call protected API endpoints; public registration creates Student role only.
2. A non-student cannot apply. A Student can submit valid motivation and active subject IDs and can read only their own history.
3. Missing motivation/subjects and inactive or invalid subjects are rejected; a second pending application is blocked, but a rejected applicant can create a new application without losing the old one.
4. Only an authorized Administrator can list/review pending applications; rejection requires a reason; a reviewed application cannot be reviewed again.
5. Approval records the reviewer/review time and adds Tutor while preserving Student; simulated role assignment failure rolls back the review.
6. Initial-admin provisioning fails safely for invalid configuration and never silently promotes an existing ordinary account.
7. Test configuration is isolated from the development PostgreSQL database; no test command in this phase runs development migrations.
8. Git staging/commit is a separate explicit action; `/laravel-temp/` and `.env` remain ignored.
9. Authenticated users can view and update only their own basic profile; email and role fields cannot be changed through this endpoint.
10. Only a user with the Tutor role can manage their own tutor profile; Admin approval adds that role and creates the tutor profile transactionally.

Future phases must add acceptance criteria for each new requirement before declaring it complete. Record test commands and actual results; do not equate a README statement, migration file, or planned requirement with a working feature.

## Decisions requiring confirmation

The following are intentionally left open rather than guessed:

1. Student/tutor profile fields and whether profile data is stored on `users` or in separate profile tables.
2. Tutor discovery visibility and search/filter behavior.
3. Availability recurrence, time zone, booking lead time, and exact overlap/conflict behavior.
4. Complete booking/session status names and transitions; exact handling at precisely 12 hours before a session.
5. Whether a booking and session are one record or separate records; no-show/dispute flow.
6. Review text, visibility, edits, and duplicate-review rules.
7. Message moderation and retention rules; chat eligibility is resolved as any Student with an approved Tutor, independent of bookings.
8. Exact in-app/email notification events, user preferences, and delivery provider.
9. Admin management boundaries and dashboard metrics.
10. Laravel-compatible WebSocket/broadcast package and production domains; deployment, backups, and measurable availability/performance/accessibility targets.

Until these are decided, implementation should follow only the requirements already stated here and avoid encoding assumed behavior into migrations or public API contracts.
