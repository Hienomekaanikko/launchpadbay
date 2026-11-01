import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { register } from '../auth.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import NavButton from './NavButton.jsx'

const modalClass = 'z-11 w-[min(90vw,24rem)] items-stretch gap-0 bg-surface/30 text-white uppercase'
const fieldClass = 'w-full normal-case'
const labelClass = 'mb-2 text-sm font-medium inline-block uppercase'

function ValidateRegister({ message, onContinue }) {
  const { t } = useTranslation()
  return (
    <Modal className={modalClass}>
      <p className="text-center text-sm normal-case">{message}</p>
      <NavButton className="w-full" onClick={onContinue}>{t('register.continue')}</NavButton>
    </Modal>
  )
}

export default function RegisterView({ setRegisterView }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'))
      return
    }

    try {
      await register(username, email, password)
      setSubmitted(true)
    } catch (err) {
      setError(translateServerError(t, err))
    }
  }

  return (
    <>
      {!submitted && <Modal as="form" className={modalClass} onSubmit={handleSubmit}>
        <CloseButton className="normal-case" onClick={() => setRegisterView(false)}>x</CloseButton>

        <h1 className="text-center text-xl font-semibold mb-6">{t('register.title')}</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="register-username" className={labelClass}>{t('register.username')}</label>
            <Input id="register-username" className={fieldClass} type="text" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="register-email" className={labelClass}>{t('register.email')}</label>
            <Input id="register-email" className={fieldClass} type="email" placeholder="name@launchpad.bay" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="register-password" className={labelClass}>{t('register.password')}</label>
            <Input id="register-password" className={fieldClass} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="register-confirm" className={labelClass}>{t('register.confirmPassword')}</label>
            <Input id="register-confirm" className={fieldClass} type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          {error && <div className="text-error text-xs text-center max-w-55 self-center normal-case">{error}</div>}
          <NavButton className="w-full" type="submit">{t('register.submit')}</NavButton>
        </div>

        <div className="mt-6 text-center text-sm">
          <button
            type="button"
            className="underline font-medium cursor-pointer bg-transparent border-0 p-0 text-inherit"
            onClick={() => setRegisterView(false)}
          >
            {t('register.alreadyRegistered')}
          </button>
        </div>
      </Modal>}
      {submitted && <ValidateRegister message={t('register.success')} onContinue={() => setRegisterView(false)} />}
    </>
  )
}
