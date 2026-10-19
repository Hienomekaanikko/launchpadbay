import { useState } from 'react'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import { uploadAvatar } from '../auth.js'

export default function AvatarEditor({ token, onClose, onSaved }) {
  return (
    <Modal className="z-30 w-[min(90vw,20rem)]">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-white text-sm font-medium tracking-nav font-sans">
          Change avatar
        </h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <AvatarUploader token={token} onClose={onClose} onSaved={onSaved} />
    </Modal>
  )
}

function AvatarUploader({ token, onClose, onSaved }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChange(event) {
    const chosen = event.target.files?.[0]
    if (!chosen) return
    setSaving(true)
    setError('')
    try {
      const data = await uploadAvatar(token, chosen)
      onSaved?.(data.avatar)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        disabled={saving}
        className="w-full text-xs text-white/80 font-sans file:mr-2"
      />
      {saving && <p className="text-white/60 text-xs font-sans">Uploading…</p>}
      {error && <p className="text-error text-xs font-sans">{error}</p>}
    </div>
  )
}
