import { useState } from 'react'
import { login } from '../auth.js'
import RegisterView from './RegisterView.jsx'
import Modal from './Modal.jsx'
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

    if (!email.trim() || !password) {
      setError(t('common.fieldsRequired'))
      return
    }

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
      {!registerView && <Modal as="form" className="z-10 w-[min(90vw,24rem)] items-stretch gap-0 bg-surface/30 text-white uppercase" onClose={() => setShowLogin(false)} onSubmit={handleSubmit}>
        <h1 className="text-center text-xl font-semibold mb-6">{t('login.login')}</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className={labelClass}>{t('login.email')}</label>
            <Input id="login-email" className={fieldClass} type="email" placeholder="name@launchpad.bay" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="login-password" className={labelClass}>{t('login.password')}</label>
            <Input id="login-password" className={fieldClass} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <div
              role="alert"
              className="w-full rounded-md border px-3 py-2 text-sm text-center normal-case text-red-800"
            >
              {error}
            </div>
          )}
          <NavButton className="w-full" type="submit">{t('login.login')}</NavButton>
        </div>

        <div className="flex items-center gap-2 py-5 text-sm opacity-70">
          <div className="h-px flex-1 bg-current/20" />
          {t('login.or')}
          <div className="h-px flex-1 bg-current/20" />
        </div>

        {/* Full page navigation, not fetch: OAuth needs the browser to follow redirects to GitHub and back */}
        <NavButton
          className="w-full relative inline-flex items-center justify-center"         
          type="button"
          onClick={() => { window.location.href = '/api/auth/github' }}
        >
        <img
        src="https://www.svgrepo.com/show/512317/github-142.svg" 
        alt=""
        className="absolute left-5 h-[18px] w-[18px]"
        />
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
      {registerView && <RegisterView setRegisterView={setRegisterView} setShowLogin={setShowLogin} />}
    </>
  )
}
