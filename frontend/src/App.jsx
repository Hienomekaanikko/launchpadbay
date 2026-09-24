import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'
import LobbyView from './components/LobbyView.jsx'
import LoginView from './components/LoginView.jsx'
import ProfileView from './components/ProfileView.jsx'
import NavButton from './components/NavButton.jsx'
import Tag from './components/Tag.jsx'

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
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
    setProfileMode(false)
  }

  return (
    <>
      <header>
        {!playMode && <div className="fixed top-12.5 left-12.5 font-display font-extrabold text-base tracking-[0.1px] uppercase text-white/30 pointer-events-none select-none">
          LaunchpadBay
        </div>}
        {loggedIn && <Tag className="fixed top-12.5 right-12.5 z-20" onClick={() => setProfileMode(!profileMode)}>{username}</Tag>}
        {!playMode && <nav>
          <NavButton onClick={() => setPlayMode(true)}>Play</NavButton>
          <NavButton onClick={() => (loggedIn ? handleLogout() : setShowLogin(true))}>{loggedIn ? 'Logout' : 'Login'}</NavButton>
        </nav>}
      </header>
      {!playMode && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 font-display font-extrabold text-5xl leading-[1.1] text-center uppercase text-white/10 whitespace-pre-line pointer-events-none select-none"></div>}
      <main>
          {showLogin && !playMode &&
          <LoginView
            onLoggedIn={handleLoggedIn}
            setShowLogin={setShowLogin}
            />}
          {loggedIn && <NavButton
                        className="fixed bottom-6 right-7.5 w-28"
                        onClick={() => setLobbyMode(!lobbyMode)}>{lobbyMode ? 'Hide' : 'Lobby'}</NavButton>}
          {lobbyMode && <LobbyView />}
          {profileMode && loggedIn && <ProfileView token={token} />}
          {playMode && <LaunchpadView onBack={() => setPlayMode(false)} />}
      </main>
      <footer>
        {!playMode && <button className="bg-transparent text-white/40 text-xs tracking-nav font-sans cursor-pointer no-underline transition-colors hover:text-white/80 hover:underline"> Terms & Conditions </button>}
      </footer>
    </>
  )
}

export default App
