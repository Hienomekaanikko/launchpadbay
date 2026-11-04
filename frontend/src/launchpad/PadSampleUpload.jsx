import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { uploadPadSample } from '../auth.js'
import { checkPadSample } from '../validation.js'

// In-session only. SAMPLES toggles pick mode: the next pad tapped opens the file
// picker instead of playing, and the chosen WAV becomes that pad's sample. The
// engine then shows the pad's loading state while the new clip is fetched and
// decoded. Cancelling the picker leaves pick mode on; tap SAMPLES again to leave.
export default function PadSampleUpload({ token, engine }) {
  const { t } = useTranslation()
  const fileInput = useRef(null)
  // set by the pick handler, read when the file arrives; a ref so the picker
  // opens in the same tick as the tap, with no render in between
  const pickedPad = useRef(null)
  const [picking, setPicking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // while picking, pad taps come here instead of playing; cleared on leave/unmount
  useEffect(() => {
    if (!picking) return
    engine.setPadPickHandler((pad) => {
      pickedPad.current = pad
      fileInput.current?.click() // allowed: we're inside the tap's event handler
    })
    return () => engine.setPadPickHandler(null)
  }, [engine, picking])

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = '' // same file can be picked again after a failed upload
    setPicking(false)
    setError('')
    const problem = checkPadSample(file)
    if (problem) {
      setError(problem)
      return
    }
    setUploading(true)
    try {
      const pad = pickedPad.current
      const { url } = await uploadPadSample(token, pad, file)
      // the backend echoes it to both players, us included, so each reloads the pad once
      engine.dispatch({ type: 'PAD_SAMPLE', pad, url })
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  const label = uploading ? t('launchpad.uploading')
    : picking ? t('launchpad.pickPad')
    : t('launchpad.samples')

  return (
    <div className="sample-upload">
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
        className={`transport-btn${picking ? ' active' : ''}`}
        aria-pressed={picking}
        onClick={() => { setError(''); setPicking((on) => !on) }}
        disabled={uploading}
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="sample-upload-error">{translateServerError(t, error)}</p>
      )}
    </div>
  )
}
