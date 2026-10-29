import { useState } from 'react'
import { login } from '../auth.js'
import RegisterView from './RegisterView.jsx'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'
import { useTranslation } from 'react-i18next'

export default function LoginView({ onLoggedIn, setShowLogin, initialError = '' }) {
  const [registerView, setRegisterView] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const result = await login(email, password)
      onLoggedIn(result.token, result.username)
      setShowLogin(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {!registerView && <Modal as="form" className="z-10 text-black" onSubmit={handleSubmit}>
        <CloseButton className="text-black" onClick={() => setShowLogin(false)}>x</CloseButton>

        <Input className="text-black placeholder:text-black placeholder:text-shadow:none" type="email" placeholder={t('login.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input className="text-black placeholder:text-black placeholder:text-shadow:none" type="password" placeholder={t('login.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="text-xs text-center max-w-55">{error}</div>}
        <FormButton className="text-black" type="submit">{t('login.login')}</FormButton>
        {/* Full page navigation, not fetch: OAuth needs the browser to follow redirects to GitHub and back */}
        <FormButton className="text-black" type="button" onClick={() => { window.location.href = '/api/auth/github' }}>
          {t('login.loginWithGithub')}
        </FormButton>
        <FormButton className="text-black" type="button" onClick={() => setRegisterView(true)}>{t('login.notRegisteredYet')}</FormButton>
      </Modal>}
       {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
  )
}
