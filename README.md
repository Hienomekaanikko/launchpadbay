*This project has been created as part of the 42 curriculum by mbonsdor, ykadosh, msuokas, timurray*

# Launchpad Bay

Browser based music sampler: load a themed grid of 25 sound pads and jam alone or in a shared session. React frontend, Fastify + Prisma backend, and MySQL, all containerised with Docker Compose.

## Description

Launchpad Bay's goal is a low-friction, browser-based sampler — no install, no account required to try it, just open it and start triggering sounds on a themed 5x5 pad grid.

Key features:

- A themed 25-pad launchpad grid across five channels, with per-channel volume, low-pass filters, queued clip transitions, split timing, and stutter effects, driven by `frontend/src/launchpad/engine.js`.
- Themes (background image + body styling + per-pad sounds) are served from the backend/database rather than bundled into the frontend build, so new themes/sounds can be added without a frontend rebuild.
- User accounts with registration, username/password login, profile editing, avatars, friendships, and a GitHub OAuth flow.
- Live presence, private/session chat, and two-user collaborative launchpad sessions with join requests and shared performance controls.
- One-command containerised setup (`make up`) covering the frontend, backend, MySQL, Prometheus, and Grafana, with automatic migrations and seed data.

The [Features](#features) section describes the current implementation. Outstanding work and verification are tracked in the [Checklist](#checklist), including the pending GitHub login demonstration, translation/RTL coverage, browser checks, and monitoring alerts.

## Team Information

Role abbreviations: Product Owner (PO), Project Manager (PM) / Scrum Master, Technical Lead (TL) / Architect, and Developer (DV).

| Login | Role(s) | Responsibilities |
|---|---|---|
| `msuokas` | PO, DV | Project concept, initial UI and sample integration, Docker/MySQL/Prisma setup, bcrypt/JWT authentication, the Tailwind design system, friends/profile editing, and session/chat frontend integration |
| `mbonsdor` | TL, DV | Audio engine refactoring and modularisation, GitHub OAuth and related user-schema changes, avatar handling, internationalisation, and Hebrew RTL support |
| `ykadosh` | TL, DV | WebSocket backend, presence, shared sessions and join requests, private/session chat and message persistence, ordered message processing, and connection recovery |
| `timurray` | PM, DV | HTTPS and certificates, environment/deployment hardening, Prometheus/Grafana monitoring and metrics, CI workflow setup, responsive layouts and navbar, and Privacy Policy/Terms of Service pages |

Responsibilities overlap across features. The [Individual Contributions](#individual-contributions) section records implementation areas and technical challenges identified from the commit history.

## Project Management

- **Communication:** Discord for day-to-day coordination. GitHub pull request threads are used for code and design review, keeping technical discussion and decisions attached to the change they affect, while providing insight into the creation of new tickets.
- **Meetings:** One weekly sync, run Kanban-style: walk the board, review progress and blockers, and reprioritise the coming week's work.
- **Task tracking:** GitHub Issues on a Kanban-style GitHub Project board. Work flows continuously through the columns rather than in fixed sprints, so status and ownership are visible at a glance.
- **Ownership:** The module checklists name responsible teammates.

## Technical Stack

- **Frontend:** React 19 + Vite 8, styled with Tailwind CSS 4 and custom CSS. Utility classes and shared theme tokens keep colours, typography, and spacing consistent across reusable components; custom CSS handles launchpad animations and responsive layouts. The production build is served by nginx, which proxies `/api/*` to the backend through the same browser origin.
- **Backend:** Fastify 5 on Node.js 22. `server.js` starts the application and registers feature-specific routes and handlers in files such as `authGithub.js`, `profile.js`, `friends.js`, `sessions.js`, and `chat.js`. Fastify provides a lightweight API layer with plugins for authentication, static files, uploads, and WebSockets.
- **ORM:** Prisma 7, via the `@prisma/adapter-mariadb` driver adapter (Prisma 7 requires an explicit adapter rather than connecting straight off `DATABASE_URL`).
- **Database:** MySQL 8. Chosen as a well-understood, widely supported relational store that's a good fit for the project's structured data (users, themes, per-slot sounds) — no need for anything more specialised at this stage.
- **Audio:** The Web Audio API provides decoded sample buffers, scheduled looping sources, gain controls, and low-pass filters. The custom engine separates playback, musical timing, channel state, and effects so controls can share a common timing model.
- **Real-time communication:** `@fastify/websocket` and the browser WebSocket API handle presence, chat, session membership, and shared launchpad actions. Connection tracking and reconnection handling keep these features integrated.
- **Auth:** `bcrypt` hashes and salts passwords; `@fastify/jwt` signs and verifies application tokens. GitHub OAuth provides a second login flow that issues the same application JWT.
- **Languages:** `i18next` and `react-i18next` centralise English, Finnish, Hebrew, and Mandarin translations and support switching the document language and direction. Complete translation/RTL validation remains pending.
- **Containerisation:** Docker Compose runs the frontend, backend, MySQL, Prometheus, and Grafana. A `Makefile` wraps startup, certificate generation, and shutdown.
- **Monitoring:** Prometheus collects backend process and HTTP request metrics; a provisioned Grafana dashboard displays them. Alerting remains pending.

## Database Schema

Five tables plus one enum, managed through Prisma migrations (`backend/prisma/migrations/`):

```
users
├── id             VARCHAR(50)  PK, UUID
├── username       VARCHAR(100) UNIQUE (case-insensitive)
├── email          VARCHAR(255) UNIQUE, nullable
├── password_hash  VARCHAR(255) nullable (null for GitHub-only accounts)
├── github_id      VARCHAR(50)  UNIQUE, nullable
├── avatar         VARCHAR(255) nullable (uploaded avatar file name)
└── created_at     DATETIME(3), default now()

themes
├── id             VARCHAR(50) PK
├── name           VARCHAR(100)
├── bg_image       VARCHAR(255), nullable
└── body_class     VARCHAR(100), nullable

theme_sounds
├── theme_id       VARCHAR(50) PK (part 1), FK -> themes.id, ON DELETE CASCADE
├── slot           INT         PK (part 2)
└── filename       VARCHAR(255)

friendships
├── requester_id   VARCHAR(50) PK (part 1), FK -> users.id, ON DELETE CASCADE ON UPDATE CASCADE
├── addressee_id   VARCHAR(50) PK (part 2), FK -> users.id, ON DELETE CASCADE ON UPDATE CASCADE
├── status         ENUM('pending', 'accepted'), default 'pending'
└── created_at     DATETIME(3), default now()

messages
├── id             VARCHAR(50) PK, UUID
├── sender_id      VARCHAR(50) FK -> users.id, ON DELETE CASCADE ON UPDATE CASCADE
├── receiver_id    VARCHAR(50) FK -> users.id, ON DELETE CASCADE ON UPDATE CASCADE
├── content        TEXT
└── created_at     DATETIME(3), default now()
```

- `themes` 1—N `theme_sounds`: each theme has one sound file per pad slot (1–25); deleting a theme cascades to its sounds.
- `users` 1—N `friendships` (twice, as requester and addressee): one row per friendship direction; `status` starts as `pending` and becomes `accepted` on approval. The pair is the composite primary key, and `addressee_id` is indexed for incoming-request lookups.
- `users` 1—N `messages` (twice, as sender and receiver): private chat messages; deleting a user cascades to their sent and received messages. Composite indexes on `(sender_id, receiver_id, created_at)` and `(receiver_id, sender_id, created_at)` support both sides of a conversation.

## Features

The entries below describe implemented features. Pending validation and missing requirements remain recorded in the [Checklist](#checklist).

| Feature | Current functionality | Contributors |
|---|---|---|
| Launchpad and audio engine | 25 pads across five channels, scheduled loops and clip transitions, per-channel volume/filter controls, split timing, and stutter effects. Guest users can play without an account. | `msuokas`, `mbonsdor`; responsive layout by `timurray` |
| Backend theme loading | Themes, backgrounds, and sample URLs come from MySQL through `GET /api/themes`. Loading retries accommodate a slow-starting backend. The launchpad currently loads the first returned theme. | `msuokas`, `mbonsdor` |
| Registration and password login | Register with a username, email, and password; log in with username/password. Bcrypt protects passwords, JWTs authenticate requests, and the frontend stores the session in `localStorage`. Full input validation and email-based login remain open checklist items. | `msuokas` |
| GitHub OAuth | Authorisation redirect, state-cookie validation, code exchange, local account lookup/creation, and application JWT delivery are implemented. A successful live login demonstration remains pending. | `mbonsdor` |
| Profiles and avatars | View account information, edit email, change a password where applicable, upload an avatar or use the default image, and delete an account with confirmation. | `msuokas`, `mbonsdor` |
| Friends | Send, accept, reject, and remove friend requests/connections; list friends and their online status. | `msuokas`; presence support by `ykadosh` |
| Live lobby | Display connected users and active sessions, with presence updates and session join requests. | `ykadosh`, `msuokas` |
| Collaborative sessions | Host a two-user session, request/cancel a join, accept/reject a guest, leave a session, and share pad, split, and stutter actions. A joining partner requests a launchpad state snapshot. | `ykadosh`, `msuokas`; underlying audio engine by `mbonsdor` |
| Chat | Exchange private and session messages with unread indicators and delivery-error feedback. Private messages are stored in MySQL; the frontend does not restore their history after a reload. | `ykadosh`, `msuokas` |
| Languages and RTL | Switch between English, Finnish, Hebrew, and Mandarin. Hebrew changes the document direction; full translation coverage and RTL validation remain pending. | `mbonsdor` |
| Shared UI and responsive layouts | Reusable Tailwind components and theme tokens, plus a navbar and layouts for desktop and smaller screens. Cross-browser and accessibility verification remain pending. | `msuokas`, `timurray` |
| Policy pages | Open project-specific Privacy Policy and Terms of Service content from the footer. Final content review remains pending. | `timurray` |
| Containerised deployment | Start application and monitoring services with `make up`, generate TLS certificates, apply migrations, and seed data. | `msuokas`, `timurray` |
| Monitoring | Export process and HTTP metrics, scrape them with Prometheus, and display a provisioned Grafana dashboard. Alerting rules remain pending. | `timurray` |

## Checklist

### Mandatory

#### General requirements

- [x] The project is a web application with a frontend, backend, and database.
- [x] Git history contains commits from all four team members, meaningful commit messages, and contributions across different parts of the project.
- [x] Containerised deployment is available through one command: `make up` starts the frontend, backend, MySQL, Prometheus, and Grafana.
- [ ] The website is compatible with the latest stable version of Google Chrome.
- [ ] No warnings or errors appear in the browser console.

> We need to document the browser results when ready. Check the console results.

- [x] Privacy Policy and Terms of Service are accessible from footer controls and contain project-specific information rather than empty placeholder pages.

> Policy docs need to be extended with final specs.

- [x] Multiple users can be logged in and active at the same time.
- [x] Real-time updates are reflected across connected users where applicable.
- [ ] Concurrent actions by different users have been verified to work without conflicts or performance issues.
- [ ] Simultaneous user actions have been verified not to cause data corruption or race conditions.

> We need to verify these then tick them off.

#### Technical requirements

- [ ] The frontend is clear, responsive, and accessible across different devices.

> Validation, confirmation, testing.

- [x] A CSS framework or styling solution is used: Tailwind CSS with shared theme tokens and custom CSS.
- [x] Credentials are read from local, Git-ignored `.env` files, and `.env.example` is provided. The Compose database URL now interpolates environment variables instead of containing a literal password.
- [x] The database has a clear schema and well-defined relations: users, friendships, messages, themes, and theme sounds are defined in Prisma with migrations.
- [x] Passwords are hashed and salted with bcrypt, and protected routes verify JWTs.
- [ ] Email and password authentication is available for both signup and login.

> Technically the signup collects an email, but login currently looks up the account by username rather than email. We should sign in with email.

- [ ] All forms and user inputs are properly validated in both the frontend and backend.

> From the LLM assessment: "registration/login lack complete server-side field validation; empty JSON requests currently return HTTP 500, and login exposes Prisma error details. Session actions only receive shallow validation, and avatar uploads lack complete client-side size/format validation and server-side file-content validation."

- [x] HTTPS is used for frontend-to-backend requests and the nginx-to-backend connection; browser WebSockets use WSS in the HTTPS deployment.

#### README requirements

- [x] The first line is italicised and identifies the project as part of the 42 curriculum with all team logins.
- [x] Description includes the project name, purpose, and key features.
- [x] Instructions describe prerequisites, environment configuration, certificate trust, and commands to run the project.
- [x] Resources lists technical references and explains the tasks for which AI was used.
- [x] Team Information assigns PO, PM, Tech Lead, and Developer responsibilities to the team members.
- [x] Project Management explains the workflow, tracking tools, meetings, and communication channels.
- [x] Technical Stack accurately describes all significant technologies and their choices.

- [x] Database Schema describes tables, fields, data types, and relationships.
- [x] Features List is complete, accurate, and identifies the contributors to each feature.

- [x] Modules lists the selected and candidate modules, requirements, implementation evidence, justifications, and point calculation in this checklist.
- [ ] Each selected module has its contributing team member(s) clearly identified.
- [x] Individual Contributions gives every member's specific work and the challenges they faced and overcame.

> Pending: agree the remaining module ownership, including additional-browser checks and any optional public API or file-management work.

#### EVAL CHECKS - THIS SECTION WILL BE REMOVED

These are evaluation targets not already covered by the mandatory implementation requirements above. They do not add module points.

- [ ] All team members are present and participate in the evaluation.
- [ ] Each member can individually explain their role, contributions, and at least one feature or module they personally implemented.
- [ ] At least two different members can coherently explain the project concept, technology choices, and how the team coordinated its work.
- [ ] Members can explain each other's work and show how their contributions were integrated.
- [ ] The team can explain its architecture, technical decisions, challenges, solutions, and development trade-offs.

> Pending: these require preparation and confirmation with the team during a rehearsal or the evaluation itself.

- [x] Code has a readable structure with separate backend feature files, frontend components/hooks, and audio engine, clock, channel, and effects files.
- [ ] Deployment has been demonstrated from a fresh clone of the submitted repository in an empty directory, without relying on untracked assets or local-only configuration beyond the documented setup.
- [ ] Any testing or automation scripts used during evaluation have been reviewed with the evaluator.
- [ ] The main user flows have been demonstrated together without critical failures, including reasonable handling of unexpected or bad usage.
- [ ] The team can demonstrate its learning, explain the project's creative choices, and make a small code modification if requested.

> Pending: complete a defence rehearsal and fresh-clone run. The known validation failures must be addressed before the unexpected-input check can pass.

### Modules

`[x]` marks completed, `[ ]` missing or incomplete, `[-]` not applicable, and `[?]` pending completion, verification, or acceptance. Pending requirements do not count as achieved points. The pending-inclusive tally assumes all `[?]` requirements are completed and accepted; any remaining `[ ]` requirement keeps a module out of that tally. The public API and file-upload modules are explicitly excluded from the pending-inclusive tally.

#### Web — 9/12 points; partially complete

##### Major: Use a framework for both the frontend and backend. — 2/2 points; implemented

Responsible teammates: msuokas, mbonsdor, ykadosh, timurray

- [x] Use a frontend framework (React, Vue, Angular, Svelte, etc.).
- [x] Use a backend framework (Express, NestJS, Django, Flask, Ruby on Rails, etc.).
- [-] Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as both if you use both their frontend and backend capabilities.

##### Major: Implement real-time features using WebSockets or similar technology. — 2/2 points; implemented

Responsible teammates: ykadosh, msuokas

- [x] Real-time updates across clients.
- [x] Handle connection/disconnection gracefully.
- [x] Efficient message broadcasting.

Implementation: presence and session updates, heartbeat, reconnect attempts and a disconnect grace period. Session actions and chat are sent to their intended recipients; lobby-wide presence/session changes are broadcast to connected users. See `backend/ws.js`, `backend/sessions.js`, and `frontend/src/useSocket.js`.

##### Major: Allow users to interact with other users. The minimum requirements are: — 2/2 points; implemented

Responsible teammates: msuokas, ykadosh, mbonsdor

- [x] A basic chat system (send/receive messages between users).
- [x] A profile system (view user information).
- [?] A friends system (add/remove friends, see friends list).

Implementation: private/session chat, the signed-in user's profile, and friend requests, acceptance, removal, and listing. Viewing another user's full profile is not implemented; confirm that the evaluator accepts the existing profile system under this wording.

##### Major: A public API to interact with the database with a secured API key, rate limiting, documentation, and at least 5 endpoints: — 0/2 points; incomplete optional candidate

Responsible teammates: TBD for the public API work; existing database-route contributors: msuokas, mbonsdor, ykadosh

- [ ] GET /api/{something}
- [ ] POST /api/{something}
- [ ] PUT /api/{something}
- [ ] DELETE /api/{something}

Existing routes cover these methods and exceed five endpoints: for example, GET `/api/themes`, `/api/profile`, and `/api/friends`; POST `/api/friends/requests`; PUT `/api/profile/password`; and DELETE `/api/profile`.

> PROBLEM. I realised late that we do these endpoints but they are not public, they are private. We'd need to document and expose the endpoints.

##### Minor: Use an ORM for the database. — 1/1 point; implemented

Responsible teammates: msuokas, mbonsdor, ykadosh

- [x] Use an ORM for the database.

Implementation: Prisma models, relations, migrations, and queries with the MariaDB driver adapter.

##### Minor: Real-time collaborative features (shared workspaces, live editing, collaborative drawing, etc.). — 1/1 point; implemented

Responsible teammates: msuokas, ykadosh

- [x] Real-time collaborative features (shared workspaces, live editing, collaborative drawing, etc.).

Implementation: two users share launchpad pad, split, and stutter actions, with a state snapshot for a partner joining an existing session. This is the shared music workspace; presence and connection handling are covered by the separate real-time Major module. Volume and filter mixes stay local. See `useLaunchpadSync.js` and the session action relay.

##### Minor: Custom-made design system with reusable components, including a proper color palette, typography, and icons (minimum: 10 reusable components). — 1/1 point; implemented

Responsible teammates: msuokas, timurray

- [x] Custom-made design system with reusable components, including a proper color palette, typography, and icons (minimum: 10 reusable components).

Implementation: Tailwind theme tokens in `frontend/src/index.css`, shared colours and typography, an SVG icon system, and at least 12 reusable components: `NavButton`, `FormButton`, `CloseButton`, `Input`, `Modal`, `GlassPanel`, `Icon`, `Tag`, `UserRow`, `FriendRequestRow`, `SessionRow`, and `MessageBubble`.

##### Minor: File upload and management system. — 0/1 point; incomplete optional candidate

Responsible teammates: mbonsdor, msuokas for existing avatar/account flows; TBD for the full file-management system

- [?] Support multiple file types (images, documents, etc.).
- [ ] Client-side and server-side validation (type, size, format).
- [x] Secure file storage with proper access control.
- [x] File preview functionality where applicable.
- [x] Progress indicators for uploads.
- [ ] Ability to delete uploaded files.

Existing scope: authenticated avatar uploads accept JPEG, PNG, and WebP MIME types, use user-ID-based storage names, display the resulting avatar, and show an “Uploading…” status. Avatar images are intentionally publicly readable.

> LLM analysis "Missing: complete client-side type/size/format checks, server-side validation of actual image content, and a dedicated uploaded-file deletion action. Replacing an avatar or deleting the entire account is not treated here as a complete file-management interface. The broader theme/sound upload manager remains unimplemented, so avatar upload is only claimed as part of user management."

> If allowed the upload of wav files (.lpd file?) then I think this could work.

#### Accessibility and Internationalization — 0/3 points; completion and verification pending

##### Minor: Support for multiple languages (at least 3 languages). — 0/1 point; full translation coverage pending

Responsible teammates: mbonsdor

- [x] Implement i18n (internationalization) system.
- [x] At least 3 complete language translations.
- [x] Language switcher in the UI.
- [?] All user-facing text must be translatable.

Implementation: i18next resources for English, Finnish, Hebrew, and Mandarin, a language switcher, and stored language selection. The locale files have matching translation keys.

> I think we should consider the final labels. It is a digital interface so doesn't exactly follow the rules of physical. Maybe even just for Hebrew and or Mandarin? Would be easy. Sucks to do something just for evaluation.

##### Minor: Right-to-left (RTL) language support. — 1/1 point; incomplete, review pending

Responsible teammates: mbonsdor

- [x] Support for at least one RTL language (Arabic, Hebrew, etc.).
- [x] Complete layout mirroring (not just text direction).
- [x] RTL-specific UI adjustments where needed.
- [x] Seamless switching between LTR and RTL.

Implementation: Hebrew changes the document language and direction immediately, and some layout positioning uses logical CSS properties. We treat the LaunchPad as a musical device which would be standardised in one format globally.

##### Minor: Support for additional browsers. — 0/1 point; awaiting verification

Responsible teammates: TBD

- [?] Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge, etc.).
- [?] Test and fix all features in each browser.
- [?] Document any browser-specific limitations.
- [?] Consistent UI/UX across all supported browsers.

> Just missing validation and the point about documentation.

Pending: finish compatibility checks, resolve any failures, and document the results and any browser-specific limitations. The pending-inclusive point assumes all these requirements are completed.

#### User Management — 3/3 points; OAuth verification pending

##### Major: Standard user management and authentication. — 2/2 points; implemented

Responsible teammates: msuokas, mbonsdor, ykadosh

- [x] Users can update their profile information.
- [x] Users can upload an avatar (with a default avatar if none provided).
- [x] Users can add other users as friends and see their online status.
- [x] Users have a profile page displaying their information.

Implementation: profile/email editing, password changes for password accounts, uploaded/default avatars, friends with online status, and the profile panel.

##### Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). — 1/1 point; pending live verification

Responsible teammates: mbonsdor

- [x] Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.).

Implementation: GitHub authorisation redirect, state-cookie validation, authorisation-code exchange, local account creation/lookup, and the same application JWT flow used by password login. See `backend/authGithub.js` and the login/callback frontend integration.

#### Devops — 0/2 points; alerting pending

##### Major: Monitoring system with Prometheus and Grafana. — 0/2 points; alerting pending

Responsible teammates: timurray

- [x] Set up Prometheus to collect metrics.
- [x] Configure exporters and integrations.
- [x] Create custom Grafana dashboards.
- [?] Set up alerting rules.
- [x] Secure access to Grafana.

Implementation: backend process and HTTP metrics, HTTPS scraping, provisioned dashboards/datasource, and Grafana login with its password supplied through `.env`, disabled signup, and a host port bound to localhost.

> Add alerting rules and, if useful, example Prometheus queries.

#### Modules of choice — 0/2 points; custom-module acceptance pending

##### Major: Implement a custom module that is not listed above. — 0/2 points; pending evaluator acceptance of the audio engine

Responsible teammates: mbonsdor, msuokas

- [?] The module must be substantial and demonstrate technical complexity.
- [x] You must provide proper justification in your README.md explaining:
  - [x] Why you chose this module.
  - [x] What technical challenges it addresses.
  - [x] How it adds value to your project.
  - [x] Why it deserves Major module status (2 points).
- [x] Taking shortcuts or implementing trivial features will result in rejection.
- [x] Be creative and think outside the box.
- [x] The module should be relevant to your project context.

**Proposed module: Custom Web Audio sampler and performance engine.**

**Why it was chosen:** LaunchpadBay is a playable browser-based music instrument. Its central feature needs a sampler and performance controls that support musical timing rather than independent, immediate sound triggers.

**Technical challenges:** The engine schedules looping sources against the AudioContext clock, calculates loop and subdivision boundaries, tracks channel states (`idle`, `armed`, `playing`, and `queued`), switches or cancels queued clips, changes split timing, and starts/releases stutter divisions. It also manages decoding/caching, per-channel gain and low-pass filtering, parameter smoothing, and playback cleanup.

**Value to the project:** Users can combine the 25 pads across five channels, make timed clip transitions, and perform split/stutter effects while controlling each channel's mix in the browser.

**Why Major status is proposed:** This is a multi-part playback and timing system implemented across `engine.js`, `audio.js`, `clock.js`, `channel.js`, `split.js`, and `stutter.js`, with distinct state, scheduling, signal-processing, and resource-lifecycle responsibilities. It works locally without a partner; network action delivery and shared workspace synchronisation remain the scope of the separate collaboration module. The scope goes beyond simply attaching a sound to each button.

See [launchpad notes](frontend/src/launchpad/launchpad_notes.md) for architecture and timing details.

#### Module point totals

| Subject category | Achieved | Pending | Possible |
|---|---:|---:|---:|
| Web | 9 | 9 | 12 |
| Accessibility and Internationalization | 2 | 3 | 3 |
| User Management | 2 | 3 | 3 |
| DevOps | 0 | 2 | 2 |
| Modules of choice | 0 | 2 | 2 |
| **Total** | **13** | **19** | **22** |

## Individual Contributions

These summaries follow the authored changes in the repository and the role assignments in [Team Information](#team-information). Shared features have contributions from more than one teammate.

### msuokas: Product Owner / Developer

- **Implemented:** Project bootstrap and initial landing/launchpad UI; initial sample-engine integration; Docker/MySQL/Prisma setup; user and friendship schema changes; bcrypt/JWT authentication; the Tailwind component system; friendship management and profile editing; and frontend integration for presence, chat, session joining, and shared launchpad actions.
- **Key areas:** `backend/server.js`, `backend/friends.js`, `backend/profile.js`, Prisma migrations, `frontend/src/App.jsx`, shared components/hooks, and the original container setup.
- **Challenge and solution:** TODO

### mbonsdor: Technical Lead / Developer

- **Implemented:** Audio engine refactoring into playback, timing, channel-state, effects, and UI modules; GitHub OAuth and related user-schema changes; default/uploaded/GitHub avatars; English, Finnish, Hebrew, and Mandarin language resources and switching; Hebrew RTL adjustments; and application title/favicon updates.
- **Key areas:** `frontend/src/launchpad/`, `backend/authGithub.js`, `backend/avatars.js`, avatar/profile components, `frontend/src/i18n/`, and the language switcher.
- **Challenge and solution:** TODO

### ykadosh: Technical Lead / Developer

- **Implemented:** JWT-guarded WebSockets, the presence registry and broadcasts, session creation and join/accept/reject/leave flows, private/session chat, the messages table and persistence, canonical username handling, ordered message processing, graceful shutdown, and reconnection/session restoration. Also contributed frontend integration and technical documentation for the real-time layer.
- **Key areas:** `backend/ws.js`, `backend/sessions.js`, `backend/chat.js`, WebSocket handling in `backend/server.js`, message migrations, and socket/session hooks.
- **Challenge and solution:** TODO

### timurray: Project Manager / Developer

- **Implemented:** HTTPS certificates and proxy configuration; environment-file setup and credential/port hardening; backend metrics and Prometheus/Grafana services, provisioning, and dashboards; the CI workflow for frontend lint/build and backend dependency installation; responsive layouts and the navbar; and Privacy Policy/Terms of Service pages.
- **Key areas:** `Makefile`, `docker-compose.yml`, `backend/metrics.js`, `monitoring/`, `.github/workflows/basic.yml`, nginx/Vite configuration, `AppNavbar.jsx`, responsive styles, and policy components/content.
- **Challenge and solution:** HTTPS needed consistent trust and hostnames across the browser, nginx, backend, and monitoring scraper. Generated certificates, mounted CA files, and proxy/scraper configuration connect these components. Responsive layout work accommodates the pad grid, controls, navbar, and overlays on smaller screens.

## Instructions

### Prerequisites

- Docker with Docker Compose v2 or later, running before setup (Docker Desktop on macOS, or Docker Engine with the Compose plugin on Linux).
- A macOS or Linux shell with `make` and `curl`. On Windows, run the Makefile from a Linux environment such as WSL with Docker integration enabled.
- Internet access for the initial image/dependency downloads, mkcert, and GitHub OAuth.
- A GitHub OAuth App's client ID and secret for the configured login flow; setup is described below.
- For development commands on the host: Node.js 22.12 or later within the Node.js 22 release line, with npm. The container images and CI use Node.js 22; the locked Vite and Prisma versions require at least 22.12 on that release line. A host Node.js installation is not required for the container-only run.

### Configure the environment

Run setup commands from the repository root. For a new reusable configuration, copy the template to your home directory and restrict its permissions:

```bash
cp .env.example "$HOME/.env.launchpadbay"
chmod 600 "$HOME/.env.launchpadbay"
```

If that file already contains a working configuration, edit the existing file instead of replacing it. Fill in the values before starting the application:

| Variables | Configuration |
|---|---|
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Application database and database-user credentials. Use URL-safe values because Compose interpolates them directly into its database URL. |
| `MYSQL_ROOT_PASSWORD` | MySQL root password used during database initialisation and, if selected, host-side development access. |
| `MYSQL_HOST`, `MYSQL_PORT` | Keep `mysql` and `3306` for backend access inside the Compose network. |
| `DATABASE_URL` | Host-side Prisma connection URL using `localhost:3307`; its username/password must match the selected MySQL account. URL-encode reserved characters in connection-URL credentials. Compose supplies the backend's separate `mysql:3306` URL. |
| `JWT_SECRET` | A long, random application signing secret. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Values from the GitHub OAuth App configured below. |
| `GITHUB_CALLBACK_URL` | `https://localhost:8443/api/auth/github/callback` for the local setup. |
| `FRONTEND_URL` | `https://localhost:8443` for the local setup. |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | The monitoring dashboard's administrator login. |

The backend requires the GitHub OAuth variables at startup, including when you intend to use password login. Example placeholders are not working OAuth credentials.

An alternative is to create and configure a project-local `.env` directly:

```bash
cp .env.example .env
chmod 600 .env
```

`make` preserves an existing project `.env`. If it is absent, `make` copies `$HOME/.env.launchpadbay` to `.env` with owner-only permissions. Later edits to the home-directory file are not automatically copied over an existing `.env`; update the project file as well when changing configuration. Environment files are ignored by Git.

### Configure GitHub OAuth

Create a GitHub OAuth App using the [official registration instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app). For the local setup, use:

| OAuth setting | Value |
|---|---|
| Homepage URL | `https://localhost:8443` |
| Authorisation callback URL | `https://localhost:8443/api/auth/github/callback` |

Copy the client ID and client secret into the environment configuration. Keep `GITHUB_CALLBACK_URL` aligned with the registered callback and `FRONTEND_URL` with the browser origin. If you use another hostname or port, update the OAuth registration, environment URLs, and certificate coverage together. The current local OAuth configuration returns users to `localhost`.

### Run it

With Docker running and the configuration saved:

```bash
make
```

The Makefile creates a project `.env` if needed, downloads mkcert to `$HOME/.local/bin/mkcert` if absent, generates certificates, and builds/starts the services. To use an existing mkcert installation at another path, pass `MKCERT=/path/to/mkcert` to `make`.

The backend applies migrations and runs the idempotent seed command on startup. The initial build and database setup may take time. Check service state with `docker compose ps` and startup messages with `docker compose logs -f backend`.

### Trust the development certificate

After the first `make`, install the generated local CA into your machine's trust store using the same mkcert executable:

```bash
"$HOME/.local/bin/mkcert" -install
```

If you overrode `MKCERT`, use that executable instead. Trust-store installation may request administrator authorisation. Restart the browser afterwards. For Firefox/NSS prerequisites and platform-specific setup, follow the [mkcert instructions](https://github.com/FiloSottile/mkcert#installation).

The public CA certificate is copied to `certs/ca.pem`. Browsers or other devices using a separate trust store may need that certificate imported into their certificate-authority store; the device's browser must also use a hostname/IP covered by the generated frontend certificate.

Open **https://localhost:8443** after trusting the CA. Startup also prints the local monitoring URLs. GitHub OAuth uses the origin and callback configured above; the printed LAN URL does not automatically configure OAuth for another device.

### Makefile

| Command | What it does |
|---|---|
| `make` or `make up` | Build (if needed) and start application and monitoring services in the background |
| `make dev` | Build (if needed), start services, install frontend dependencies, and run Vite for live reload during development |
| `make down` | Stop and remove containers, preserving the MySQL, Prometheus, and Grafana volumes and uploaded avatar files |
| `make re` | `down` then `up` |
| `make fclean` | Stop/remove containers, delete the MySQL/Prometheus/Grafana volumes and service images, remove `certs/`, and delete uploaded avatar files in `backend/uploads/images/avatars/` |

- `docker compose logs -f backend` (or `frontend`, `mysql`, `prometheus`, `grafana`) — tail logs
- `docker compose ps` — see what's running

### Architecture

- **`frontend/`** — Vite/React SPA. Built and served by nginx in production (`frontend/Dockerfile`, `frontend/nginx.conf`), which also proxies `/api/*` to the backend — one origin, no CORS.
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point; authentication, profiles, friendships, chat, and sessions are split into feature-specific files. Sound/theme files live in the bind-mounted `backend/uploads/` directory and are served through `@fastify/static`. Real-time events use `@fastify/websocket`.
- **`mysql`** — MySQL 8, data in the `mysql_data` volume.
- **`prometheus`** — Scrapes backend metrics over HTTPS using `certs/ca.pem`. Stores metric history in `prometheus_data`.
- **`grafana`** — Queries Prometheus and loads its connection and dashboard from `monitoring/grafana/`. Stores accounts and local settings in `grafana_data`.

Ports: frontend HTTPS `8443`, MySQL `3307`, Grafana `3001`, and Prometheus `9090` on host (avoids clashing with a native MySQL install; containers reach it at `mysql:3306`).
Grafana and Prometheus are bound to `127.0.0.1`.

### Monitoring

Start monitoring with the application using `make up`.

| Interface | URL |
|---|---|
| Grafana | http://localhost:3001 |
| Prometheus queries | http://localhost:9090/query |
| Prometheus targets | http://localhost:9090/targets |

To keep Grafana dashboard edits in Git, save the dashboard and export it as Resource JSON with instance sharing disabled. Save it as `monitoring/grafana/dashboards/launchpadbay.json` replacing the existing file. Commit the file.
Saving in Grafana alone does not update the repository but will update local setup unless setup is completely reset with `make fclean`.

### Auth

- `users` table: `id` (uuid), `username` (case-insensitively unique), `email`/`github_id` (unique, nullable), `password_hash` (bcrypt, nullable for GitHub-only accounts), `avatar` (nullable), `created_at`.
- `POST /register` — hashes password, creates user, 409 on duplicate username/email.
- `POST /login` — bcrypt-compares password, returns a JWT on success. Wrong password and unknown username both return the same generic 401 (no username enumeration).
- `JWT_SECRET` in `.env` signs/verifies tokens.

### Working on the backend/database

Start the containers with `make` before using the host-side database tools. With the development Node.js/npm prerequisites installed, install the backend dependencies, generate the client, and create a migration using the project's configuration:

```bash
cd backend
npm ci
DOTENV_CONFIG_PATH=../.env ./node_modules/.bin/prisma generate --config prisma7.config.ts
DOTENV_CONFIG_PATH=../.env ./node_modules/.bin/prisma migrate dev --config prisma7.config.ts --name describe_your_change
```

`DOTENV_CONFIG_PATH` selects the root `.env`; `--config` selects the repository's `prisma7.config.ts` file explicitly. See the [Prisma configuration reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference) for custom config paths. Run `npm ci` again when the backend lockfile changes.

- Use the local binary path, not bare `npx prisma` — `npx` has unpredictably resolved to an unstable prerelease instead of the pinned version.
- Commit the generated `prisma/migrations/` files along with the schema change.
- New default data → extend `prisma/seed.js` (keep upserts idempotent — it also runs on every container start).

**`DATABASE_URL` has two values on purpose:**

- The root `.env` value uses `localhost:3307` for Prisma CLI commands from your host machine. Configure it with the chosen database account's credentials.
- `docker-compose.yml` overrides it for the backend with a URL built from `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`, using `mysql:3306` inside the Compose network.

### Working on the frontend with fast reload

```bash
make dev
```

- `make dev` starts the Compose services, runs `npm ci` in `frontend/`, and starts Vite at `http://localhost:5173`.
- The Vite proxy forwards `/api/*`, including WebSocket upgrades, through `https://localhost:8443` to nginx and the backend. The npm script trusts `certs/ca.pem` through `NODE_EXTRA_CA_CERTS`.
- The frontend, backend, and MySQL containers remain necessary for this proxy path. Finish the environment/certificate setup first.
- The configured GitHub OAuth callback returns to `FRONTEND_URL` (by default `https://localhost:8443`), so it returns to the container-served UI rather than the Vite page unless the OAuth environment is deliberately reconfigured.

## Resources

- [Fastify documentation](https://fastify.dev/docs/latest/)
- [Prisma ORM documentation](https://www.prisma.io/docs)
- [Prisma configuration reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [GitHub OAuth App registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [mkcert setup and trust-store instructions](https://github.com/FiloSottile/mkcert#installation)
- [MySQL 8 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [bcrypt (node)](https://www.npmjs.com/package/bcrypt) / [@fastify/jwt](https://github.com/fastify/fastify-jwt)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [React documentation](https://react.dev/)
- [Prometheus documentation](https://prometheus.io/docs/introduction/overview/)
- [Grafana documentation](https://grafana.com/docs/grafana/latest/)

**AI usage:** AI (Claude) was used as a learning and research tool throughout the project — to understand unfamiliar concepts (e.g. Prisma 7's driver-adapter requirement, Docker Compose healthcheck/`depends_on` semantics) and to explore current best practices before implementing them, rather than to generate unreviewed code wholesale. It was also used directly to diagnose and fix a real startup-ordering bug between the backend and MySQL containers, and to help draft this README from the project's actual code and Git history. Codex was used to compare the implementation with the subject and evaluation sheet, assemble the requirements checklist, and draft the audio engine's custom-module justification.

---
