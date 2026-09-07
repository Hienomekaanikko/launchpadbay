# Feature Plan

## Done

### Web — full-stack frameworks (Major, 2pts)
React (frontend) + Fastify (backend).

### User Management — standard auth (Major, 2pts)
- [x] `users` table (`id`, `username`, `email`, `password_hash`, `created_at`)
- [x] `POST /register` — bcrypt hash, 409 on duplicate username/email
- [x] `POST /login` — bcrypt compare, returns a JWT
- [x] Wire `LoginView`/`RegisterView` (`frontend/src/App.jsx`) to actually call `/register`/`/login` and store the returned JWT — verified end-to-end in a browser: register, duplicate-username 409, password-mismatch, bad-login 401, successful login flips nav to "Logout," JWT persists in `localStorage` across reload, logout clears it.

### ORM (Minor, 1pt)
Prisma 7 with the `@prisma/adapter-mariadb` driver adapter. Done.

---

## Initial plan (target: 14+ points)

### Real-time features — WebSockets (Major, 2pts) — owner: `ykadosh`
Lobby presence + the ability to join/observe someone else's session, in real time.

- [ ] WebSocket connection from the frontend (e.g. `@fastify/websocket` on the backend)
- [ ] Broadcast presence: who's currently in the launchpad
- [ ] Graceful connect/disconnect handling (don't leave stale "online" users)
- [ ] Join/observe another user's live session
- [ ] Efficient message broadcasting (don't naively fan out to everyone on every event)

### User interaction (Major, 2pts) — owner: `ykadosh`
Subject requires all three of these to count as complete — chat alone isn't enough:

- [ ] Basic chat — send/receive messages between users
- [ ] Profile system — view another user's basic info
- [ ] Friends system — add/remove friends, see a friends list

This is the other half of the "lobby experience," built alongside the WebSocket work above rather than as a separate effort.

### Custom-made design system (Minor, 1pt) — owner: TBD
Mostly consolidation of UI that already exists (`App.css`, `launchpad.css`), not new visual design:

- [ ] Extract design tokens (colors, type scale) into named values (CSS custom properties) instead of hardcoded repeats
- [ ] Turn repeated markup into real reusable components (`<Button>`, `<Input>`, `<Modal>`, `<Knob>` — knob is already reused 3x for vol/filter/stutter, formalize it) instead of hand-copied JSX per view
- [ ] Reach the 10-component minimum (nav button, form button, close button, input box, pad button, knob, loading overlay, footer link, logo/tagline, transport controls, etc. — already close)
- [ ] Document the components somewhere demonstrable (a style-guide page, or a section in the README) — evaluators need to see it, not just infer it from the CSS

### Remote OAuth 2.0 login — e.g. GitHub (Minor, 1pt) — owner: TBD
Delegates identity to GitHub instead of checking a password; converges on the same JWT session afterward.

- [ ] Register an OAuth app with GitHub (client id/secret)
- [ ] Add `@fastify/oauth2` (or equivalent), a "Login with GitHub" button + redirect
- [ ] Callback route: exchange the authorization code for a GitHub access token, fetch the GitHub profile
- [ ] Add nullable `github_id` to `users` (and make `password_hash` nullable — a GitHub-only user won't have one); match or create the local user
- [ ] Issue the same app JWT as the password-login path, so downstream routes don't care which door the user came through

### Support for additional browsers (Minor, 1pt) — owner: TBD
QA pass, not new features:

- [ ] Full test pass in 2 additional browsers (e.g. Firefox, Safari)
- [ ] Fix any CSS/JS compatibility issues found
- [ ] Document any browser-specific limitations that remain
- [ ] Confirm consistent UI/UX across all supported browsers

### Multiple languages — i18n (Minor, 1pt) — owner: TBD
Frontend-only, no backend changes:

- [ ] Add an i18n library (e.g. `react-i18next`)
- [ ] All user-facing text routed through it (no hardcoded strings)
- [ ] At least 3 complete language translations
- [ ] Language switcher in the UI

### File upload & management (Minor, 1pt) — owner: TBD — buffer module
Scoped as an **admin-only "create a theme" page**, not a per-user upload system — reuses the existing `themes`/`theme_sounds` tables as-is, no ownership model needed:

- [ ] Admin-gated route/page (reuse existing JWT auth; doesn't need a full permissions system)
- [ ] Upload form: theme name, background image, sound files per pad slot
- [ ] Client-side validation (file type, size) before upload
- [ ] Server-side validation (re-check type/size/format — don't trust the client), e.g. via `@fastify/multipart`
- [ ] Preview before/after upload (image thumbnail, audio play button per slot)
- [ ] Upload progress indicator
- [ ] Delete a theme (or an individual sound) — removes both the DB row and the file on disk

---

## Notes

- Only fully working, demonstrable modules count at evaluation — "planned" here means not yet started, not partially working.
- Real-time + User interaction are grouped as one feature area (the lobby) since they share the same UI surface and were delegated together.
- Design system, OAuth, browser support, and i18n are independent and parallelizable — no dependency on the lobby work, good to split across whoever isn't on that.
