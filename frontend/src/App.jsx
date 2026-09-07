import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'
import LobbyView from './components/LobbyView.jsx'
import LoginView from './components/LoginView.jsx'

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const loggedIn = Boolean(token)

  useEffect(() => {
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
      {!playMode && <div className="Tagline"></div>}
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
