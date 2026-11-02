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

// Mistakes a user can make in the UI (wrong password, taken name, ...) come back as
// 200 with { error } so the browser console stays clean (see backend/server.js), so a
// response is a failure when it isn't ok OR carries an error code. Their real status
// is in the X-Error-Status header
function isFailure(res, data) {
  return !res.ok || data.error !== undefined
}

function failureStatus(res) {
  return Number(res.headers.get('x-error-status')) || res.status
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
  if (isFailure(res, data)) throw apiError(data, failureStatus(res))
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
  if (isFailure(res, data)) throw apiError(data, failureStatus(res))
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

export async function uploadAvatar(token, file) {
  const body = new FormData()
  body.append('avatar', file)

  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (isFailure(res, data)) throw apiError(data, failureStatus(res))
  return data
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
