import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'ENGLISH' },
  { code: 'fi', label: 'SUOMEKSI' },
  { code: 'he', label: 'עברית' },
  { code: 'zh', label: '中文' },
]

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={t('common.language')}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={[
            'app-nav-action',
            'min-w-0 px-2',
            'hover:bg-white/8 hover:text-white',
          ].join(' ')}
          aria-pressed={i18n.language === code}
          aria-current={i18n.language === code ? 'true' : undefined}
          onClick={() => {
            i18n.changeLanguage(code)
            localStorage.setItem('lang', code)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
