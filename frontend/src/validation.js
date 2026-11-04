// Browser-side copy of the rules in backend/validation.js, so obviously invalid input is
// caught before it's sent (no request, no error line in the console). The backend still
// checks everything and has the final say; keep the two in sync.
// Each check returns null when the value is fine, otherwise the same { code, params } the
// server would answer with, so translateServerError() shows the usual message.

export const USERNAME_PATTERN = /^[\p{L}\p{Nd}_-]+$/u
export const USERNAME_MIN_LENGTH = 4
export const USERNAME_MAX_LENGTH = 15

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
export const EMAIL_MAX_LENGTH = 255

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72 // bcrypt ignores bytes after 72

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024 // backend/profile.js multipart limit

// backend: PASSWORD_REQUIRE_LETTER and _DIGIT are on, _SPECIAL is off
const CONTROL_CHARS = /\p{Cc}/u
const HAS_LETTER = /\p{L}/u
const HAS_DIGIT = /\p{Nd}/u

export function checkUsername(value) {
  const username = value.trim().normalize('NFC')
  if (username.length < USERNAME_MIN_LENGTH
      || username.length > USERNAME_MAX_LENGTH
      || CONTROL_CHARS.test(username)
      || !USERNAME_PATTERN.test(username)) {
    return { code: 'invalid_username', params: { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH } }
  }
  return null
}

export function checkEmail(value) {
  const email = value.trim().normalize('NFC')
  if (!email
      || email.length > EMAIL_MAX_LENGTH
      || CONTROL_CHARS.test(email)
      || !EMAIL_PATTERN.test(email)) {
    return { code: 'invalid_email' }
  }
  return null
}

export function checkNewPassword(value) {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { code: 'password_too_short', params: { min: PASSWORD_MIN_LENGTH } }
  }
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) {
    return { code: 'password_too_long', params: { max: PASSWORD_MAX_BYTES } }
  }
  if (!HAS_LETTER.test(value)) {
    return { code: 'password_require_letter' }
  }
  if (!HAS_DIGIT.test(value)) {
    return { code: 'password_require_digit' }
  }
  return null
}

export function checkAvatar(file) {
  if (!AVATAR_TYPES.includes(file.type)) {
    return { code: 'invalid_avatar_type' }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { code: 'file_too_large' }
  }
  return null
}
