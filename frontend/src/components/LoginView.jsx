import { useState } from 'react'
import { login } from '../auth.js'
import RegisterView from './RegisterView.jsx'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'
import Input from './Input.jsx'
import FormButton from './FormButton.jsx'

export default function LoginView({ onLoggedIn, setShowLogin }) {
  const [registerView, setRegisterView] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const { token } = await login(username, password)
      onLoggedIn(token, username)
      setShowLogin(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {!registerView && <Modal as="form" className="z-10" onSubmit={handleSubmit}>
        <CloseButton onClick={() => setShowLogin(false)}>x</CloseButton>
        <Input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="text-error text-xs text-center max-w-55">{error}</div>}
        <FormButton type="submit">Login</FormButton>
        <FormButton type="button" onClick={() => setRegisterView(true)}>Not registered yet?</FormButton>
      </Modal>}
       {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
  )
}
