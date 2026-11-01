import { useState } from 'react'
import { login } from '../auth.js'
import RegisterView from './RegisterView.jsx'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import NavButton from './NavButton.jsx'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'

export default function LoginView({ onLoggedIn, setShowLogin, initialError = '' }) {
  const [registerView, setRegisterView] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { t } = useTranslation()
  const [error, setError] = useState(() => initialError ? translateServerError(t, initialError) : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const result = await login(email, password)
      onLoggedIn(result.token, result.id, result.username)
      setShowLogin(false)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  const fieldClass = 'w-full normal-case'
  const labelClass = 'mb-2 text-sm font-medium inline-block uppercase'

  return (
    <>
      {!registerView && <Modal as="form" className="z-10 w-[min(90vw,24rem)] items-stretch gap-0 bg-surface/30 text-white uppercase" onSubmit={handleSubmit}>
        <CloseButton className="normal-case" onClick={() => setShowLogin(false)}>x</CloseButton>

        <h1 className="text-center text-xl font-semibold mb-6">{t('login.login')}</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className={labelClass}>{t('login.email')}</label>
            <Input id="login-email" className={fieldClass} type="email" placeholder="name@launchpad.bay" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="login-password" className={labelClass}>{t('login.password')}</label>
            <Input id="login-password" className={fieldClass} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-xs text-center max-w-55 self-center normal-case">{error}</div>}
          <NavButton className="w-full" type="submit">{t('login.login')}</NavButton>
        </div>

        <div className="flex items-center gap-2 py-5 text-sm opacity-70">
          <div className="h-px flex-1 bg-current/20" />
          {t('login.or')}
          <div className="h-px flex-1 bg-current/20" />
        </div>

        {/* Full page navigation, not fetch: OAuth needs the browser to follow redirects to GitHub and back */}
        <NavButton
          className="w-full"
          type="button"
          onClick={() => { window.location.href = '/api/auth/github' }}
        >
          {t('login.loginWithGithub')}
        </NavButton>

        <div className="mt-6 text-center text-sm">
          <button
            type="button"
            className="underline font-medium cursor-pointer bg-transparent border-0 p-0 text-inherit"
            onClick={() => setRegisterView(true)}
          >
            {t('login.notRegisteredYet')}
          </button>
        </div>
      </Modal>}
      {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
  )
}
