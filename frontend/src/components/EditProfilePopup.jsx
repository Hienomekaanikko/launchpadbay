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

function Status({ error, success }) {
  if (error) return <p className={errorClasses}>{error}</p>
  if (success) return <p className={noteClasses}>{success}</p>
  return null
}

function EmailForm({ token, profile, onProfileChange }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(profile.email ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    try {
      const result = await updateProfile(token, { email })
      onProfileChange({ email: result.email })
      setSaved(true)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={sectionClasses}>
      <h3 className={headingClasses}>{t('register.email')}</h3>
      <Input type="email" aria-label={t('register.email')} placeholder={t('register.email')} value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <Status error={error} success={saved && t('profile.saved')} />
      <FormButton type="submit" className="self-end">{t('profile.save')}</FormButton>
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
      <Input type="password" aria-label={t('profile.currentPassword')} placeholder={t('profile.currentPassword')}
        value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      <Input type="password" aria-label={t('profile.newPassword')} placeholder={t('profile.newPassword')}
        value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      <Input type="password" aria-label={t('register.confirmPassword')} placeholder={t('register.confirmPassword')}
        value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      <Status error={error} success={saved && t('profile.passwordChanged')} />
      <FormButton type="submit" className="self-end">{t('profile.changePassword')}</FormButton>
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
        ? <FormButton type="button" className="self-end bg-error/60" disabled={inSession} onClick={() => setConfirming(true)}>
            {t('profile.deleteAccount')}
          </FormButton>
        : <>
            <p className={noteClasses}>{profile.hasPassword ? t('profile.deleteConfirmPassword') : t('profile.deleteConfirmUsername')}</p>
            <Input type={profile.hasPassword ? 'password' : 'text'}
              aria-label={t('profile.deleteConfirmLabel')}
              value={value} onChange={(e) => setValue(e.target.value)} required />
            <Status error={error} />
            <div className="flex justify-end gap-2">
              <FormButton type="button" onClick={() => { setConfirming(false); setValue(''); setError('') }}>{t('common.cancel')}</FormButton>
              <FormButton type="submit" className="bg-error/60">{t('profile.deletePermanently')}</FormButton>
            </div>
          </>}
    </form>
  )
}

export default function EditProfilePopup({ token, profile, inSession, onProfileChange, onAccountDeleted, onClose }) {
  const { t } = useTranslation()
  return createPortal(
    <Modal className="z-30 w-[min(90vw,22rem)] max-h-[90vh] overflow-y-auto items-stretch gap-5">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-black text-sm font-medium tracking-nav">{t('profile.edit')}</h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <EmailForm token={token} profile={profile} onProfileChange={onProfileChange} />
      {profile.hasPassword && <PasswordForm token={token} />}
      <DeleteSection token={token} profile={profile} inSession={inSession} onAccountDeleted={onAccountDeleted} />
    </Modal>,
    document.body,
  )
}
