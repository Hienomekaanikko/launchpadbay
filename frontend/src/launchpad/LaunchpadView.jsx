import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mountLaunchpad } from './engine.js'
import { fetchThemes } from './themes.js'
import useLaunchpadSync from './useLaunchpadSync.js'
import PadSampleUpload from './PadSampleUpload.jsx'
import { PAD_COUNT } from './pads.js'
import launchpadCss from './launchpad.css?raw'
import landing from '../assets/landing.jpg'

const MIN_LOADING_MS = 1000

export default function LaunchpadView({ socket, activeSession, token }) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)
  // set once the samples are loaded, so a session snapshot has something to play
  const [engine, setEngine] = useState(null)
  const needsClick = useLaunchpadSync(engine, socket, activeSession)

  // out of a session (left it, or it ended): uploaded samples go back to the theme's.
  // Also runs once when the engine first appears, with nothing to reset
  useEffect(() => {
    if (engine && !activeSession) engine.resetPadSamples()
  }, [engine, activeSession])

  useEffect(() => {
    let cancelled = false
    let minWaitTimer = null
    let destroy = null
    const start = Date.now()
    const markReady = () => {
      if (cancelled) return
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - start))
      minWaitTimer = setTimeout(() => {
        if (!cancelled) setReady(true)
      }, wait)
    }

    // mountLaunchpad can't start until the theme list (and therefore the
    // sound/image URLs it needs) has actually arrived from the backend —
    // unlike the old static themes.js, this is no longer instantly available.
    // fetchThemes retries on its own (the backend may still be starting up),
    // so the loading overlay just stays up rather than us falling through to
    // a themeless, silently-broken launchpad on the first failed request.
    fetchThemes(() => cancelled).then((themes) => {
      if (cancelled) return
      const launchpad = mountLaunchpad(containerRef.current, themes)
      destroy = launchpad.destroy
      launchpad.loaded.then(() => {
        if (!cancelled) setEngine(launchpad)
      })

      const bgImage = themes[0]?.bgImage
      if (bgImage) {
        const img = new Image()
        img.onload = markReady
        img.onerror = markReady
        img.src = bgImage
      } else {
        markReady()
      }
    }).catch(() => {
      if (cancelled) return
      markReady()
    })

    return () => {
      cancelled = true
      if (minWaitTimer) clearTimeout(minWaitTimer)
      if (destroy) destroy()
    }
  }, [])

  const pads = Array.from({ length: PAD_COUNT }, (_, i) => i + 1)

  return (
    <div ref={containerRef} className="lpad-view" dir="ltr">
      <style data-launchpad-style="true">{`@layer base {\n${launchpadCss}\n}`}</style>
      <div className="dot-grid" />

      <div
        className={`loading-overlay${ready ? ' hidden' : ''}`}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${landing})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {t('launchpad.loading')}
      </div>

      {/* after a page refresh in a session: the click lets the browser start our audio */}
      {ready && needsClick && (
        <button type="button" className="loading-overlay rejoin-overlay" onClick={engine.startAudio}>
          {t('launchpad.clickToRejoin')}
        </button>
      )}

      {/* shown by the engine while a session joiner waits for the partner's loop */}
      <div id="sync-msg" role="status" />

      <div className={`grid-wrapper${ready ? ' ready' : ''}`}>
        <div id="loop-bar"><div id="loop-bar-fill" /></div>
        <div id="transport-controls">
          <button type="button" id="split-btn" className="transport-btn">
            {/* Preserve the original label's layout width while enlarging the visible text. */}
            <span aria-hidden="true" className="invisible">{t('launchpad.split')}</span>
            <span className="transport-btn-label">{t('launchpad.split')}</span>
          </button>
          {activeSession && engine && <PadSampleUpload token={token} engine={engine} />}
        </div>

        <div className="grid-with-knobs">
          <div className="knob-col-wrap">
            <span className="knob-col-label">{t('launchpad.vol')}</span>
            <div className="knob-col" id="vol-knobs" />
          </div>

          <div className="lpad">
            {pads.map((n) => (
              <div className="btn" id={`btn${n}`} key={n}><a /></div>
            ))}
          </div>

          <div className="knob-col-wrap">
            <span className="knob-col-label">{t('launchpad.lp')}</span>
            <div className="knob-col" id="filter-knobs" />
          </div>

          <div className="knob-col-wrap">
            <span className="knob-col-label">{t('launchpad.stu')}</span>
            <div className="knob-col" id="stutter-btns" />
          </div>
        </div>
      </div>
    </div>
  )
}
