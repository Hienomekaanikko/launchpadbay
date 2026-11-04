// Wraps server response errors into a custom Error object, attaching code,
// params and status for easy i18n translation.
// example of error object returned:
// code: "password_too_short" ------- params: { min: 8 } ------- status: 400
function apiError(data, status) {
  const error = new Error(data.error ?? 'api_error')
  error.code = data.error
  error.params = data.params
  error.status = status
  return error
}

// App.jsx listens for this and logs out: the server refused our token (expired, from
// before a password change, or the account is gone), so no request with it can work
export const SESSION_EXPIRED_EVENT = 'session-expired'

// for requests made while logged in: a 401 there means the session is over
function failedWithToken(data, status) {
  if (status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  return apiError(data, status)
}

// when the token stops working (ms since epoch), read from its own 'exp' field;
// Infinity if it has none or can't be read
export function tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Infinity
  } catch {
    return Infinity
  }
}

// Auth requests against the backend, proxied at /api/ (nginx in prod, Vite's
// dev server proxy locally) — same pattern as launchpad/themes.js.
async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(data, res.status)
  return data
}

export function register(username, email, password) {
  return post('/register', { username, email, password })
}

export function login(email, password) {
  return post('/login', { email, password })
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
  if (!res.ok) throw failedWithToken(data, res.status)
  return data
}

export function fetchProfile(token) {
  return requestWithToken('GET', '/profile', token)
}

// another user's public profile: { id, username, avatar, createdAt }
export function fetchUser(token, id) {
  return requestWithToken('GET', `/users/${encodeURIComponent(id)}`, token)
}

// changes: any of { username, email, newPassword }, saved together or not at all;
// email and password changes also need currentPassword (password accounts)
export function updateProfile(token, changes) {
  return requestWithToken('PATCH', '/profile', token, changes)
}

// confirm: { password } or, for GitHub-only accounts, { username }
export function deleteAccount(token, confirm) {
  return requestWithToken('DELETE', '/profile', token, confirm)
}

// multipart upload; the browser sets the Content-Type (with boundary) from the FormData
async function postForm(path, token, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw failedWithToken(data, res.status)
  return data
}

export function uploadAvatar(token, file) {
  const body = new FormData()
  body.append('avatar', file)
  return postForm('/profile/avatar', token, body)
}

// in a session: replace one pad's sample for every player; returns { pad, url }
export function uploadPadSample(token, pad, file) {
  const body = new FormData()
  body.append('pad', String(pad)) // before the file: the backend reads it off the file part
  body.append('file', file)
  return postForm('/session/pad-sample', token, body)
}

// { friends: [{ id, username }], incoming: [...], outgoing: [...] }
export function fetchFriends(token) {
  return requestWithToken('GET', '/friends', token)
}

export function sendFriendRequest(token, id) {
  return requestWithToken('POST', '/friends/requests', token, { id })
}

export function acceptFriendRequest(token, id) {
  return requestWithToken('POST', `/friends/requests/${encodeURIComponent(id)}/accept`, token)
}

export function rejectFriendRequest(token, id) {
  return requestWithToken('DELETE', `/friends/requests/${encodeURIComponent(id)}`, token)
}

export function removeFriend(token, id) {
  return requestWithToken('DELETE', `/friends/${encodeURIComponent(id)}`, token)
}
