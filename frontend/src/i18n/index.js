import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fi from './locales/fi.json'
import he from './locales/he.json'
import zh from './locales/zh.json'

const SUPPORTED = new Set(['en', 'fi', 'he', 'zh'])

function resolveStoredLang() {
  const stored = localStorage.getItem('lang')
  return SUPPORTED.has(stored) ? stored : 'en'
}

function syncDocument(lng) {
  const language = lng || 'en'
  document.documentElement.lang = language
  document.documentElement.dir = i18n.dir(language)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fi: { translation: fi },
    he: { translation: he },
    zh: { translation: zh },
  },
  lng: resolveStoredLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

syncDocument(i18n.resolvedLanguage)
i18n.on('languageChanged', syncDocument)

export default i18n
