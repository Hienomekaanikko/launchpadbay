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
async function requestWithToken(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export function fetchProfile(token) {
  return requestWithToken('GET', '/profile', token)
}

export async function uploadAvatar(token, file) {
  const body = new FormData()
  body.append('avatar', file)

  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`)
  return data
}

// { friends: [username], incoming: [username], outgoing: [username] }
export function fetchFriends(token) {
  return requestWithToken('GET', '/friends', token)
}

export function sendFriendRequest(token, username) {
  return requestWithToken('POST', '/friends/requests', token, { username })
}

export function acceptFriendRequest(token, username) {
  return requestWithToken('POST', `/friends/requests/${encodeURIComponent(username)}/accept`, token)
}

export function rejectFriendRequest(token, username) {
  return requestWithToken('DELETE', `/friends/requests/${encodeURIComponent(username)}`, token)
}

export function removeFriend(token, username) {
  return requestWithToken('DELETE', `/friends/${encodeURIComponent(username)}`, token)
}
