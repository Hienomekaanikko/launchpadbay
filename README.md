# LaunchpadBay

A browser-based, sample-triggering launchpad. React frontend, Fastify + Prisma backend, MySQL, all containerized.

## Prerequisites

- Docker Desktop (running)
- `make`

## Setup

```
cp backend/.env.example backend/.env
make up
```

Then open **http://localhost:8080**.

`.env.example` ships with working local-dev credentials — nothing sensitive, safe to reuse as-is for local development. `make up` builds and starts the whole stack: on first run, the backend automatically applies its database migrations and seeds the default theme/sounds before starting.

## Makefile

| Command       | What it does |
|---------------|--------------|
| `make up`     | Build (if needed) and start everything, in the background |
| `make down`   | Stop and remove the containers — your data is untouched (it lives in the `mysql_data` volume, not the containers) |
| `make re`     | `down` then `up` — full restart |
| `make fclean` | `down` **plus** delete the volumes (wipes the database) and the built images. Full reset — use when you want a truly clean slate |

Other useful commands:
- `docker compose logs -f backend` (or `frontend` / `mysql`) — tail a service's logs live
- `docker compose ps` — see what's running

## Architecture

- **`frontend/`** — Vite/React SPA. In production it's built and served by nginx (`frontend/Dockerfile`, `frontend/nginx.conf`), which also reverse-proxies `/api/*` to the backend so the browser only ever talks to one origin (no CORS needed).
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point; routes are added directly there for now. Sound files and theme background images live in `backend/uploads/` (bind-mounted into the container, so replacing a file doesn't require a rebuild) and are served via `@fastify/static`.
- **`mysql`** — MySQL 8, data persisted in the `mysql_data` Docker volume.

Ports: frontend `8080` (nginx), backend `3000` (Fastify, also reachable directly), MySQL `3307` on the host (mapped to avoid clashing with the port a native MySQL install might already be using — internally, containers reach it at `mysql:3306`).

## Working on the backend/database

Schema changes go through Prisma, not manual SQL:

```
cd backend
npx prisma migrate dev --name describe_your_change
```

This updates `prisma/schema.prisma`'s matching migration history, and applies it to your local database. Commit the generated files under `prisma/migrations/` along with your `schema.prisma` change.

If you need to seed new default data, extend `prisma/seed.js` (keep upserts idempotent — it's safe to run repeatedly and also runs automatically on every container start).

## Working on the frontend with fast reload

For hot-reload iteration instead of rebuilding the Docker image on every change:

```
cd frontend
npm install
npm run dev
```

This runs Vite's dev server on `http://localhost:5173`, which proxies `/api/*` to the backend (see `vite.config.js`) the same way nginx does in the containerized setup — so the app code doesn't need to know or care which mode it's running in. The `mysql` and `backend` containers still need to be running (`make up`, or just `docker compose up -d mysql backend`) for this to have something to talk to.
