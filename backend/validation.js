// allows all letters, digits, underscores and hyphens (supporting unicode and multiple languages)
export const USERNAME_PATTERN = /^[\p{L}\p{Nd}_-]+$/u
export const USERNAME_MIN_LENGTH = 4
export const USERNAME_MAX_LENGTH = 30
// GitHub username may be more than USERNAME_MAX_LENGTH, so we need this too:
export const USERNAME_LOOKUP_MAX_LENGTH = 100

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
export const EMAIL_MAX_LENGTH = 255

export const PASSWORD_REQUIRE_LETTER = true
export const PASSWORD_REQUIRE_DIGIT = true
export const PASSWORD_REQUIRE_SPECIAL = false // flip values to enforce stricter / looser protocol
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72 // bcrypt ignores bytes after 72

const CONTROL_CHARS = /\p{Cc}/u
const HAS_LETTER = /\p{L}/u
const HAS_DIGIT = /\p{Nd}/u
const HAS_SPECIAL = /[^\p{L}\p{Nd}]/u

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// returns true when 'value' is a non-empty string whose length is within 'maxLength',
// and whose contents do not have a control character
export function isBoundedString(value, maxLength) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && !CONTROL_CHARS.test(value)
}

// removes leading and trailing whitespace from the typed username, and normalizes
// foreign letters (avoiding strings containing 'é' and 'e' to be considered different)
export function trimUsername(value) {
  return typeof value === 'string' ? value.trim().normalize('NFC') : null
}

export function isPasswordInput(value) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES
}

export function validateNewPassword(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH) {
    return { error: 'password_too_short', params: { min: PASSWORD_MIN_LENGTH } }
  }
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    return { error: 'password_too_long', params: { max: PASSWORD_MAX_BYTES } }
  }
  if (PASSWORD_REQUIRE_LETTER && !HAS_LETTER.test(value)) {
    return { error: 'password_require_letter' }
  }
  if (PASSWORD_REQUIRE_DIGIT && !HAS_DIGIT.test(value)) {
    return { error: 'password_require_digit' }
  }
  if (PASSWORD_REQUIRE_SPECIAL && !HAS_SPECIAL.test(value)) {
    return { error: 'password_require_special' }
  }
  return { value }
}

export function validateEmail(value) {
  const email = typeof value === 'string' ? value.trim().normalize('NFC') : ''
  if (!email
      || email.length > EMAIL_MAX_LENGTH
      || CONTROL_CHARS.test(email)
      || !EMAIL_PATTERN.test(email)) {
    return { error: 'invalid_email' }
  }
  return { value: email }
}

export function validateRegistrationInput(body) {
  if (!isPlainObject(body)) {
    return { error: 'invalid_request_body' }
  }
  const username = trimUsername(body.username)
  if (!isBoundedString(username, USERNAME_MAX_LENGTH)
      || username.length < USERNAME_MIN_LENGTH
      || !USERNAME_PATTERN.test(username)) {
    return {
      error: 'invalid_username',
      params: { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH }
    }
  }
  const email = validateEmail(body.email)
  if (email.error) {
    return email
  }
  const password = validateNewPassword(body.password)
  if (password.error) {
    return password
  }
  return { credentials: { username, email: email.value, password: password.value } }
}

export function validateLoginInput(body) {
  if (!isPlainObject(body)) {
    return { error: 'invalid_credentials' }
  }
  const email = validateEmail(body.email)
  if (email.error || !isPasswordInput(body.password)) {
    return { error: 'invalid_credentials' }
  }
  return { credentials: { email: email.value, password: body.password } }
}
