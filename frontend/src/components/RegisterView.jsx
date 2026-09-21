import { useState } from 'react'
import { register } from '../auth.js'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'

function ValidateRegister({ message, onContinue }) {
  return (
    <Modal className="z-11">
      {message}
      <FormButton onClick={onContinue}>Continue!</FormButton>
    </Modal>
  )
}

export default function RegisterView({ setRegisterView }) {
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
      setError('Passwords do not match')
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
        <Input type="text" placeholder="Set username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input type="password" placeholder="Type password again" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        {error && <div className="text-error text-xs text-center max-w-55">{error}</div>}
        <FormButton type="submit">Submit</FormButton>
      </Modal>}
      {submitted && <ValidateRegister message="Registration successful!" onContinue={() => setRegisterView(false)} />}
    </>
  )
}
