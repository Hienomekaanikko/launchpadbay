import { useEffect, useRef, useState } from 'react'
import { mountLaunchpad } from './engine.js'
import { themes } from './themes.js'
import launchpadCss from './launchpad.css?raw'
import landing from '../assets/landing.jpg'

const MIN_LOADING_MS = 1000

export default function LaunchpadView({ onBack }) {
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const styleTag = document.createElement('style')
    styleTag.setAttribute('data-launchpad-style', 'true')
    styleTag.textContent = launchpadCss
    document.head.appendChild(styleTag)

    const { destroy } = mountLaunchpad(containerRef.current)

    let cancelled = false
    let minWaitTimer = null
    const start = Date.now()
    const markReady = () => {
      if (cancelled) return
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - start))
      minWaitTimer = setTimeout(() => {
        if (!cancelled) setReady(true)
      }, wait)
    }

    const bgImage = themes[0]?.bgImage
    if (bgImage) {
      const img = new Image()
      img.onload = markReady
      img.onerror = markReady
      img.src = bgImage
    } else {
      markReady()
    }

    return () => {
      cancelled = true
      if (minWaitTimer) clearTimeout(minWaitTimer)
      destroy()
      styleTag.remove()
    }
  }, [])

  const pads = Array.from({ length: 25 }, (_, i) => i + 1)

  return (
    <div ref={containerRef}>
      <button type="button" className="home-btn" onClick={onBack}>&larr; Home</button>

      <div className="dot-grid" />

      <div
        className={`loading-overlay${ready ? ' hidden' : ''}`}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${landing})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        Loading&hellip;
      </div>

      <div className={`grid-wrapper${ready ? ' ready' : ''}`}>
        <div id="master-bar"><div id="master-bar-fill" /></div>
        <div id="transport-controls">
          <button type="button" id="split-btn" className="transport-btn">SPLIT ½</button>
        </div>

        <div className="grid-with-knobs">
          <div className="knob-col-wrap">
            <span className="knob-col-label">VOL</span>
            <div className="knob-col" id="vol-knobs" />
          </div>

          <div className="container">
            {pads.map((n) => (
              <div className="btn" id={`btn${n}`} key={n}><a /></div>
            ))}
          </div>

          <div className="knob-col-wrap">
            <span className="knob-col-label">LP</span>
            <div className="knob-col" id="filter-knobs" />
          </div>

          <div className="knob-col-wrap">
            <span className="knob-col-label">STU</span>
            <div className="knob-col" id="stutter-btns" />
          </div>
        </div>
      </div>
    </div>
  )
}
