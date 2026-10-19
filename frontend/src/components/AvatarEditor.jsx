import { useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import { uploadAvatar } from '../auth.js'

export default function AvatarEditor({ token, onClose, onAvatarChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Selecting a file uploads it right away — there is no separate confirm step
  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const { avatar } = await uploadAvatar(token, file)
      onAvatarChange(avatar)
      onClose()
    } catch (err) {
      setError(err.message)
      setUploading(false)
    }
  }

  return createPortal(
    <Modal className="z-30 w-[min(90vw,20rem)] gap-3">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-white text-sm font-medium tracking-nav font-sans">
          Change avatar
        </h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelected}
        disabled={uploading}
        className="w-full text-xs text-white/80 font-sans file:mr-2"
      />
      {uploading && <p className="text-white/60 text-xs font-sans">Uploading…</p>}
      {error && <p className="text-error text-xs font-sans">{error}</p>}
    </Modal>,
    document.body,
  )
}


//TODO: crop bofore upload
