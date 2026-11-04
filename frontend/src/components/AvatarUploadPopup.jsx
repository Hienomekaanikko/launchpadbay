import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import { uploadAvatar } from '../auth.js'
import { checkAvatar, AVATAR_TYPES, AVATAR_MAX_BYTES } from '../validation.js'

export default function AvatarUploadPopup({ token, avatar, onClose, onAvatarChange }) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)
  const fileInputRef = useRef(null)
  const uploadButtonRef = useRef(null)

  useEffect(() => {
    uploadButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return
    const buttons = panelRef.current?.querySelectorAll('button:not(:disabled)')
    if (!buttons?.length) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (document.activeElement === panelRef.current) {
      event.preventDefault()
      const nextButton = event.shiftKey ? last : first
      nextButton.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Selecting a file uploads it. There is no separate confirm step for now
  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // let the same file be selected again after an error
    if (!file || uploading) return
    setError(null)
    // wrong type or too big: say so right away instead of uploading it for the server to refuse
    const problem = checkAvatar(file)
    if (problem) {
      setError(problem)
      return
    }
    setUploading(true)
    // Keep keyboard focus in the dialog while the upload button is disabled.
    panelRef.current?.focus()
    try {
      const { avatar } = await uploadAvatar(token, file)
      onAvatarChange(avatar)
      onClose()
    } catch (err) {
      setError(err)
      setUploading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 backdrop-blur-sm">
      <Modal
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-upload-heading"
        aria-describedby="avatar-upload-requirements"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="z-20 w-[min(calc(100vw-2rem),26rem)] max-h-[calc(100dvh-2rem)] items-stretch gap-0 overflow-y-auto rounded-[20px] bg-surface/30 p-6 text-white sm:p-8 focus:outline-none"
        onClose={onClose}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="avatar-upload-heading" className="min-w-0 flex-1 text-xl font-semibold">
            {t('profile.changeAvatar')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <Icon name="close" className="size-5" />
          </button>
        </div>

        <div className="my-6 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
          <div className="relative size-24">
            <img src={avatar} alt="" className="size-full rounded-full object-cover ring-4 ring-white/15" />
            {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/30" aria-hidden="true">
              <span className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
            </div>}
          </div>
          <p id="avatar-upload-requirements" className="text-center text-xs leading-relaxed text-white">{t('profile.avatarRequirements', { max: AVATAR_MAX_BYTES / (1024 * 1024) })}</p>
        </div>

        <input ref={fileInputRef} type="file" accept={AVATAR_TYPES.join(',')} onChange={handleFileSelected} disabled={uploading} hidden />
        {error && <p role="alert" className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{translateServerError(t, error)}</p>}
        <div role="status" className="sr-only">{uploading ? t('profile.uploading') : ''}</div>
        <button ref={uploadButtonRef} type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-black/15 px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-black/25 disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-black/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {uploading ? t('profile.uploading') : t('profile.chooseImage')}
        </button>
      </Modal>
    </div>,
    document.body,
  )
}
