*This project has been created as part of the 42 curriculum by mbonsdor, ykadosh, msuokas, timurray*

# LaunchpadBay

Browser-based, sample-triggering launchpad: pick a theme, get a 25-pad grid of sounds, and jam. React frontend, Fastify + Prisma backend, MySQL, all containerized with Docker Compose.

## Description

LaunchpadBay's goal is a low-friction, browser-based sampler — no install, no account required to try it, just open it and start triggering sounds on a themed 5x5 pad grid.

Key features so far:
- A themed 25-pad launchpad grid with per-slot sounds, master volume, low-pass filter knobs, and stutter effects, driven by an engine in `frontend/src/launchpad/engine.js`.
- Themes (background image + body styling + per-pad sounds) are served from the backend/database rather than bundled into the frontend build, so new themes/sounds can be added without a frontend rebuild.
- A user account system (register/login) on the backend, using bcrypt password hashing and JWT session tokens.
- One-command containerized setup (`make up`) covering the frontend, backend, and MySQL, with automatic migrations and seeding on first run.

> Not everything below is wired end-to-end yet — see [Features](#features) and [Individual Contributions](#individual-contributions) for what's real vs. still a UI mock.

## Team Information

Role options: Product Owner (PO), Project Manager (PM) / Scrum Master, Technical Lead / Architect, and Developer(DV).

| Login | Role(s) | Responsibilities |
|---|---|---|
| `msuokas` | PO, DV | Project concept, initial UI and sample integration, Docker/MySQL/Prisma setup, bcrypt/JWT authentication, the Tailwind design system, friends/profile editing, and session/chat frontend integration
| `mbonsdor` | TL, DV | Audio engine refactoring and modularisation, GitHub OAuth, avatar handling, internationalization, and Hebrew RTL support
| `ykadosh` | TL, DV | WebSocket backend, presence, shared sessions and join requests, private/session chat and message persistence, ordered message processing, and connection recovery |
| `timurray` | PM, DV | HTTPS and certificates, environment/deployment hardening, Prometheus/Grafana monitoring and metrics, CI workflow setup, responsive layouts and navbar, and Privacy Policy/Terms of Service pages |

> Missing database details and others.


## Project Management

- **Communication:** Discord for day-to-day coordination. GitHub pull request threads are used for code and design review, keeping technical discussion and decisions attached to the change they affect, while providing insight into the creation of new tickets.
- **Meetings:** One weekly sync, run Kanban-style: walk the board, review progress and blockers, and reprioritise the coming week's work.
- **Task tracking:** GitHub Issues on a Kanban-style GitHub Project board. Work flows continuously through the columns rather than in fixed sprints, so status and ownership are visible at a glance.
- _More detail (task distribution process) to be added once the full team is active._

## Technical Stack

- **Frontend:** React 19 + Vite, plain CSS (no component/UI framework). Built and served by nginx in production, which also proxies `/api/*` to the backend so the browser only ever talks to one origin (no CORS in prod).
- **Backend:** Fastify 5 (Node.js), routes defined directly in `server.js`. Chosen for a minimal, low-overhead API layer without the boilerplate of a heavier framework.
- **ORM:** Prisma 7, via the `@prisma/adapter-mariadb` driver adapter (Prisma 7 requires an explicit adapter rather than connecting straight off `DATABASE_URL`).
- **Database:** MySQL 8. Chosen as a well-understood, widely-supported relational store that's a good fit for the project's structured data (users, themes, per-slot sounds) — no need for anything more specialized at this stage.
- **Auth:** `bcrypt` for password hashing, `@fastify/jwt` for signing/verifying session tokens.
- **Containerization:** Docker Compose runs the frontend, backend, MySQL, Prometheus, and Grafana. A `Makefile` wraps the startup and shutdown commands.
- **Monitoring:** Prometheus used to collect backend process data and HTTP request metrics. Grafana displays data in dashboard.

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

What's actually functional today:
- **Launchpad grid** — 25 playable pads with sound, volume, filter, and stutter controls (`frontend/src/launchpad/engine.js`, `LaunchpadView.jsx`).
- **Theme loading from the backend** — `GET /themes` returns background image + per-slot sound URLs, consumed by the frontend (`frontend/src/launchpad/themes.js`) with retry/backoff so a slow-starting backend doesn't leave the UI silently broken.
- **Backend auth API** — `POST /register` (bcrypt hash, 409 on duplicate username/email) and `POST /login` (bcrypt compare, returns a JWT), fully working against the database.
- **Login/Register, end-to-end** (`frontend/src/App.jsx`, `frontend/src/auth.js`) — the forms call the real backend endpoints; a successful login stores the JWT in `localStorage` (session survives a reload) and flips the nav button to "Logout"; duplicate-username, password-mismatch, and bad-login errors all surface inline in the form.
- **Fully containerized startup** — `make up` builds and starts everything, auto-runs Prisma migrations and seeding, and retries against MySQL until it's actually ready instead of failing on a slow first boot.
- **Monitoring the Backend** — Prometheus collects data from Node.js (process metrics, HTTP requests and reponse durations). Grafana automatically loads these into a dashboard graphing the statistics.
- **Lobby view** ("who's playing", chat, join/observe) — static placeholder text only, no real data or backend support. Assigned to `ykadosh`, see [Modules](#modules).

## Checklist
### Mandatory
#### General requirements

- [x] The project is a web application with a frontend, backend, and database.
- [x] Git history contains commits from all four team members, meaningful commit messages, and contributions across different parts of the project.
- [x] Containerized deployment is available through one command: `make up` starts the frontend, backend, MySQL, Prometheus, and Grafana.
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

- [x] The first line is italicized and identifies the project as part of the 42 curriculum with all team logins.
- [x] Description includes the project name, purpose, and key features.
- [x] Instructions describe prerequisites, environment configuration, certificate trust, and commands to run the project.
- [x] Resources lists technical references and explains the tasks for which AI was used.
- [x] Team Information assigns PO, PM, Tech Lead, and Developer responsibilities to the team members.
- [x] Project Management explains the workflow, tracking tools, meetings, and communication channels.
- [ ] Technical Stack accurately describes all significant technologies and their choices.

Missing: the existing Technical Stack paragraph still says plain CSS and needs to reflect the Tailwind implementation.

- [x] Database Schema describes tables, fields, data types, and relationships.
- [ ] Features List is complete, accurate, and identifies the contributors to each feature.

Missing: the existing feature list still describes the working lobby as a static placeholder and omits several implemented features.

- [x] Modules lists the selected and candidate modules, requirements, implementation evidence, justifications, and point calculation in this checklist.
- [ ] Each selected module has its contributing team member(s) clearly identified.
- [ ] Individual Contributions gives every member's specific work and the challenges they faced and overcame.

> We need to add these details.

#### EVAL CHECKS - THIS SECTION WILL BE REMOVED

These are evaluation targets not already covered by the mandatory implementation requirements above. They do not add module points.

- [ ] All team members are present and participate in the evaluation.
- [ ] Each member can individually explain their role, contributions, and at least one feature or module they personally implemented.
- [ ] At least two different members can coherently explain the project concept, technology choices, and how the team coordinated its work.
- [ ] Members can explain each other's work and show how their contributions were integrated.
- [ ] The team can explain its architecture, technical decisions, challenges, solutions, and development trade-offs.

Pending: these require preparation and confirmation with the team during a rehearsal or the evaluation itself.

- [x] Code has a readable structure with separate backend feature files, frontend components/hooks, and audio engine, clock, channel, and effects files.
- [ ] Deployment has been demonstrated from a fresh clone of the submitted repository in an empty directory, without relying on untracked assets or local-only configuration beyond the documented setup.
- [ ] Any testing or automation scripts used during evaluation have been reviewed with the evaluator.
- [ ] The main user flows have been demonstrated together without critical failures, including reasonable handling of unexpected or bad usage.
- [ ] The team can demonstrate its learning, explain the project's creative choices, and make a small code modification if requested.

Pending: complete a defense rehearsal and fresh-clone run. The known validation failures must be addressed before the unexpected-input check can pass.

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
- [x] A friends system (add/remove friends, see friends list).

Implementation: private/session chat, the signed-in user's profile, and friend requests, acceptance, removal, and listing. Viewing another user's full profile is not implemented; confirm that the evaluator accepts the existing profile system under this wording.

##### Major: A public API to interact with the database with a secured API key, rate limiting, documentation, and at least 5 endpoints: — 0/2 points; incomplete optional candidate

Responsible teammates: TBD for the public API work; existing database-route contributors: msuokas, mbonsdor, ykadosh

- [x] GET /api/{something}
- [x] POST /api/{something}
- [x] PUT /api/{something}
- [x] DELETE /api/{something}

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

Implementation: Tailwind theme tokens in `frontend/src/index.css`, shared colors and typography, an SVG icon system, and at least 12 reusable components: `NavButton`, `FormButton`, `CloseButton`, `Input`, `Modal`, `GlassPanel`, `Icon`, `Tag`, `UserRow`, `FriendRequestRow`, `SessionRow`, and `MessageBubble`.

##### Minor: File upload and management system. — 0/1 point; incomplete optional candidate

Responsible teammates: mbonsdor, msuokas for existing avatar/account flows; TBD for the full file-management system

- [x] Support multiple file types (images, documents, etc.).
- [ ] Client-side and server-side validation (type, size, format).
- [x] Secure file storage with proper access control.
- [x] File preview functionality where applicable.
- [x] Progress indicators for uploads.
- [ ] Ability to delete uploaded files.

Existing scope: authenticated avatar uploads accept JPEG, PNG, and WebP MIME types, use user-ID-based storage names, display the resulting avatar, and show an “Uploading…” status. Avatar images are intentionally publicly readable.

>LLM analysis "Missing: complete client-side type/size/format checks, server-side validation of actual image content, and a dedicated uploaded-file deletion action. Replacing an avatar or deleting the entire account is not treated here as a complete file-management interface. The broader theme/sound upload manager remains unimplemented, so avatar upload is only claimed as part of user management."

> If allowed the upload of wav files then I think this could work. 


#### Accessibility and Internationalization — 0/3 points; completion and verification pending

##### Minor: Support for multiple languages (at least 3 languages). — 0/1 point; full translation coverage pending

Responsible teammates: mbonsdor

- [x] Implement i18n (internationalization) system.
- [x] At least 3 complete language translations.
- [x] Language switcher in the UI.
- [?] All user-facing text must be translatable.

Implementation: i18next resources for English, Finnish, Hebrew, and Mandarin, a language switcher, and stored language selection. The locale files have matching translation keys.

> I think we should consider the final labels. It is a digital interface so doesn't exactly follow the rules of physical. Maybe even just for Hebrew and or Mandarin? Would be easy. Sucks to do something just for evaluation.

##### Minor: Right-to-left (RTL) language support. — 0/1 point; incomplete, review pending

Responsible teammates: mbonsdor

- [x] Support for at least one RTL language (Arabic, Hebrew, etc.).
- [?] Complete layout mirroring (not just text direction).
- [?] RTL-specific UI adjustments where needed.
- [x] Seamless switching between LTR and RTL.

Implementation: Hebrew changes the document language and direction immediately, and some layout positioning uses logical CSS properties.

> Just need to validate completely here.

Pending: validate complete mirroring and RTL-specific adjustments, including the launchpad and chat layouts that currently force LTR. The pending-inclusive point assumes any required adjustments are completed and the full requirement passes review.

##### Minor: Support for additional browsers. — 0/1 point; awaiting verification

Responsible teammates: TBD

- [?] Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge, etc.).
- [?] Test and fix all features in each browser.
- [?] Document any browser-specific limitations.
- [?] Consistent UI/UX across all supported browsers.

> Just missing validation and the point about documentation.

Pending: finish compatibility checks, resolve any failures, and document the results and any browser-specific limitations. The pending-inclusive point assumes all these requirements are completed.

#### User Management — 2/3 points; OAuth verification pending

##### Major: Standard user management and authentication. — 2/2 points; implemented

Responsible teammates: msuokas, mbonsdor, ykadosh

- [x] Users can update their profile information.
- [x] Users can upload an avatar (with a default avatar if none provided).
- [x] Users can add other users as friends and see their online status.
- [x] Users have a profile page displaying their information.

Implementation: profile/email editing, password changes for password accounts, uploaded/default avatars, friends with online status, and the profile panel.

##### Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). — 0/1 point; pending live verification

Responsible teammates: mbonsdor

- [?] Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.).

Implementation: GitHub authorization redirect, state-cookie validation, authorization-code exchange, local account creation/lookup, and the same application JWT flow used by password login. See `backend/authGithub.js` and the login/callback frontend integration.

Pending: demonstrate a successful GitHub login round trip with the evaluation configuration. Passing this check adds 1 point; no further implementation is currently identified as necessary for this module.

#### Devops — 0/2 points; alerting pending

##### Major: Monitoring system with Prometheus and Grafana. — 0/2 points; alerting pending

Responsible teammates: timurray

- [x] Set up Prometheus to collect metrics.
- [x] Configure exporters and integrations.
- [x] Create custom Grafana dashboards.
- [?] Set up alerting rules.
- [x] Secure access to Grafana.

Implementation: backend process and HTTP metrics, HTTPS scraping, provisioned dashboards/datasource, and Grafana login with its password supplied through `.env`, disabled signup, and a localhost. only host port.

> Need to add alerting and possible some prometheus example queuries.

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

**Why Major status is proposed:** This is a multi-part playback and timing system implemented across `engine.js`, `audio.js`, `clock.js`, `channel.js`, `split.js`, and `stutter.js`, with distinct state, scheduling, signal-processing, and resource-lifecycle responsibilities. It works locally without a partner; network action delivery and shared workspace synchronization remain the scope of the separate collaboration module. The scope goes beyond simply attaching a sound to each button.

See [launchpad notes](frontend/src/launchpad/launchpad_notes.md) for architecture and timing details.

#### Module point totals

| Subject category | Achieved | Pending | Possible |
|---|---:|---:|---:|
| Web | 9 | 9 | 12 |
| Accessibility and Internationalization | 0 | 3 | 3 |
| User Management | 2 | 3 | 3 |
| Devops | 0 | 2 | 2 |
| Modules of choice | 0 | 2 | 2 |
| **Total** | **11** | **19** | **22** |


## Individual Contributions

- **msuokas:** Project bootstrap; landing page and launchpad UI/design; Dockerized the full stack (frontend, backend, MySQL) with a `Makefile`; `users` table and Prisma migration; backend auth (`bcrypt` + JWT) in `server.js`; hardened container startup against slow/unready MySQL (Compose healthcheck, backend entrypoint retry loop, frontend fetch retry) after hitting that exact failure on a school computer. Implemented friendship management (User interaction module); Also profile view?
- **mbonsdor:** sound engine and pad grid (`launchpad/engine.js`); profile view; i18n support for multiple languages (Finnish, Mandarin, Hebrew), including RTL layout for Hebrew.
- **ykadosh:** Real-time backend and WebSocket layer: JWT-guarded `/ws`, connection/reconnect and heartbeat handling, presence registry and broadcasts, session request/accept/join/leave flows, and private/session chat. App and socket stability on page refreshes and reconnects (additional tabs). Also small frontend integration for the real-time layer, and regular PR reviews.
- **timurray:** Certificate creation, DevOps implementation, mobile frontend.

## Instructions

### Prerequisites

- Docker + Docker Compose (Docker Desktop on Mac/Windows; Docker Engine + Compose plugin on Linux)
- `make`

### Run it
A .env.launchpadbay in $HOME is required for running.

```bash
make
```
Import certs/ca.pem into browser to trust certificate.

Open https://localhost:8443.
Startup also prints localhost monitoring URLs.

- Replace the credential placeholders in `.env` before starting, including the GitHub OAuth App credentials.
- To reuse a working configuration, store it privately at `$HOME/.env.launchpadbay`. `make` copies it to `.env` with owner-only permissions when `.env` is missing; an existing `.env` is preserved.
- First run auto-applies migrations and seeds the default theme/sounds.

### Makefile

| Command | What it does |
|---|---|
| `make` or `make up`| Build (if needed) and start application and monitoring services in the background |
| `make dev` | Build (if needed), start services, install frontend dependencies, and run Vite for live reload during development |
| `make down` | Stop and remove containers, leaving database data (lives in the `mysql_data` volume), metric history, and Grafana state untouched  |
| `make re` | `down` then `up` |
| `make fclean` | `down` + delete volumes (wipes DB, Prometheus and Grafana volumes) + delete built images + remove certificates — full reset |

- `docker compose logs -f backend` (or `frontend`,`mysql`,`prometheus`,`grafana`) — tail logs
- `docker compose ps` — see what's running

### Architecture

- **`frontend/`** — Vite/React SPA. Built and served by nginx in production (`frontend/Dockerfile`, `frontend/nginx.conf`), which also proxies `/api/*` to the backend — one origin, no CORS.
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point, routes added directly there for now. Sound/theme files live in `backend/uploads/` (bind-mounted, no rebuild needed to replace one), served via `@fastify/static`. Realtime events are backed by WebSockets, via the `@fastify/websocket` plugin.
- **`mysql`** — MySQL 8, data in the `mysql_data` volume.
- **`prometheus`** — Scrapes backend metrics over HTTPS using `certs/ca.pem`. Stores metric history in `prometheus_data`.
- **`grafana`** — Queries Prometheus and loads its connection and dashboard from `monitoring/grafana/`. Stores accounts and local settings in `grafana_data`.

Ports: frontend HTTPS `8443`, MySQL `3307`, Grafana `3001`, and Prometheus `9090` on host (avoids clashing with a native MySQL install; containers reach it at `mysql:3306`).
Grafana and Prometheus are bound to `127.0.0.1`

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

Schema changes go through Prisma, not manual SQL:

```
cd backend
DOTENV_CONFIG_PATH=../.env ./node_modules/.bin/prisma migrate dev --name describe_your_change
```

- Use the local binary path, not bare `npx prisma` — `npx` has unpredictably resolved to an unstable prerelease instead of the pinned version.
- Commit the generated `prisma/migrations/` files along with the schema change.
- New default data → extend `prisma/seed.js` (keep upserts idempotent — it also runs on every container start).

**`DATABASE_URL` has two values on purpose:**
- `.env`'s own value (`localhost:3307`, root) is for running Prisma CLI commands from your host machine.
- `docker-compose.yml` overrides it for the `backend` service specifically (`mysql:3306`, `dj`) — the container needs its own internal address, not the host one.

### Working on the frontend with fast reload

```
make dev
```

- Runs Vite's dev server on `http://localhost:5173`.
- Proxies `/api/*` to the backend (see `vite.config.js`), same as nginx does in the containerized setup.
- `mysql`/`backend` containers still need to be running (`make up`, or `docker compose up -d mysql backend`).

## Resources

- [Fastify documentation](https://fastify.dev/docs/latest/)
- [Prisma ORM documentation](https://www.prisma.io/docs)
- [MySQL 8 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [bcrypt (node)](https://www.npmjs.com/package/bcrypt) / [@fastify/jwt](https://github.com/fastify/fastify-jwt)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [React documentation](https://react.dev/)
- [Prometheus documentation](https://prometheus.io/docs/introduction/overview/)
- [Grafana documentation](https://grafana.com/docs/grafana/latest/)

**AI usage:** AI (Claude) was used as a learning and research tool throughout the project — to understand unfamiliar concepts (e.g. Prisma 7's driver-adapter requirement, Docker Compose healthcheck/`depends_on` semantics) and to explore current best practices before implementing them, rather than to generate unreviewed code wholesale. It was also used directly to diagnose and fix a real startup-ordering bug between the backend and MySQL containers, and to help draft this README from the project's actual code and Git history. Codex was used to compare the implementation with the subject and evaluation sheet, assemble the requirements checklist, and draft the audio engine's custom-module justification. The resulting point estimates still require live demonstrations and peer validation.

---
