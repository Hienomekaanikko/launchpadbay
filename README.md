# LaunchpadBay

Browser-based, sample-triggering launchpad. React frontend, Fastify + Prisma backend, MySQL. All containerized.

## Prerequisites

- Docker + Docker Compose (Docker Desktop on Mac/Windows; Docker Engine + Compose plugin on Linux)
- `make`

## Setup

```
cp backend/.env.example backend/.env
make up
```

Open http://localhost:8080.

- `.env.example` has working local-dev credentials, safe to reuse as-is.
- First run auto-applies migrations and seeds the default theme/sounds.

## Makefile

| Command | What it does |
|---|---|
| `make up` | Build (if needed) and start everything, in the background |
| `make down` | Stop and remove containers — data untouched (lives in the `mysql_data` volume) |
| `make re` | `down` then `up` |
| `make fclean` | `down` + delete volumes (wipes the DB) + delete built images — full reset |

- `docker compose logs -f backend` (or `frontend`/`mysql`) — tail logs
- `docker compose ps` — see what's running

## Architecture

- **`frontend/`** — Vite/React SPA. Built and served by nginx in production (`frontend/Dockerfile`, `frontend/nginx.conf`), which also proxies `/api/*` to the backend — one origin, no CORS.
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point, routes added directly there for now. Sound/theme files live in `backend/uploads/` (bind-mounted, no rebuild needed to replace one), served via `@fastify/static`.
- **`mysql`** — MySQL 8, data in the `mysql_data` volume.

Ports: frontend `8080`, backend `3000` (also reachable directly), MySQL `3307` on host (avoids clashing with a native MySQL install; containers reach it at `mysql:3306`).

## Auth

- `users` table: `id` (uuid), `username`/`email` (unique), `password_hash` (bcrypt), `created_at`.
- `POST /register` — hashes password, creates user, 409 on duplicate username/email.
- `POST /login` — bcrypt-compares password, returns a JWT on success. Wrong password and unknown username both return the same generic 401 (no username enumeration).
- `JWT_SECRET` in `.env` signs/verifies tokens.

## Working on the backend/database

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

## Working on the frontend with fast reload

```
cd frontend
npm install
npm run dev
```

- Runs Vite's dev server on `http://localhost:5173`.
- Proxies `/api/*` to the backend (see `vite.config.js`), same as nginx does in the containerized setup.
- `mysql`/`backend` containers still need to be running (`make up`, or `docker compose up -d mysql backend`).
