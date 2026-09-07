*This project has been created as part of the 42 curriculum by mbonsdor, ykadosh, msuokas.*

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
| `ykadosh` | Roles we'll setup later :D
| _4th member_ | _TBD_ | Not locked in yet. |

## Project Management

- **Communication:** Discord.
- **Task tracking:** GitHub Issues and a GitHub Project board.
- _More detail (meeting cadence, task distribution process) to be added once the full team is active._

## Technical Stack

- **Frontend:** React 19 + Vite, plain CSS (no component/UI framework). Built and served by nginx in production, which also proxies `/api/*` to the backend so the browser only ever talks to one origin (no CORS in prod).
- **Backend:** Fastify 5 (Node.js), routes defined directly in `server.js`. Chosen for a minimal, low-overhead API layer without the boilerplate of a heavier framework.
- **ORM:** Prisma 7, via the `@prisma/adapter-mariadb` driver adapter (Prisma 7 requires an explicit adapter rather than connecting straight off `DATABASE_URL`).
- **Database:** MySQL 8. Chosen as a well-understood, widely-supported relational store that's a good fit for the project's structured data (users, themes, per-slot sounds) — no need for anything more specialized at this stage.
- **Auth:** `bcrypt` for password hashing, `@fastify/jwt` for signing/verifying session tokens.
- **Containerization:** Docker + Docker Compose for the full stack (frontend, backend, MySQL); a `Makefile` wraps the common Compose commands.

## Database Schema (for now)

Three tables, managed through Prisma migrations (`backend/prisma/migrations/`):

```
users
├── id             VARCHAR(50)  PK, UUID
├── username       VARCHAR(100) UNIQUE
├── email          VARCHAR(255) UNIQUE
├── password_hash  VARCHAR(255)
└── created_at     DATETIME, default now()

themes
├── id           VARCHAR(50) PK
├── name         VARCHAR(100)
├── bg_image     VARCHAR(255), nullable
└── body_class   VARCHAR(100), nullable

theme_sounds
├── theme_id  VARCHAR(50) PK (part 1), FK -> themes.id, ON DELETE CASCADE
├── slot      INT         PK (part 2)
└── filename  VARCHAR(255)
```

- `themes` 1—N `theme_sounds`: each theme has one sound file per pad slot (1–25); deleting a theme cascades to its sounds.
- `users` is currently standalone — no relation yet to themes or sessions.

## Features

What's actually functional today:
- **Launchpad grid** — 25 playable pads with sound, volume, filter, and stutter controls (`frontend/src/launchpad/engine.js`, `LaunchpadView.jsx`).
- **Theme loading from the backend** — `GET /themes` returns background image + per-slot sound URLs, consumed by the frontend (`frontend/src/launchpad/themes.js`) with retry/backoff so a slow-starting backend doesn't leave the UI silently broken.
- **Backend auth API** — `POST /register` (bcrypt hash, 409 on duplicate username/email) and `POST /login` (bcrypt compare, returns a JWT), fully working against the database.
- **Login/Register, end-to-end** (`frontend/src/App.jsx`, `frontend/src/auth.js`) — the forms call the real backend endpoints; a successful login stores the JWT in `localStorage` (session survives a reload) and flips the nav button to "Logout"; duplicate-username, password-mismatch, and bad-login errors all surface inline in the form.
- **Fully containerized startup** — `make up` builds and starts everything, auto-runs Prisma migrations and seeding, and retries against MySQL until it's actually ready instead of failing on a slow first boot.

Still a UI mock, not yet wired up:
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

- **msuokas:** Project bootstrap; landing page and launchpad UI/design; Dockerized the full stack (frontend, backend, MySQL) with a `Makefile`; `users` table and Prisma migration; backend auth (`bcrypt` + JWT) in `server.js`; hardened container startup against slow/unready MySQL (Compose healthcheck, backend entrypoint retry loop, frontend fetch retry) after hitting that exact failure on a school computer.
- **mbonsdor:** sound engine and pad grid (`launchpad/engine.js`);
- **ykadosh:** Assigned the lobby experience (not started yet) — real-time presence and session join/observe (Real-time/WebSockets module), plus chat, profile view, and friends list (User interaction module).

## Instructions

### Prerequisites

- Docker + Docker Compose (Docker Desktop on Mac/Windows; Docker Engine + Compose plugin on Linux)
- `make`

### Run it

```
cp backend/.env.example backend/.env
make up
```

Open http://localhost:8080.

- `.env.example` has working local-dev credentials, safe to reuse as-is.
- First run auto-applies migrations and seeds the default theme/sounds.

### Makefile

| Command | What it does |
|---|---|
| `make up` | Build (if needed) and start everything, in the background |
| `make down` | Stop and remove containers — data untouched (lives in the `mysql_data` volume) |
| `make re` | `down` then `up` |
| `make fclean` | `down` + delete volumes (wipes the DB) + delete built images — full reset |

- `docker compose logs -f backend` (or `frontend`/`mysql`) — tail logs
- `docker compose ps` — see what's running

### Architecture

- **`frontend/`** — Vite/React SPA. Built and served by nginx in production (`frontend/Dockerfile`, `frontend/nginx.conf`), which also proxies `/api/*` to the backend — one origin, no CORS.
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point, routes added directly there for now. Sound/theme files live in `backend/uploads/` (bind-mounted, no rebuild needed to replace one), served via `@fastify/static`.
- **`mysql`** — MySQL 8, data in the `mysql_data` volume.

Ports: frontend `8080`, backend `3000` (also reachable directly), MySQL `3307` on host (avoids clashing with a native MySQL install; containers reach it at `mysql:3306`).

### Auth

- `users` table: `id` (uuid), `username`/`email` (unique), `password_hash` (bcrypt), `created_at`.
- `POST /register` — hashes password, creates user, 409 on duplicate username/email.
- `POST /login` — bcrypt-compares password, returns a JWT on success. Wrong password and unknown username both return the same generic 401 (no username enumeration).
- `JWT_SECRET` in `.env` signs/verifies tokens.

### Working on the backend/database

Schema changes go through Prisma, not manual SQL:

```
cd backend
./node_modules/.bin/prisma migrate dev --name describe_your_change
```

- Use the local binary path, not bare `npx prisma` — `npx` has unpredictably resolved to an unstable prerelease instead of the pinned version.
- Commit the generated `prisma/migrations/` files along with the schema change.
- New default data → extend `prisma/seed.js` (keep upserts idempotent — it also runs on every container start).

**`DATABASE_URL` has two values on purpose:**
- `.env`'s own value (`localhost:3307`, root) is for running Prisma CLI commands from your host machine.
- `docker-compose.yml` overrides it for the `backend` service specifically (`mysql:3306`, `dj`) — the container needs its own internal address, not the host one.

### Working on the frontend with fast reload

```
cd frontend
npm install
npm run dev
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

**AI usage:** AI (Claude) was used as a learning and research tool throughout the project — to understand unfamiliar concepts (e.g. Prisma 7's driver-adapter requirement, Docker Compose healthcheck/`depends_on` semantics) and to explore current best practices before implementing them, rather than to generate unreviewed code wholesale. It was also used directly to diagnose and fix a real startup-ordering bug between the backend and MySQL containers, and to help draft this README from the project's actual code and Git history.

---
