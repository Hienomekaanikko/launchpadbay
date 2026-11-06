import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { updateProfile, deleteAccount } from '../auth.js'
import {
  checkUsername, checkEmail, checkNewPassword,
  USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MAX_BYTES
} from '../validation.js'
import GlassPanel from './GlassPanel.jsx'
import Input from './Input.jsx'
import AvatarUploadPopup from './AvatarUploadPopup.jsx'

// Same look as LoginView and RegisterView
const fieldClass = 'w-full normal-case'
const labelClass = 'mb-2 text-sm font-medium inline-block uppercase'
const noteClass = 'mt-1 text-xs normal-case opacity-70'
const alertClass = 'w-full rounded-md border px-3 py-2 text-sm text-center normal-case'
const disabledButtonClass = 'disabled:opacity-50 disabled:cursor-default disabled:hover:bg-error/60'
const buttonClass = 'flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-medium normal-case text-white/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const actionButtonClass = `${buttonClass} bg-black/15 hover:bg-black/25`
const deleteButtonClass = `${buttonClass} bg-error/60 hover:bg-error/70`

const normalizeInput = (value) => value.trim().normalize('NFC')
const isPasswordTooLong = (value) => new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES

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

  const nextUsername = normalizeInput(username)
  const nextEmail = normalizeInput(email)
  const usernameChanged = !inSession && Boolean(nextUsername) && nextUsername !== profile.username
  const emailChanged = Boolean(nextEmail) && nextEmail !== profile.email
  const passwordChanged = profile.hasPassword && newPassword.length > 0
  const hasChanges = usernameChanged || emailChanged || passwordChanged

  async function handleSubmit(event) {
    event.preventDefault()
    if (!hasChanges) return
    setClientError('')
    setServerError(null)
    setSuccess(null)

    // Only send values that differ from the saved profile.
    const changes = {}
    if (usernameChanged) changes.username = nextUsername
    if (emailChanged) changes.email = nextEmail
    if (passwordChanged) changes.newPassword = newPassword

    if (changes.email !== undefined
        && normalizeInput(email) !== normalizeInput(confirmEmail)) {
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

    const ruleError = (changes.username !== undefined && checkUsername(changes.username))
      || (changes.email !== undefined && checkEmail(changes.email))
      || (changes.newPassword !== undefined && checkNewPassword(changes.newPassword))
    if (ruleError) {
      setServerError(ruleError)
      return
    }

    if (needsPassword && isPasswordTooLong(currentPassword)) {
      setServerError({ code: 'current_password_incorrect' })
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

      if (saved.email && profile.hasPassword) {
        setSuccess({
          key: saved.username
            ? (passwordChanged ? 'profile.usernameEmailPasswordSaved' : 'profile.usernameEmailSaved')
            : (passwordChanged ? 'profile.emailPasswordSaved' : 'profile.emailSaved'),
          params: { email: saved.email }
        })
      } else if (passwordChanged) {
        setSuccess({ key: saved.username ? 'profile.usernamePasswordChanged' : 'profile.passwordChanged' })
      } else {
        setSuccess({ key: 'profile.saved' })
      }

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
      <button className={`${actionButtonClass} disabled:cursor-default disabled:opacity-50 disabled:hover:bg-black/15`} type="submit" disabled={!hasChanges}>{t('profile.save')}</button>
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
    if (profile.hasPassword && isPasswordTooLong(value)) {
      setServerError({ code: 'password_incorrect' })
      return
    }
    if (!profile.hasPassword && normalizeInput(value) !== profile.username) {
      setServerError({ code: 'username_mismatch' })
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
      {inSession && <p className={noteClass}>{t('profile.leaveSessionToDelete')}</p>}
      {!confirming
        ? <button type="button" className={`${deleteButtonClass} ${disabledButtonClass}`}
            disabled={inSession} onClick={() => setConfirming(true)}>
            {t('profile.deleteAccount')}
          </button>
        : <>
            <p className="text-sm normal-case">{profile.hasPassword ? t('profile.deleteConfirmPassword') : t('profile.deleteConfirmUsername')}</p>
            <Field id="profile-delete-confirm" label={t('profile.deleteConfirmLabel')}
              type={profile.hasPassword ? 'password' : 'text'} value={value} autoComplete="off" onChange={(e) => setValue(e.target.value)} />
            <Status clientError={clientError} serverError={serverError} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={actionButtonClass} onClick={cancel}>{t('common.cancel')}</button>
              <button type="submit" className={deleteButtonClass}>{t('profile.deletePermanently')}</button>
            </div>
          </>}
    </form>
  )
}

export default function EditProfileView({ token, profile, inSession, onProfileChange, onTokenChange, onAccountDeleted }) {
  const { t } = useTranslation()
  const headingRef = useRef(null)
  const avatarButtonRef = useRef(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section aria-labelledby="edit-profile-heading" className="w-full max-w-5xl px-4 py-8 text-white">
      <GlassPanel className="bg-surface/30 p-6 sm:p-8 uppercase">
        <h1 id="edit-profile-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold mb-8 focus:outline-none">{t('profile.edit')}</h1>
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:grid-rows-[1fr_auto]">
          <section aria-label={t('profile.overview')} className="flex min-w-0 flex-col items-center gap-4 text-center md:col-start-2 md:row-start-1 md:self-stretch md:justify-center">
            <img src={profile.avatar} alt="" className="size-40 shrink-0 rounded-full object-cover ring-2 ring-white/15 lg:size-48" />
            <div className="w-full min-w-0 normal-case">
              <h2 className="break-words text-xl font-semibold">{profile.username}</h2>
              {profile.email && <p className="mt-1 break-words text-sm text-white/70">{profile.email}</p>}
            </div>
            <button ref={avatarButtonRef} type="button" onClick={() => setShowUpload(true)} className={actionButtonClass}>
              {t('profile.changeAvatar')}
            </button>
          </section>
          <div className="min-w-0 border-t border-white/15 pt-8 md:col-start-1 md:row-start-1 md:row-span-2 md:border-t-0 md:border-e md:pe-8 md:pt-0">
            <ProfileForm token={token} profile={profile} inSession={inSession} onProfileChange={onProfileChange} onTokenChange={onTokenChange} />
          </div>
          <div className="min-w-0 border-t border-white/15 pt-6 md:col-start-2 md:row-start-2 md:self-end">
            <DeleteSection token={token} profile={profile} inSession={inSession} onAccountDeleted={onAccountDeleted} />
          </div>
        </div>
      </GlassPanel>
      {showUpload && <AvatarUploadPopup
        token={token}
        avatar={profile.avatar}
        onClose={() => {
          setShowUpload(false)
          avatarButtonRef.current?.focus()
        }}
        onAvatarChange={(avatar) => onProfileChange({ avatar })}
      />}
    </section>
  )
}
