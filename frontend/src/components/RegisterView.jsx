import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { register } from '../auth.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'

function ValidateRegister({ message, onContinue }) {
  const { t } = useTranslation()
  return (
    <Modal className="z-11">
      {message}
      <FormButton onClick={onContinue}>{t('register.continue')}</FormButton>
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
      setError(err.message)
    }
  }

  return (
    <>
      {!submitted && <Modal as="form" className="z-11" onSubmit={handleSubmit}>
        <CloseButton onClick={() => setRegisterView(false)}>x</CloseButton>
        <Input type="text" placeholder={t('register.username')} value={username} onChange={(e) => setUsername(e.target.value)} required />
        <Input type="email" placeholder={t('register.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder={t('register.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input type="password" placeholder={t('register.confirmPassword')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        {error && <div className="text-error text-xs text-center max-w-55">{error}</div>}
        <FormButton type="submit">{t('register.submit')}</FormButton>
      </Modal>}
      {submitted && <ValidateRegister message={t('register.success')} onContinue={() => setRegisterView(false)} />}
    </>
  )
}
