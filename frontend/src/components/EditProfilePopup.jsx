import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { updateProfile, deleteAccount } from '../auth.js'
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from '../validation.js'
import Modal from './Modal.jsx'
import Input from './Input.jsx'
import NavButton from './NavButton.jsx'

// Same look as LoginView and RegisterView
const fieldClass = 'w-full normal-case'
const labelClass = 'mb-2 text-sm font-medium inline-block uppercase'
const noteClass = 'mt-1 text-xs normal-case opacity-70'
const alertClass = 'w-full rounded-md border px-3 py-2 text-sm text-center normal-case'
const disabledButtonClass = 'disabled:opacity-50 disabled:cursor-default disabled:active:scale-100'

function Field({ id, label, note, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <Input id={id} className={fieldClass} {...inputProps} />
      {note && <p className={noteClass}>{note}</p>}
    </div>
  )
}

// clientError: a translation key, serverError: the error thrown by auth.js,
// success: { key, params }. All are translated here, so they follow a language switch
function Status({ clientError, serverError, success }) {
  const { t } = useTranslation()
  if (clientError || serverError) {
    return (
      <div role="alert" className={`${alertClass} text-red-800`}>
        {clientError ? t(clientError) : translateServerError(t, serverError)}
      </div>
    )
  }
  if (success) {
    return <div role="status" className={alertClass}>{t(success.key, success.params)}</div>
  }
  return null
}

// Username, email and password in one save: they go out in one request and are saved
// together or not at all. The current password is asked once, for email and password
// changes; GitHub-only accounts have no password, so they get no password fields
function ProfileForm({ token, profile, inSession, onProfileChange, onTokenChange }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [clientError, setClientError] = useState('')
  const [serverError, setServerError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setClientError('')
    setServerError(null)
    setSuccess(null)

    // only the fields the user filled in are sent
    const changes = {}
    if (username.trim()) changes.username = username
    if (email || confirmEmail) changes.email = email
    if (newPassword || confirmPassword) changes.newPassword = newPassword

    if (Object.keys(changes).length === 0) {
      setClientError('profile.nothingToSave')
      return
    }
    if (changes.username !== undefined && username.trim() === profile.username) {
      setClientError('profile.usernameUnchanged')
      return
    }
    if (changes.email !== undefined && email !== confirmEmail) {
      setClientError('profile.emailMismatch')
      return
    }
    if (changes.newPassword !== undefined && newPassword !== confirmPassword) {
      setClientError('register.passwordMismatch')
      return
    }
    const needsPassword = profile.hasPassword && (changes.email !== undefined || changes.newPassword !== undefined)
    if (needsPassword && !currentPassword) {
      setClientError('profile.currentPasswordRequired')
      return
    }
    if (needsPassword) changes.currentPassword = currentPassword

    try {
      const { passwordChanged, token: newToken, ...saved } = await updateProfile(token, changes)
      // a password change ends every session's token, this one's too: switch to the new one
      if (newToken) onTokenChange(newToken)
      onProfileChange(saved)
      setUsername('')
      setEmail('')
      setConfirmEmail('')
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      if (saved.email) setSuccess({ key: 'profile.emailSaved', params: { email: saved.email } })
      else if (passwordChanged && !saved.username) setSuccess({ key: 'profile.passwordChanged' })
      else setSuccess({ key: 'profile.saved' })
    } catch (err) {
      setServerError(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field id="profile-username" label={t('profile.newUsername')} type="text" placeholder={profile.username}
        maxLength={USERNAME_MAX_LENGTH}
        value={username} onChange={(e) => setUsername(e.target.value)} disabled={inSession} autoComplete="username"
        note={inSession
          ? t('profile.leaveSessionToRename')
          : t('profile.usernameRules', { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })} />
      <Field id="profile-email" label={t('profile.newEmail')} type="email" placeholder={profile.email}
        value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <Field id="profile-confirm-email" label={t('profile.confirmNewEmail')} type="email" placeholder="name@launchpad.bay"
        value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" />
      {profile.hasPassword && (
        <>
          <Field id="profile-new-password" label={t('profile.newPassword')} type="password" placeholder="••••••••"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <Field id="profile-confirm-password" label={t('register.confirmPassword')} type="password" placeholder="••••••••"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          <Field id="profile-current-password" label={t('profile.currentPassword')} type="password" placeholder="••••••••"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password"
            note={t('profile.currentPasswordNote')} />
        </>
      )}
      <Status clientError={clientError} serverError={serverError} success={success} />
      <NavButton className="w-full" type="submit">{t('profile.save')}</NavButton>
    </form>
  )
}

// Two steps, so the account can't be deleted with a single misclick
function DeleteSection({ token, profile, inSession, onAccountDeleted }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [value, setValue] = useState('')
  const [clientError, setClientError] = useState('')
  const [serverError, setServerError] = useState(null)

  function cancel() {
    setConfirming(false)
    setValue('')
    setClientError('')
    setServerError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setClientError('')
    setServerError(null)
    if (!value) {
      setClientError('common.fieldsRequired')
      return
    }
    try {
      await deleteAccount(token, profile.hasPassword ? { password: value } : { username: value })
      onAccountDeleted()
    } catch (err) {
      setServerError(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className={labelClass}>{t('profile.deleteAccount')}</h2>
      {inSession && <p className={noteClass}>{t('profile.leaveSessionToDelete')}</p>}
      {!confirming
        ? <NavButton type="button" className={`w-full bg-error/60 hover:bg-error/70 ${disabledButtonClass}`}
            disabled={inSession} onClick={() => setConfirming(true)}>
            {t('profile.deleteAccount')}
          </NavButton>
        : <>
            <p className="text-sm normal-case">{profile.hasPassword ? t('profile.deleteConfirmPassword') : t('profile.deleteConfirmUsername')}</p>
            <Field id="profile-delete-confirm" label={t('profile.deleteConfirmLabel')}
              type={profile.hasPassword ? 'password' : 'text'} value={value} onChange={(e) => setValue(e.target.value)} />
            <Status clientError={clientError} serverError={serverError} />
            <div className="flex gap-2">
              <NavButton type="button" className="flex-1 px-3" onClick={cancel}>{t('common.cancel')}</NavButton>
              <NavButton type="submit" className="flex-1 px-3 bg-error/60 hover:bg-error/70">{t('profile.deletePermanently')}</NavButton>
            </div>
          </>}
    </form>
  )
}

export default function EditProfilePopup({ token, profile, inSession, onProfileChange, onTokenChange, onAccountDeleted, onClose }) {
  const { t } = useTranslation()
  // Fits below the navbar, which is drawn on top. The popup is portalled outside #root, where
  // --app-nav-height is defined, so 76px (the tallest navbar) is the fallback.
  // Closes like LoginView and RegisterView: Esc or a click outside
  return createPortal(
    <Modal
      className="z-30 w-[min(90vw,24rem)] top-[calc(50%+var(--app-nav-height,76px)/2)] max-h-[calc(100vh-var(--app-nav-height,76px)-2rem)] overflow-y-auto items-stretch gap-0 bg-surface/30 text-white uppercase"
      onClose={onClose}
    >
      <h1 className="text-center text-xl font-semibold mb-6">{t('profile.edit')}</h1>
      <ProfileForm token={token} profile={profile} inSession={inSession} onProfileChange={onProfileChange} onTokenChange={onTokenChange} />
      <div className="my-6 h-px bg-current/20" />
      <DeleteSection token={token} profile={profile} inSession={inSession} onAccountDeleted={onAccountDeleted} />
    </Modal>,
    document.body,
  )
}
