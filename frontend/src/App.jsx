import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'
import { login, register } from './auth.js'

function LobbyView() {
  return (
    <div className="Lobby">
      <div>Live data of who is currently playing</div>
      <div>Open a chat with anyone</div>
      <div>Join anyones session or observe</div>
    </div>
  )
}

function ValidateRegister({ message, onContinue }) {
  return (
    <div className="RegisterView">
      {message}
      <button className="FormButton" onClick={onContinue}>Continue!</button>
    </div>
  )
}

function RegisterView({ setRegisterView }) {
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

function LoginView({ onLoggedIn, setShowLogin }) {
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

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const loggedIn = Boolean(token)

  useEffect(() => {
    // LaunchpadView/engine.js takes ownership of the body background while
    // playing and clears it on unmount, at which point playMode flips back
    // to false and this re-applies the landing background.
    if (!playMode) {
      document.body.style.backgroundImage = `url(${landing})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundRepeat = 'no-repeat'
    }
  }, [playMode])

  const handleLoggedIn = (newToken, newUsername) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('username', newUsername)
    setToken(newToken)
    setUsername(newUsername)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setUsername(null)
  }

  return (
    <>
      <header>
        {!playMode && <div className="Logo">
          LaunchpadBay
        </div>}
        {loggedIn && <div className="UserTag">Logged in as: {username}</div>}
        <nav>
          {!playMode && <button className="NavButton" onClick={() => setPlayMode(true)}>Play</button>}
          {!playMode && <button className="NavButton" onClick={() => (loggedIn ? handleLogout() : setShowLogin(true))}>{loggedIn ? 'Logout' : 'Login'}</button>}
        </nav>
      </header>
      {!playMode && <div className="Tagline">JAM WITH EASE</div>}
      <main>
          {showLogin && !playMode &&
          <LoginView
            onLoggedIn={handleLoggedIn}
            setShowLogin={setShowLogin}
            />}
          {loggedIn && <button
                        className="Lobbybutton"
                        onClick={() => setLobbyMode(!lobbyMode)}>{lobbyMode ? 'Hide' : 'Lobby'}</button>}
          {lobbyMode && <LobbyView />}
          {playMode && <LaunchpadView onBack={() => setPlayMode(false)} />}
      </main>
      <footer>
        {!playMode && <button className="FooterLink"> Terms & Conditions </button>}
      </footer>
    </>
  )
}

export default App
