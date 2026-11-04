import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { uploadPadSample } from '../auth.js'
import { checkPadSample } from '../validation.js'
import { PAD_COUNT } from './pads.js'

const pads = Array.from({ length: PAD_COUNT }, (_, i) => i + 1)

// In-session only: pick a pad, pick a WAV, and that pad gets the new sample.
// Selecting the file uploads it (same as the avatar popup); the engine then
// shows the pad's loading state while the new clip is fetched and decoded.
export default function PadSampleUpload({ token, engine }) {
  const { t } = useTranslation()
  const fileInput = useRef(null)
  const [pad, setPad] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = '' // same file can be picked again after a failed upload
    setError('')
    const problem = checkPadSample(file)
    if (problem) {
      setError(problem)
      return
    }
    setUploading(true)
    try {
      const { url } = await uploadPadSample(token, pad, file)
      // the backend echoes it to both players, us included, so each reloads the pad once
      engine.dispatch({ type: 'PAD_SAMPLE', pad, url })
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="sample-upload">
      <select
        className="transport-btn sample-upload-pad"
        value={pad}
        onChange={(event) => setPad(Number(event.target.value))}
        disabled={uploading}
        aria-label={t('launchpad.pad', { n: pad })}
      >
        {pads.map((n) => (
          <option value={n} key={n}>{t('launchpad.pad', { n })}</option>
        ))}
      </select>
      <input
        ref={fileInput}
        type="file"
        accept=".wav,audio/wav,audio/x-wav"
        onChange={handleFileSelected}
        disabled={uploading}
        className="hidden"
      />
      <button
        type="button"
        className="transport-btn"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
      >
        {uploading ? t('launchpad.uploading') : t('launchpad.upload')}
      </button>
      {error && (
        <p role="alert" className="sample-upload-error">{translateServerError(t, error)}</p>
      )}
    </div>
  )
}
