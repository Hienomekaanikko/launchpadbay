import { useState } from 'react'
import { login } from '../auth.js'
import RegisterView from './RegisterView.jsx'

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
      {!registerView && <form className="LoginView" onSubmit={handleSubmit}>
        <button type="button" className="CloseButton" onClick={() => setShowLogin(false)}>x</button>
        <input className="inputbox" type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="inputbox" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="FormError">{error}</div>}
        <button type="submit" className="FormButton">Login</button>
        <button type="button" className="FormButton" onClick={() => setRegisterView(true)}>Not registered yet?</button>
      </form>}
       {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
  )
}
