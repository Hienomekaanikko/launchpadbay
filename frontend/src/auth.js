// Auth requests against the backend, proxied at /api/ (nginx in prod, Vite's
// dev server proxy locally) — same pattern as launchpad/themes.js.
async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export function register(username, email, password) {
  return post('/register', { username, email, password })
}

export function login(username, password) {
  return post('/login', { username, password })
}
async function getWithToken(path, token) {
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export function fetchProfile(token) {
  return getWithToken('/profile', token)
}

// snapshot of all registered users: [{ username, online }]
export function fetchOnline(token) {
  return getWithToken('/online', token)
}
