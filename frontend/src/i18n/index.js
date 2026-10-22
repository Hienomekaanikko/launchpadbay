import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import english from './locales/english.json'
import finnish from './locales/finnish.json'
import hebrew from './locales/hebrew.json'
import mandarin from './locales/mandarin.json'

i18n.use(initReactI18next).init({
   resources: {
     english: { translation: english },
     finnish: { translation: finnish },
     hebrew: { translation: hebrew },
		mandarin: { translation: mandarin },
   },
   lng: localStorage.getItem('lang') || 'english',
   fallbackLng: 'english',
   interpolation: { escapeValue: false },
 })
 export default i18n
