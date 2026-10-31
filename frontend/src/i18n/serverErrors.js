const SERVER_ERROR_KEYS = {
  // registration related errors
  invalid_username: 'register.invalidUsername',
  invalid_email: 'register.invalidEmail',
  password_too_short: 'register.passwordTooShort',
  password_too_long: 'register.passwordTooLong',
  password_require_letter: 'register.passwordRequireLetter',
  password_require_digit: 'register.passwordRequireDigit',
  password_require_special: 'register.passwordRequireSpecial',
  already_taken: 'register.alreadyTaken',

  // login related errors
  invalid_credentials: 'login.invalidCredentials',
  github_login_cancelled: 'login.githubLoginCancelled',
  github_login_failed: 'login.githubLoginFailed',
  github_login_expired: 'login.githubLoginExpired',

  // profile related errors
  user_not_found: 'profile.userNotFound',
  email_taken: 'profile.emailTaken',
  password_incorrect: 'profile.passwordIncorrect',
  current_password_incorrect: 'profile.currentPasswordIncorrect',
  username_mismatch: 'profile.usernameMismatch',
  github_only_account: 'profile.githubOnlyAccount',
  leave_session_before_delete: 'profile.leaveSessionBeforeDelete',
  no_file_uploaded: 'profile.noFileUploaded',
  invalid_avatar_type: 'profile.invalidAvatarType',
  file_too_large: 'profile.fileTooLarge',

  // other server related errors
  invalid_request_body: 'serverErrors.invalidRequestBody',
  internal_error: 'serverErrors.internalError',
  unauthorized: 'serverErrors.unauthorized'
}

export function translateServerError(t, error) {
  if (!error) {
    return ''
  }
  const errorKey = typeof error === 'string' ? error : error.code
  const translationPath = SERVER_ERROR_KEYS[errorKey]
  return translationPath ? t(translationPath, error?.params) : t('serverErrors.generic')
}
