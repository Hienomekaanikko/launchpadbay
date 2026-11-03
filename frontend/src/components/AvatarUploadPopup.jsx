import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import FormButton from './FormButton.jsx'
import { uploadAvatar } from '../auth.js'
import { checkAvatar, AVATAR_TYPES } from '../validation.js'

export default function AvatarUploadPopup({ token, onClose, onAvatarChange }) {
  const { t } = useTranslation()
  const fileInput = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')

  // Selecting a file uploads it. There is no separate confirm step for now
  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    event.target.value = '' // same file can be picked up again after a failed upload
    setError('')
    // wrong type or too big: say so right away instead of uploading it for the server to refuse
    const problem = checkAvatar(file)
    if (problem) {
      setError(translateServerError(t, problem))
      return
    }
    setUploading(true)
    try {
      const { avatar } = await uploadAvatar(token, file)
      onAvatarChange(avatar)
      onClose()
    } catch (err) {
      setError(translateServerError(t, err))
      setUploading(false)
    }
  }

  return createPortal(
    <Modal className="z-30 w-[min(90vw,20rem)] gap-3">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-black text-sm font-medium tracking-nav">
          {t('profile.changeAvatar')}
        </h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={AVATAR_TYPES.join(',')}
        onChange={handleFileSelected}
        disabled={uploading}
        className="hidden"
      />
      <div className="flex w-full flex-col gap-2">
        <FormButton
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {t('profile.chooseFile')}
        </FormButton>
        <p aria-live="polite" className="text-black/60 text-xs break-all">
          {filename || t('profile.noFileSelected')}
        </p>
      </div>
      {uploading && <p className="text-black/60 text-xs">{t('profile.uploading')}</p>}
      {error && <p className="text-error text-xs">{error}</p>}
    </Modal>,
    document.body,
  )
}
