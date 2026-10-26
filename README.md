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

| Login | Role(s) | Responsibilities |
|---|---|---|
| `msuokas` | Roles we'll setup later :D
| `mbonsdor` | Roles we'll setup later :D
| `ykadosh` | Backend / WebSockets | Client/server messaging, backend wiring for: online presence, session management, chat functionality |
| `timurray` | _TBD_ | Not locked in yet. |

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

## Modules

The subject requires 14 points total (Major = 2pts, Minor = 1pt). Below is the initial plan — done modules first, then what's planned next. Only fully working, demonstrable modules count at evaluation, so nothing here is claimed until it's actually wired end-to-end.

### Done

| Module | Type | Points | Notes |
|---|---|---|---|
| Web — full-stack frameworks (frontend + backend) | Major | 2 | React (frontend) + Fastify (backend) |
| User Management — standard user management and authentication | Major | 2 | Done — backend (bcrypt + JWT) and frontend both wired end-to-end, see [Features](#features) |
| ORM for the database | Minor | 1 | Prisma 7 with the MariaDB driver adapter |

**Subtotal: 5 points.**

### Initial plan (target: 14+ points)

| Module | Type | Points | Owner | Status |
|---|---|---|---|---|
| Real-time features (WebSockets) — lobby presence + join/observe sessions | Major | 2 | `ykadosh` | Planned |
| User interaction — chat + profile + friends list | Major | 2 | `ykadosh` | Planned |
| Custom-made design system | Minor | 1 | TBD | Planned |
| Remote OAuth 2.0 login (e.g. GitHub) | Minor | 1 | TBD | Planned |
| Support for additional browsers | Minor | 1 | TBD | Planned |
| Multiple languages (i18n, 3 languages) | Minor | 1 | TBD | Planned |
| File upload & management — admin-only page to upload sounds/background for a new theme | Minor | 1 | TBD | Planned — buffer module |

**Planned subtotal: 9 points → target total: 14 points**, with the file-upload module as margin above the required minimum, since the subject notes unvalidated modules score 0 and recommends aiming above 14.

- *Web / User Management / ORM:* see [Technical Stack](#technical-stack) — these follow directly from the stack already in place.
- *Real-time + User interaction:* both come out of the lobby feature (live presence, session join/observe, chat), so it's one coherent feature area rather than two disconnected ones; delegated to `ykadosh`.
- *Design system, OAuth, browser support, i18n:* independent, parallelizable minors that don't block on the lobby work — good candidates to split across the rest of the team as it fills in.
- *File upload:* scoped as an admin-only page (create a theme by uploading its pad sounds + background image, with validation, preview, upload progress, and delete) rather than a per-user upload system — same 1 point, less scope: reuses the existing `themes`/`theme_sounds` tables as-is, no ownership model needed.

This plan will be revised as the team and scope firm up.

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

```bash
cp .env.example .env
make
```
Import certs/ca.pem into browser to trust certificate.

Open https://localhost:8443.
Startup also prints localhost monitoring URLs.

- `.env.example` has working local-dev credentials, safe to reuse as-is.
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

**AI usage:** AI (Claude) was used as a learning and research tool throughout the project — to understand unfamiliar concepts (e.g. Prisma 7's driver-adapter requirement, Docker Compose healthcheck/`depends_on` semantics) and to explore current best practices before implementing them, rather than to generate unreviewed code wholesale. It was also used directly to diagnose and fix a real startup-ordering bug between the backend and MySQL containers, and to help draft this README from the project's actual code and Git history.

---
