import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { updateProfile, changePassword, deleteAccount } from '../auth.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'

const sectionClasses = 'flex w-full flex-col gap-2'
const headingClasses = 'text-black text-xs font-medium tracking-nav'
const noteClasses = 'text-black/60 text-xs'
const errorClasses = 'text-error text-xs'
// FormButton's and Input's default white text is hard to read on this light popup (LoginView does the same)
const buttonClasses = 'text-black'
const inputClasses = 'text-black placeholder:text-black/60 placeholder:[text-shadow:none]'

function Status({ error, success }) {
  if (error) return <p className={errorClasses}>{error}</p>
  if (success) return <p className={noteClasses}>{success}</p>
  return null
}

// The email is the login, so it's typed twice and, on password accounts, needs the
// current password (GitHub-only accounts have none)
function EmailForm({ token, profile, onProfileChange }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [savedEmail, setSavedEmail] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSavedEmail('')
    if (email !== confirm) {
      setError(t('profile.emailMismatch'))
      return
    }
    try {
      const result = await updateProfile(token, { email, currentPassword })
      onProfileChange({ email: result.email })
      setEmail('')
      setConfirm('')
      setCurrentPassword('')
      setSavedEmail(result.email)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sectionClasses}>
      <h3 className={headingClasses}>{t('register.email')}</h3>
      <Input className={inputClasses} type="email" aria-label={t('register.email')} placeholder={t('profile.newEmail')} value={email}
        onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <Input className={inputClasses} type="email" aria-label={t('profile.confirmNewEmail')} placeholder={t('profile.confirmNewEmail')} value={confirm}
        onChange={(e) => setConfirm(e.target.value)} autoComplete="off" required />
      {profile.hasPassword && (
        <Input className={inputClasses} type="password" aria-label={t('profile.currentPassword')} placeholder={t('profile.currentPassword')}
          value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      )}
      <Status error={error} success={savedEmail && t('profile.emailSaved', { email: savedEmail })} />
      <FormButton type="submit" className={`${buttonClasses} self-end`} disabled={!email || email === profile.email}>{t('profile.save')}</FormButton>
    </form>
  )
}

// Same rule as backend/validation.js (validateUsername), so the browser can stop most
// typos before sending; the backend still decides. A session keeps its players' names,
// so renaming waits until the user has left it
const USERNAME_MIN_LENGTH = 4
const USERNAME_MAX_LENGTH = 30

function UsernameForm({ token, profile, inSession, onProfileChange }) {
  const { t } = useTranslation()
  const usernameRules = t('profile.usernameRules', { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    try {
      const result = await updateProfile(token, { username })
      onProfileChange({ username: result.username })
      setUsername('')
      setSaved(true)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sectionClasses}>
      <h3 className={headingClasses}>{t('login.username')}</h3>
      <Input className={inputClasses} type="text" aria-label={t('login.username')} placeholder={t('profile.newUsername')} value={username}
        onChange={(e) => setUsername(e.target.value)} disabled={inSession}
        minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern="[\p{L}\p{Nd}_\-]+" title={usernameRules} required />
      <p className={noteClasses}>{inSession ? t('profile.leaveSessionToRename') : usernameRules}</p>
      <Status error={error} success={saved && t('profile.saved')} />
      <FormButton type="submit" className={`${buttonClasses} self-end`} disabled={inSession || !username || username === profile.username}>{t('profile.save')}</FormButton>
    </form>
  )
}

function PasswordForm({ token }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    if (next !== confirm) {
      setError(t('register.passwordMismatch'))
      return
    }
    try {
      await changePassword(token, current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sectionClasses}>
      <h3 className={headingClasses}>{t('profile.password')}</h3>
      <Input className={inputClasses} type="password" aria-label={t('profile.currentPassword')} placeholder={t('profile.currentPassword')}
        value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      <Input className={inputClasses} type="password" aria-label={t('profile.newPassword')} placeholder={t('profile.newPassword')}
        value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      <Input className={inputClasses} type="password" aria-label={t('register.confirmPassword')} placeholder={t('register.confirmPassword')}
        value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      <Status error={error} success={saved && t('profile.passwordChanged')} />
      <FormButton type="submit" className={`${buttonClasses} self-end`}>{t('profile.changePassword')}</FormButton>
    </form>
  )
}

// Two steps, so the account can't be deleted with a single misclick
function DeleteSection({ token, profile, inSession, onAccountDeleted }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await deleteAccount(token, profile.hasPassword ? { password: value } : { username: value })
      onAccountDeleted()
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sectionClasses}>
      <h3 className={headingClasses}>{t('profile.deleteAccount')}</h3>
      {inSession && <p className={noteClasses}>{t('profile.leaveSessionToDelete')}</p>}
      {!confirming
        ? <FormButton type="button" className={`${buttonClasses} self-end bg-error/60`} disabled={inSession} onClick={() => setConfirming(true)}>
            {t('profile.deleteAccount')}
          </FormButton>
        : <>
            <p className={noteClasses}>{profile.hasPassword ? t('profile.deleteConfirmPassword') : t('profile.deleteConfirmUsername')}</p>
            <Input className={inputClasses} type={profile.hasPassword ? 'password' : 'text'}
              aria-label={t('profile.deleteConfirmLabel')}
              value={value} onChange={(e) => setValue(e.target.value)} required />
            <Status error={error} />
            <div className="flex justify-end gap-2">
              <FormButton type="button" className={buttonClasses} onClick={() => { setConfirming(false); setValue(''); setError('') }}>{t('common.cancel')}</FormButton>
              <FormButton type="submit" className={`${buttonClasses} bg-error/60`}>{t('profile.deletePermanently')}</FormButton>
            </div>
          </>}
    </form>
  )
}

export default function EditProfilePopup({ token, profile, inSession, onProfileChange, onAccountDeleted, onClose }) {
  const { t } = useTranslation()
  // Fits below the navbar, which is drawn on top. The popup is portalled outside #root, where
  // --app-nav-height is defined, so 76px (the tallest navbar) is the fallback
  return createPortal(
    <Modal className="z-30 w-[min(90vw,22rem)] top-[calc(50%+var(--app-nav-height,76px)/2)] max-h-[calc(100vh-var(--app-nav-height,76px)-2rem)] overflow-y-auto items-stretch gap-5">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-black text-sm font-medium tracking-nav">{t('profile.edit')}</h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <UsernameForm token={token} profile={profile} inSession={inSession} onProfileChange={onProfileChange} />
      <EmailForm token={token} profile={profile} onProfileChange={onProfileChange} />
      {profile.hasPassword && <PasswordForm token={token} />}
      <DeleteSection token={token} profile={profile} inSession={inSession} onAccountDeleted={onAccountDeleted} />
    </Modal>,
    document.body,
  )
}
