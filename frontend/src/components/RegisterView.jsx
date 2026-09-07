import { useState } from 'react'
import { register } from '../auth.js'

function ValidateRegister({ message, onContinue }) {
  return (
    <div className="RegisterView">
      {message}
      <button className="FormButton" onClick={onContinue}>Continue!</button>
    </div>
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
      {!submitted && <form className="RegisterView" onSubmit={handleSubmit}>
        <button type="button" className="CloseButton" onClick={() => setRegisterView(false)}>x</button>
        <input className="inputbox" type="text" placeholder="Set username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="inputbox" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="inputbox" type="password" placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="inputbox" type="password" placeholder="Type password again" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        {error && <div className="FormError">{error}</div>}
        <button type="submit" className="FormButton">Submit</button>
      </form>}
      {submitted && <ValidateRegister message="Registration successful!" onContinue={() => setRegisterView(false)} />}
    </>
  )
}
