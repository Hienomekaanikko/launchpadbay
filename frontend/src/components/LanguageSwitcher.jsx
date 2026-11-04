import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', short: 'EN', label: 'ENGLISH' },
  { code: 'fi', short: 'FI', label: 'SUOMI' },
  { code: 'he', short: 'HE', label: 'עברית' },
  { code: 'zh', short: 'ZH', label: '中文' },
]

const menuClass = [
  'absolute bottom-full end-0 z-20 mt-2 min-w-28 w-max',
  'flex flex-col gap-1 p-2',
  'rounded-[8px] bg-surface/30 text-white uppercase',
  'border-t border-t-white/18 border-b border-b-white/8',
  'shadow-panel backdrop-blur-[15px]',
].join(' ')

function GlobeIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const select = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className="app-nav-action min-w-0 inline-flex items-center gap-1.5 px-2 leading-none hover:bg-white/8 hover:text-white"
        aria-label={t('common.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon className="block size-3.5 shrink-0 opacity-80" />
        <span className="block [text-box:trim-both_cap_alphabetic]">{current.short}</span>
      </button>

      {open && (
        <div className={menuClass} role="listbox" aria-label={t('common.language')}>
          {LANGUAGES.map(({ code, label }) => {
            const selected = i18n.language === code
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                className={[
                  'relative w-full rounded-md px-3 py-2 text-sm font-medium tracking-nav text-start',
                  'text-white/70 hover:bg-white/8 hover:text-white',
                  selected && 'bg-white/10 text-white',
                  selected && "after:content-[''] after:absolute after:left-3 after:right-3 after:bottom-1",
                  selected && 'after:h-0.5 after:rounded-full after:bg-brand after:shadow-glow-brand',
                ].filter(Boolean).join(' ')}
                onClick={() => select(code)}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
