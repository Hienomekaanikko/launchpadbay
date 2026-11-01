import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateServerError } from '../i18n/serverErrors.js'
import { register } from '../auth.js'
import Modal from './Modal.jsx'
import Input from './Input.jsx'
import NavButton from './NavButton.jsx'
import PolicyDialog from './PoliciesDialog.jsx'

const modalClass = 'z-11 w-[min(90vw,24rem)] items-stretch gap-0 bg-surface/30 text-white uppercase'
const fieldClass = 'w-full normal-case'
const labelClass = 'mb-2 text-sm font-medium inline-block uppercase'

function ValidateRegister({ message, onContinue, onDismiss }) {
  const { t } = useTranslation()
  return (
    <Modal className={modalClass} onClose={onDismiss}>
      <p className="text-center text-sm normal-case">{message}</p>
      <NavButton className="w-full" onClick={onContinue}>{t('register.continue')}</NavButton>
    </Modal>
  )
}

export default function RegisterView({ setRegisterView, setShowLogin }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [openPolicy, setOpenPolicy] = useState(null)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t('common.fieldsRequired'))
      return
    }

    if (!acceptedTerms) {
      setError(t('register.termsRequired'))
      return
    }

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

  const dismissAuth = () => {
    if (openPolicy) return
    setShowLogin(false)
  }

  return (
    <>
      {!submitted && <Modal as="form" className={modalClass} onClose={dismissAuth} onSubmit={handleSubmit}>
        <h1 className="text-center text-xl font-semibold mb-6">{t('register.title')}</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="register-username" className={labelClass}>{t('register.username')}</label>
            <Input id="register-username" className={fieldClass} type="text" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label htmlFor="register-email" className={labelClass}>{t('register.email')}</label>
            <Input id="register-email" className={fieldClass} type="email" placeholder="name@launchpad.bay" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="register-password" className={labelClass}>{t('register.password')}</label>
            <Input id="register-password" className={fieldClass} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="register-confirm" className={labelClass}>{t('register.confirmPassword')}</label>
            <Input id="register-confirm" className={fieldClass} type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <label htmlFor="register-terms" className="flex items-start gap-2 text-sm font-medium normal-case cursor-pointer">
            <input
              id="register-terms"
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-brand"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>
              {t('register.acceptTerms')}{' '}
              <button
                type="button"
                className="underline font-medium cursor-pointer bg-transparent border-0 p-0 text-inherit"
                onClick={() => setOpenPolicy('service')}
              >
                {t('policies.service.title')}
              </button>
            </span>
          </label>
          {error && (
            <div
              role="alert"
              className="w-full rounded-md border px-3 py-2 text-sm text-center normal-case text-red-800"
            >
              {error}
            </div>
          )}
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
      {submitted && (
        <ValidateRegister
          message={t('register.success')}
          onContinue={() => setRegisterView(false)}
          onDismiss={() => setShowLogin(false)}
        />
      )}
      {openPolicy && (
        <PolicyDialog
          kind={openPolicy}
          onClose={() => setOpenPolicy(null)}
        />
      )}
    </>
  )
}
