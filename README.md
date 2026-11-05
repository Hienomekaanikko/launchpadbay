*This project has been created as part of the 42 curriculum by mbonsdor, ykadosh, msuokas, timurray*

# Launchpad Bay

Browser based music sampler: load a themed grid of 25 sound pads and jam alone or in a shared session. React frontend, Fastify + Prisma backend, and MySQL, all containerised with Docker Compose.

## Description

Launchpad Bay's goal is a low-friction, browser-based sampler — no install, no account required to try it, just open it and start triggering sounds on a themed 5x5 pad grid.

Key features:

- A themed 25-pad launchpad grid across five channels, with per-channel volume, low-pass filters, queued clip transitions, split timing, and stutter effects, driven by `frontend/src/launchpad/engine.js`.
- Themes (background image + body styling + per-pad sounds) are served from the backend/database rather than bundled into the frontend build, so new themes/sounds can be added without a frontend rebuild.
- User accounts with registration, email/password login, profile editing, avatars, friendships, and a GitHub OAuth flow.
- Live presence, private/session chat, and two-user collaborative launchpad sessions with join requests and shared performance controls.
- One-command containerised setup (`make up`) covering the frontend, backend, MySQL, Prometheus, Grafana, Alertmanager, and Blackbox Exporter, with automatic migrations and seed data.

The [Features](#features) section describes the current implementation. Outstanding work and verification are tracked in the [Checklist](#checklist).

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
- **Languages:** `i18next` and `react-i18next` centralise English, Finnish, Hebrew, and Mandarin translations and support switching the document language and direction. Translation coverage, language switching, and the Hebrew RTL layout have been verified locally.
- **Containerisation:** Docker Compose runs the application, MySQL, and the monitoring services: Prometheus, Grafana, Alertmanager, and Blackbox Exporter. A `Makefile` wraps startup, certificate generation, and shutdown.
- **Monitoring:** Prometheus collects backend process and HTTP request metrics and Blackbox Exporter's HTTPS database health probes. A provisioned Grafana dashboard displays metrics and health status, and Grafana lists the Prometheus-managed alert rules. Alertmanager sends failure and recovery notifications to Discord using an environment-backed Compose secret.

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
├── token_version  INT          default 0 (incremented on password change)
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
| Registration and password login | Register with a username, email, and password; log in with email and password. Bcrypt protects passwords, JWTs authenticate requests, and the frontend stores the session in `localStorage`. Full input validation remains an open checklist item. | `msuokas` |
| GitHub OAuth | Authorisation redirect, state-cookie validation, code exchange, local account lookup/creation, and application JWT delivery are implemented. Successful GitHub login has been confirmed locally. | `mbonsdor` |
| Profiles and avatars | View account information, edit email, change a password where applicable, upload an avatar or use the default image, and delete an account with confirmation. | `msuokas`, `mbonsdor`, `ykadosh` |
| Friends | Send, accept, reject, and remove friend requests/connections; list friends and their online status. | `msuokas`; presence and realtime support by `ykadosh` |
| Live lobby | Display connected users and active sessions, with presence updates and session join requests. | `ykadosh`, `msuokas` |
| Collaborative sessions | Host a two-user session, request/cancel a join, accept/reject a guest, leave a session, and share pad, split, and stutter actions. A joining partner requests a launchpad state snapshot. | `ykadosh`, `msuokas`; underlying audio engine by `mbonsdor` |
| Chat | Exchange private and session messages with unread indicators and delivery-error feedback. Private messages are stored in MySQL; the frontend does not restore their history after a reload. | `ykadosh`, `msuokas` |
| Languages and RTL | Switch between English, Finnish, Hebrew, and Mandarin, with stored language selection and translated UI text, placeholders, and errors. Language support, the Hebrew RTL layout, and switching between LTR and RTL have been verified locally. | `mbonsdor` |
| Shared UI and responsive layouts | Reusable Tailwind components and theme tokens, plus a navbar and layouts for desktop and smaller screens. The team has tested the main flows in Chrome, Brave, and Safari, and confirmed usable desktop, tablet, and phone layouts, readable text, reachable controls, keyboard navigation, and visible focus indicators. | `msuokas`, `timurray` |
| Policy pages | Open project-specific Privacy Policy and Terms of Service content from the footer in all four languages. The documents cover the local student demonstration, data handling, account deletion, acceptable use, and example operator/contact details. | `timurray` |
| Containerised deployment | Start application and monitoring services with `make up`, generate TLS certificates, apply migrations, and seed data. | `msuokas`, `timurray` |
| Monitoring | Export process and HTTP metrics, probe HTTPS/database health with Blackbox Exporter, and display metrics and health status in a provisioned Grafana dashboard. Prometheus evaluates alerts; Alertmanager delivers failure and recovery notifications to Discord. | `timurray` |

## Checklist

### Mandatory

#### General requirements

- [x] The project is a web application with a frontend, backend, and database.
- [x] Git history contains commits from all four team members, meaningful commit messages, and contributions across different parts of the project.
- [x] Containerised deployment is available through one command: `make up` starts the frontend, backend, MySQL, Prometheus, Grafana, Alertmanager, and Blackbox Exporter.
- [x] The website is compatible with the latest stable version of Google Chrome.
- [x] Normal user flows produce no unexpected application warnings or uncaught errors in the browser console.

The team has confirmed full user flows in Chrome (latest stable), Brave, and Safari, with a clean application console during normal use. Intentional authentication failures, such as a wrong password or an unknown email address, return HTTP 401 with `invalid_credentials` and display a translated validation message. DevTools can show these rejected requests as errors; they are expected, handled authentication responses.

- [x] Privacy Policy and Terms of Service are accessible from footer controls and contain project-specific information rather than empty placeholder pages.
- [x] Multiple users can be logged in and active at the same time.
- [x] Real-time updates are reflected across connected users where applicable.
- [x] Concurrent actions by different users have been verified to work without conflicts or performance issues.
- [x] Simultaneous user actions have been verified not to cause data corruption or race conditions.

#### Technical requirements

- [x] The frontend is clear, responsive, and accessible across different devices.

- [x] A CSS framework or styling solution is used: Tailwind CSS with shared theme tokens and custom CSS.
- [x] Credentials are read from local, Git-ignored `.env` files, and `.env.example` is provided. The Compose database URL now interpolates environment variables instead of containing a literal password.
- [x] The database has a clear schema and well-defined relations: users, friendships, messages, themes, and theme sounds are defined in Prisma with migrations.
- [x] Passwords are hashed and salted with bcrypt, and protected routes verify JWTs.
- [x] Email and password authentication is available for both signup and login.
- [x] All forms and user inputs are properly validated in both the frontend and backend.

Remaining validation work: validate session-action fields and synchronisation payloads, safely reject malformed session accept/reject requests, and validate uploaded images beyond their file signatures. Credential validation, frontend profile checks, and sanitised server errors are already implemented.

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

- [x] Modules lists the achieved modules, requirements, implementation evidence, justifications, and point calculation in this checklist.
- [x] Each selected module has its contributing team member(s) clearly identified.
- [ ] Individual Contributions gives every member's specific work and the challenges they faced and overcame.


### Modules

`[x]` marks completed, `[ ]` missing or incomplete, and `[-]` not applicable. Only achieved modules are included in the point tally: 2 points per Major module and 1 point per Minor module.

<a id="modules-web"></a>

#### Web — 9 points; implemented

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

Implementation: private/session chat, the signed-in user's profile, other users' public profiles integrated into the chat window (username, avatar, and membership date), and friend requests, acceptance, rejection, removal, and listing. The team has confirmed the friends flows work.

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

<a id="modules-accessibility-and-internationalization"></a>

#### Accessibility and Internationalization — 3 points; implemented and locally tested

##### Minor: Support for multiple languages (at least 3 languages). — 1/1 point; implemented and locally tested

Responsible teammates: mbonsdor

- [x] Implement i18n (internationalization) system.
- [x] At least 3 complete language translations.
- [x] Language switcher in the UI.
- [x] All user-facing text must be translatable.

Implementation: i18next resources for English, Finnish, Hebrew, and Mandarin, a language switcher, and stored language selection. All four locale files have matching, populated entries with matching interpolation placeholders. Login and registration placeholders use translated labels, and server errors are translated when rendered. Resource resolution without English fallback, error translations, stored-language initialisation, and document language/direction updates have been verified locally.

##### Minor: Right-to-left (RTL) language support. — 1/1 point; implemented and locally tested

Responsible teammates: mbonsdor

- [x] Support for at least one RTL language (Arabic, Hebrew, etc.).
- [x] Complete layout mirroring (not just text direction).
- [x] RTL-specific UI adjustments where needed.
- [x] Seamless switching between LTR and RTL.

Implementation: Hebrew changes the document language and direction immediately, and layout positioning uses logical CSS properties. The team has confirmed the Hebrew RTL layout and seamless switching between LTR and RTL. The LaunchPad retains its standardised musical-device layout across languages.

##### Minor: Support for additional browsers. — 1/1 point; implemented and tested by the team

Responsible teammates: team-wide verification; timurray develops in Brave, and teammates develop in Chrome and Safari.

- [x] Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge, etc.).
- [x] Test and fix all features in each browser.
- [x] Document any browser-specific limitations.
- [x] Consistent UI/UX across all supported browsers.

Selected browsers: Google Chrome is the mandatory baseline; Brave and Safari are the two additional browsers. The team has developed and tested the full user flows across these browsers, including login/profile/avatar changes, friends/chat, shared sessions, and launchpad audio controls. No browser-specific functional quirks have been reported.

| Browser | Role | Team verification |
|---|---|---|
| Google Chrome | Mandatory baseline | The team confirms testing with the latest stable version, including normal-use console checks; no specific functional quirks reported. |
| Brave | Additional browser | Used by timurray for development and full-flow testing; no specific functional quirks reported. |
| Safari | Additional browser | Used by teammates for development and full-flow testing; no specific functional quirks reported. |

Primary use cases are desktop and tablet browsers. Additional phone testing in Safari and Brave shows that visible browser controls, such as the address and navigation bars, can reduce the space available to the application. This viewport constraint is recorded as an observed limitation; check that controls and dialogs remain reachable as browser controls expand or collapse and in portrait and landscape orientations. Responsive usability on smaller screens remains part of the mandatory requirements.

The latest-stable Chrome and normal use console checks are confirmed.

<a id="modules-user-management"></a>

#### User Management — 3 points; implemented and locally tested

##### Major: Standard user management and authentication. — 2/2 points; implemented

Responsible teammates: msuokas, mbonsdor, ykadosh

- [x] Users can update their profile information.
- [x] Users can upload an avatar (with a default avatar if none provided).
- [x] Users can add other users as friends and see their online status.
- [x] Users have a profile page displaying their information.

Implementation: profile/email editing, password changes for password accounts, uploaded/default avatars, friends with online status, and the profile panel.

##### Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). — 1/1 point; implemented and locally tested

Responsible teammates: mbonsdor

- [x] Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.).

Implementation: GitHub authorisation redirect, state-cookie validation, authorisation-code exchange, local account creation/lookup, and the same application JWT flow used by password login. Successful GitHub login has been confirmed locally. See `backend/authGithub.js` and the login/callback frontend integration.

<a id="modules-devops"></a>

#### DevOps — 2 points; implemented and locally tested

##### Major: Monitoring system with Prometheus and Grafana. — 2/2 points; implemented and locally tested

Responsible teammates: timurray

- [x] Set up Prometheus to collect metrics.
- [x] Configure exporters and integrations.
- [x] Create custom Grafana dashboards.
- [x] Set up alerting rules.
- [x] Secure access to Grafana.

Implementation: Prometheus collects backend process and HTTP metrics over HTTPS. Blackbox Exporter probes the HTTPS database health endpoint. Prometheus evaluates backend availability and health-check alerts; Grafana displays the metrics and alert states. Alertmanager sends failure and recovery notifications to Discord, using a webhook supplied through a Compose secret. Backend and database outage/recovery tests have been verified locally. Grafana uses administrator authentication, disabled signup, and a localhost-only host port.

<a id="modules-of-choice"></a>

#### Modules of choice — 2 points; implemented and locally tested

##### Major: Implement a custom module that is not listed above. — 2/2 points; implemented and locally tested

Responsible teammates: mbonsdor, msuokas

- [x] The module must be substantial and demonstrate technical complexity.
- [x] You must provide proper justification in your README.md explaining:
  - [x] Why you chose this module.
  - [x] What technical challenges it addresses.
  - [x] How it adds value to your project.
  - [x] Why it deserves Major module status (2 points).
- [x] Taking shortcuts or implementing trivial features will result in rejection.
- [x] Be creative and think outside the box.
- [x] The module should be relevant to your project context.

**Custom module: Web Audio sampler and performance engine.**

**Why it was chosen:** LaunchpadBay is a playable browser-based music instrument. Its central feature needs a sampler and performance controls that support musical timing rather than independent, immediate sound triggers.

**Technical challenges:** The engine schedules looping sources against the AudioContext clock, calculates loop and subdivision boundaries, tracks channel states (`idle`, `armed`, `playing`, and `queued`), switches or cancels queued clips, changes split timing, and starts/releases stutter divisions. It also manages decoding/caching, per-channel gain and low-pass filtering, parameter smoothing, and playback cleanup.

**Value to the project:** Users can combine the 25 pads across five channels, make timed clip transitions, and perform split/stutter effects while controlling each channel's mix in the browser.

**Why it merits Major status:** This is a multi-part playback and timing system implemented across `engine.js`, `audio.js`, `clock.js`, `channel.js`, `split.js`, and `stutter.js`, with distinct state, scheduling, signal-processing, and resource-lifecycle responsibilities. It works locally without a partner; network action delivery and shared workspace synchronisation remain the scope of the separate collaboration module. The scope goes beyond simply attaching a sound to each button.

See [launchpad notes](frontend/src/launchpad/launchpad_notes.md) for architecture and timing details.

#### Module point totals

| Subject category | Achieved points |
|---|---:|
| [Web](#modules-web) | 9 |
| [Accessibility and Internationalization](#modules-accessibility-and-internationalization) | 3 |
| [User Management](#modules-user-management) | 3 |
| [DevOps](#modules-devops) | 2 |
| [Modules of choice](#modules-of-choice) | 2 |
| **Total** | **19** |

The 13 achieved modules comprise 6 Major modules (12 points) and 7 Minor modules (7 points).

## Individual Contributions

These summaries follow the authored changes in the repository and the role assignments in [Team Information](#team-information). Shared features have contributions from more than one teammate.

### msuokas: Product Owner / Developer

- **Implemented:** Project bootstrap and initial landing/launchpad UI; initial sample-engine integration; Docker/MySQL/Prisma setup; user and friendship schema changes; bcrypt/JWT authentication; the Tailwind component system; friendship management and profile editing; and frontend integration for presence, chat, session joining, and shared launchpad actions.
- **Key areas:** `backend/server.js`, `backend/friends.js`, `backend/profile.js`, Prisma migrations, `frontend/src/App.jsx`, shared components/hooks, and the original container setup.
- **Challenge and solution:**  Keeping two players' launchpads in sync, especially after a page refresh. Browsers block audio until the user clicks, so a refreshed player's loop clock is stopped; applying the partner's actions at that point would start their loops out of phase. All shared actions go through the server, which echoes them to both players so they're applied in the same order. A refreshed player waits until their samples are loaded and the AudioContext is running (tracked with useSyncExternalStore), then requests a snapshot of the partner's state (SYNC_REQUEST / SYNC_STATE) and starts on the partner's next loop boundary.

### mbonsdor: Technical Lead / Developer

- **Implemented:** Audio engine refactoring into playback, timing, channel-state, effects, and UI modules; GitHub OAuth and related user-schema changes; default/uploaded/GitHub avatars; English, Finnish, Hebrew, and Mandarin language resources and switching; Hebrew RTL adjustments; and application title/favicon updates.
- **Key areas:** `frontend/src/launchpad/`, `backend/authGithub.js`, `backend/avatars.js`, avatar/profile components, `frontend/src/i18n/`, and the language switcher.
- **Challenge and solution:** my challenge could be something like this: My biggest challenge was figuring out the underlying logic of the prototype while learning a new language. The approach involved incrementally refactoring it with heavy use of LLMs, while trying not to break anything. In the future, I’d consider doing a full analysis first and then rebuilding it from the ground up.

### ykadosh: Technical Lead / Developer

- **Implemented:**
  - **Real-time backend:** JWT-authenticated WebSockets, presence updates, session lifecycle and join requests, refresh and reconnect handling (working closely on these with `msuokas`)
  - **Chat:** Private and session messaging, message delivery feedback, and persistent private messages (for eventual integration).
  - **Shared sessions:** Ordered processing of incoming WebSocket messages and launchpad state synchronisation for joining players.
  - **Account and profile improvements:** Robust backend input validation, live friendship and avatar updates, and profile editing safeguards.
  - **Supporting work:** Graceful server shutdown, user facing messages and feedback, language translations
- **Key areas:** `backend/ws.js`, `backend/sessions.js`, `backend/chat.js`, WebSocket handling in `backend/server.js`, message migrations, and socket/session hooks.
- **Challenges and solutions:**
  - **Learning full-stack web development:** This was my first web-development project, and I had to learn the stack while contributing to it. Tracing a feature across the React frontend, backend, WebSockets, infrastructure, and database was a steep learning curve after working mainly in C and C++. I made progress by studying teammates’ pull requests carefully, using documentation and tutorials, and asking questions in our open team discussions. Regular review helped me build a clearer picture of how the pieces fit together.
  - **Reasoning about concurrent events:** With multiple clients communicating through WebSockets, it could be difficult to understand how events and state changes interacted. I worked through these cases with `msuokas`, drawing on experience from multithreaded projects and slowing down the interaction flow to reason through it step by step. The project strengthened my understanding of race conditions, and it also showed me how much more there is to learn about distributed systems.
  - **Managing context switching:** The work often shifted between backend implementation, frontend code review, Git workflow, writing clear pull requests, and coordinating with the team. With practice, these transitions became easier to manage. I developed a better rhythm for communicating progress, keeping changes reviewable, and learning from teammates across different parts of the stack.

### timurray: Project Manager / Developer

- **Implemented:** HTTPS certificates and proxy configuration; environment-file setup and credential/port hardening; backend metrics, Prometheus/Grafana provisioning and dashboards, Blackbox Exporter health probes, and Alertmanager failure/recovery notifications to Discord; the CI workflow for frontend lint/build and backend dependency installation; responsive layouts and the navbar; and Privacy Policy/Terms of Service pages.
- **Key areas:** `Makefile`, `docker-compose.yml`, `backend/metrics.js`, `monitoring/`, `.github/workflows/basic.yml`, nginx/Vite configuration, `AppNavbar.jsx`, responsive styles, and policy components/content.
- **Challenge and solution:** HTTPS needed consistent trust and hostnames across the browser, nginx, backend, and monitoring scraper. Generated certificates, mounted CA files, and proxy/scraper configuration connect these components. Responsive layout work accommodates the pad grid, controls, navbar, and overlays on smaller screens. Many difficulties as well with typos and understanding tailwind that required much checking and assistance.

## Instructions

### Prerequisites

- Docker with Docker Compose v2 or later, running before setup (Docker Desktop on macOS, or Docker Engine with the Compose plugin on Linux).
- A macOS or Linux shell with `make` and `curl`. On Windows, run the Makefile from a Linux environment such as WSL with Docker integration enabled.
- Internet access for the initial image/dependency downloads, mkcert, GitHub OAuth, and Discord alert notifications.
- A GitHub OAuth App's client ID and secret for the configured login flow; setup is described below.
- A Discord channel webhook URL for monitoring notifications. Create one through Discord's Server Settings → Integrations → Webhooks and select the destination channel.
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
| `DISCORD_WEBHOOK_URL` | Discord channel webhook URL for alert notifications. Compose exposes this value to Alertmanager as `/run/secrets/discord_webhook_url`. Keep the real URL in the ignored environment files; `.env.example` contains an empty placeholder. |

The backend requires the GitHub OAuth variables at startup, including when you intend to use password login. Example placeholders are not working OAuth credentials.

An alternative is to create and configure a project-local `.env` directly:

```bash
cp .env.example .env
chmod 600 .env
```

`make` preserves an existing project `.env`. If it is absent, `make` copies `$HOME/.env.launchpadbay` to `.env` with owner-only permissions. Later edits to the home-directory file are not automatically copied over an existing `.env`; update the project file as well when changing configuration, or run `make -B .env` to replace it with the home-directory copy. Environment files are ignored by Git.

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
| `make down` | Stop and remove containers, preserving the MySQL, Prometheus, Grafana, and Alertmanager volumes and uploaded avatar files |
| `make re` | `down` then `up` |
| `make fclean` | Stop/remove containers, delete the MySQL/Prometheus/Grafana/Alertmanager volumes and service images, remove `certs/`, and delete uploaded avatar files in `backend/uploads/images/avatars/` |

- `docker compose logs -f backend` (or `frontend`, `mysql`, `prometheus`, `grafana`, `alertmanager`, `blackbox`) — tail logs
- `docker compose ps` — see what's running

### Architecture

- **`frontend/`** — Vite/React SPA. Built and served by nginx in production (`frontend/Dockerfile`, `frontend/nginx.conf`), which also proxies `/api/*` to the backend — one origin, no CORS.
- **`backend/`** — Fastify + Prisma. `server.js` is the entry point; authentication, profiles, friendships, chat, and sessions are split into feature-specific files. Sound/theme files live in the bind-mounted `backend/uploads/` directory and are served through `@fastify/static`. Real-time events use `@fastify/websocket`.
- **`mysql`** — MySQL 8, data in the `mysql_data` volume.
- **`prometheus`** — Scrapes backend metrics over HTTPS using `certs/ca.pem`, collects Blackbox probe results, and evaluates alert rules. Stores metric history in `prometheus_data`.
- **`grafana`** — Queries Prometheus and loads its connection and dashboard from `monitoring/grafana/`. Stores accounts and local settings in `grafana_data`.
- **`blackbox`** — Probes `https://backend:3000/health/db` when requested by Prometheus, verifying the backend certificate and requiring HTTP 200. That endpoint runs a database query. The exporter listens on port `9115` inside the Compose network.
- **`alertmanager`** — Receives alerts from Prometheus and groups/routes failure and recovery notifications to Discord. Reads the webhook from the `discord_webhook_url` Compose secret and stores notification state and silences in `alertmanager_data`.

Ports: frontend HTTPS `8443`, MySQL `3307`, Grafana `3001`, Prometheus `9090`, and Alertmanager `9093` on host (avoids clashing with a native MySQL install; containers reach it at `mysql:3306`).
Grafana, Prometheus, and Alertmanager are bound to `127.0.0.1`. Blackbox Exporter has no published host port.

### Monitoring

Set `DISCORD_WEBHOOK_URL` in the environment configuration, then start monitoring with the application using `make up`. The webhook value is passed through a Compose secret; the Alertmanager configuration contains the secret's file path.

| Interface | URL |
|---|---|
| Grafana | http://localhost:3001 |
| Prometheus queries | http://localhost:9090/query |
| Prometheus targets | http://localhost:9090/targets |
| Prometheus alert rules | http://localhost:9090/alerts |
| Alertmanager | http://localhost:9093 |

The backend exposes Node.js process metrics and HTTP request counters/histograms through `/metrics`. Prometheus scrapes those metrics and requests a Blackbox HTTP probe every 15 seconds. Blackbox uses the `http_backend` module to check the HTTPS `/health/db` endpoint with a five-second timeout, the project's trusted CA, and an expected HTTP 200 response.

Useful Prometheus queries:

| Query | Meaning |
|---|---|
| `up{job="backend"}` | Whether Prometheus can scrape backend metrics: `1` means successful, `0` means failed. |
| `up{job="backend_health"}` | Whether Prometheus successfully receives a probe response from Blackbox Exporter. |
| `probe_success{job="backend_health"}` | Whether the actual HTTPS/database health check succeeds: `1` means successful, `0` means failed. |

A successful scrape of the exporter and a successful probe are separate results. For example, during a database outage, backend metrics and the exporter can remain reachable while `probe_success` becomes `0`.

Alert rules live in `monitoring/prometheus/alerts.yml` and are evaluated every 15 seconds:

| Alert | Condition | Pending period |
|---|---|---|
| `BackendMetricsUnavailable` | `up{job="backend"} == 0` | 15 seconds |
| `BackendHealthCheckFailed` | `probe_success{job="backend_health"} == 0` | 15 seconds |

Grafana displays these as read-only, data source-managed rules under Alerting → Alert rules. Prometheus forwards firing alerts to Alertmanager. The Discord receiver waits 10 seconds before its first notification, processes grouped updates every 30 seconds, repeats unresolved notifications hourly, and sends recovery notifications. These timings are in `monitoring/alertmanager/alertmanager.yml`; notification delivery also includes scrape and rule-evaluation delays.

Validate configuration without sending a notification:

```bash
docker compose config --quiet
docker compose run --rm --no-deps --entrypoint promtool prometheus check config /etc/prometheus/prometheus.yml
docker compose run --rm --no-deps --entrypoint amtool alertmanager check-config /etc/alertmanager/alertmanager.yml
```

After changing Prometheus configuration or rules, reload the running process with:

```bash
docker compose kill -s SIGHUP prometheus
```

`SIGHUP` reloads the configuration while Prometheus keeps running. Use the same signal with `alertmanager` after changing its routing configuration.

Failure and recovery checks have been verified locally. To repeat them, keep Prometheus, Blackbox Exporter, and Alertmanager running, test one outage at a time, and restore each service after the test:

| Test | Stop command | Expected result | Restore command |
|---|---|---|---|
| Backend outage | `docker compose stop backend` | Backend metrics become unreachable and the health probe fails; both alert rules fire. | `docker compose start backend` |
| Database outage | `docker compose stop mysql` | Backend metrics and the exporter remain reachable, but the health probe fails; only `BackendHealthCheckFailed` fires. | `docker compose start mysql` |

For each test, confirm pending → firing in Prometheus/Grafana and a failure message in Discord. After restoration, wait for MySQL/backend readiness and successful probes, then confirm the rules return to inactive and a recovery message arrives in Discord. `docker compose ps` shows container state and MySQL health. If Prometheus is restarted during a firing alert, Alertmanager can retain the previous alert until its last advertised expiry rather than receiving an immediate recovery update.

The provisioned dashboard includes backend availability, memory, CPU, request rate, response-time and error panels, plus an Instant Stat panel for `probe_success{job="backend_health"}`. The health panel maps `1` to green “Nominal” and `0` to red “Helsinki, we have a problem”.

To keep Grafana dashboard edits in Git, save the dashboard and choose Export → Export as code. Select V2 Resource and JSON, with instance sharing disabled. Save it as `monitoring/grafana/dashboards/launchpadbay.json`, replacing the existing file, and commit it. Saving in Grafana alone updates the local Grafana database; the exported file makes the changes reproducible after a fresh installation. Personal home-dashboard preferences are stored separately in `grafana_data` and are not included in the dashboard export.

### Auth

- `users` table: `id` (uuid), `username` (case-insensitively unique), `email`/`github_id` (unique, nullable), `password_hash` (bcrypt, nullable for GitHub-only accounts), `avatar` (nullable), `token_version` (int, default 0), `created_at`.
- `POST /register` — hashes password, creates user, 409 on duplicate username/email.
- `POST /login` — bcrypt-compares password, returns a JWT on success. Wrong password and unknown email both return the same generic 401 (no username enumeration).
- Tokens carry `{ id, tv }` and expire after 1 day. A password change increments `token_version`, so older tokens (`tv` mismatch) get 401 / WebSocket close 4001.
- WebSocket auth — the token is sent in the first message (`{ type: 'auth', token, tabId }`), not the URL, so it stays out of nginx logs. No auth within 5 s → close 4000.
- `JWT_SECRET` in `.env` signs/verifies tokens.

#### Credential rules

---

##### 1. Native Launchpad Bay Accounts
The backend enforces these rules in `backend/validation.js`; update this section when these constants change.

- **Username**
    - Length: between 4 and 15 characters (after trimming and NFC normalisation)
    - Allowed characters: letters, digits, underscores and hyphens
    - Unique, using case-insensitive comparison. A user may change the capitalization of their own username, but no other account can take a username that differs only by case.
- **Email**
    - Length: at most 255 characters (after trimming and NFC normalisation)
    - One `@` and a `.` in the domain
    - No whitespace or control characters
    - Must be unique
- **Password**
    - At least 8 characters
    - At most 72 UTF-8 bytes (matching bcrypt's limit)
    - Complexity: At least one letter and one digit
- **Credential & Account Management**
    - **Modifications**: Profile view's editing page allows updating username, email address, and/or password.
    - **Security Verification**: Changing the email, password or deleting the account altogether requires the current password.

---

##### 2. GitHub Accounts (OAuth)

- **Username** 
    - Based on the GitHub username; may be suffixed to avoid a collision and may exceed the 15-character native limit. Profile renames must follow the 4–15 character rule.
- **Email**
    - Can be kept empty, or added and modified through Launchpad Bay's profile view
    - Length: at most 255 characters (after trimming and NFC normalisation)
    - One `@` and a `.` in the domain
    - No whitespace or control characters
    - Must be unique
- **Password**
    - No local password; sign-in is handled by GitHub OAuth
- **Account Management**
    - Profile editing page supports modification of username and email
    - Account deletion: possible from the same page, after providing username

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
- [EU guidance on fair contract terms (Your Europe)](https://europa.eu/youreurope/citizens/consumers/unfair-treatment/unfair-contract-terms/indexamp_en.htm).

**AI usage:** AI (Claude) was used as a learning and research tool throughout the project — to understand unfamiliar concepts (e.g. Prisma 7's driver-adapter requirement, Docker Compose healthcheck/`depends_on` semantics) and to explore current best practices before implementing them, rather than to generate unreviewed code wholesale. It was also used directly to diagnose and fix a real startup ordering bug between the backend and MySQL containers, and to help draft this README from the project's actual code and Git history. Codex was used to compare the implementation with the subject and evaluation sheet and assemble the requirements checklist. LLMs also helped draft and refine Finnish, Hebrew, and Mandarin translations, including the Privacy Policy and Terms of Service, and explain Tailwind utility classes and their effects on layout, spacing, alignment, and responsive styling.

---
