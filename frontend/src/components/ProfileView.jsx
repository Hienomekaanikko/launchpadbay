import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { fetchProfile } from '../auth.js'
import GlassPanel from './GlassPanel.jsx'

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

function ProfileDetails({ profile }) {
  const { t, i18n } = useTranslation()
  const rows = [
    [t('profile.memberSince'), new Date(profile.createdAt).toLocaleDateString(i18n.resolvedLanguage, { year: 'numeric', month: 'long', day: 'numeric' })],
  ]
  return (
    <dl className="flex flex-col gap-5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-white/60">{label}</dt>
          <dd className="break-words text-white">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ProfileView({ token, onEditClick, onLogout, onClose }) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)

  const dismiss = useCallback(() => {
    onClose()
    document.getElementById('profile-menu-trigger')?.focus()
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchProfile(token)
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return
      if (document.getElementById('profile-menu-trigger')?.contains(event.target)) return
      dismiss()
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dismiss])

  return (
    <GlassPanel ref={panelRef} id="profile-menu" role="dialog" aria-labelledby="profile-menu-heading" tabIndex={-1} className="relative flex min-h-0 flex-col overflow-hidden bg-surface/40 p-0 text-white focus:outline-none">
      <div className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-4">
        {profile && <img src={profile.avatar} alt="" className="size-20 shrink-0 rounded-full object-cover ring-2 ring-white/15" />}
        <div className={`min-w-0 flex-1 py-1${profile && onEditClick ? ' pe-10' : ''}`}>
          <h2 id="profile-menu-heading" className="break-words text-xl font-semibold leading-snug">{profile?.username || t('profile.overview')}</h2>
          {profile?.email && <p className="mt-1 break-words text-sm text-white/70">{profile.email}</p>}
        </div>
        {profile && onEditClick && (
          <button type="button" onClick={() => onEditClick(profile)} aria-label={t('profile.edit')} className={`absolute top-2 end-3 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-xs text-white/70 underline underline-offset-4 hover:text-white ${focusClass}`}>
            {t('profile.editLink')}
          </button>
        )}
      </div>

      <div className="min-h-0 overflow-y-auto px-5 pb-5">
        {error && <div role="alert" className="text-error text-sm">{translateServerError(t, error)}</div>}
        {!error && !profile && <div role="status">{t('common.loading')}</div>}
        {profile && <ProfileDetails profile={profile} />}
      </div>

      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <button type="button" onClick={onLogout} className={`flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-black/15 px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-black/25 ${focusClass}`}>{t('nav.logout')}</button>
      </div>
    </GlassPanel>
  )
}
