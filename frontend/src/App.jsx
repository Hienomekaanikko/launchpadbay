import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'
import LobbyView from './components/LobbyView.jsx'
import LoginView from './components/LoginView.jsx'
import ProfileView from './components/ProfileView.jsx'
import NavButton from './components/NavButton.jsx'
import Tag from './components/Tag.jsx'
import ChatWindow from './components/ChatWindow.jsx'

const INITIAL_SESSIONS = [
  { id: 'session1', current: 1, max: 2, status: 'open' },
  { id: 'session2', current: 2, max: 2, status: 'open' },
  { id: 'session3', current: 1, max: 2, status: 'open' },
]

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState({});
  const [sessionMessages, setSessionMessages] = useState([]);
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

  const handleSessionJoined = (sessionId) => {
    setActiveSession(sessionId)
    setPlayMode(true)
  }

  const handleBackFromPlay = () => {
    setPlayMode(false)
    setActiveSession(null)
  }

  const handleJoinClick = (sessionId) => {
    setSessions((prev) => prev.map((session) =>
      session.id === sessionId ? { ...session, status: 'pending' } : session
    ))

    // Stand-in for a real "session accepted" event arriving over the
    // WebSocket. Once that exists, this setTimeout goes away entirely —
    // a socket message handler does this same status reset and calls
    // handleSessionJoined(sessionId) instead, whenever the server actually says yes.
    setTimeout(() => {
      setSessions((prev) => prev.map((session) =>
        session.id === sessionId ? { ...session, status: 'open' } : session
      ))
      handleSessionJoined(sessionId)
    }, 3000)
  }

  const handleCancelClick = (sessionId) => {
    setSessions((prev) => prev.map((session) =>
      session.id === sessionId ? { ...session, status: 'open' } : session
    ))
  }

  const handleChatClick = (username) => {
    setActiveChat(username)
  }

  // Local-only for now: appends the message straight to state. Once the
  // WebSocket exists, this becomes "send over the socket" instead, and a
  // socket message handler calls setConversations the same way incoming
  // messages do — ChatWindow itself won't need to change either way.
  const handleSendMessage = (username, text) => {
    setConversations((prev) => ({
      ...prev,
      [username]: [...(prev[username] || []), { id: crypto.randomUUID(), text, fromMe: true }],
    }))
  }

  // Same local-only stand-in as handleSendMessage above — once the
  // WebSocket exists, this sends to the session's room instead, and a
  // socket handler appends incoming messages from the other participant(s).
  const handleSendSessionMessage = (text) => {
    setSessionMessages((prev) => [...prev, { id: crypto.randomUUID(), text, fromMe: true }])
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
          {lobbyMode && <LobbyView
                          activeSession={activeSession}
                          sessions={sessions}
                          onJoinClick={handleJoinClick}
                          onCancelClick={handleCancelClick}
                          onChatClick={handleChatClick}
                          sessionMessages={sessionMessages}
                          onSendSessionMessage={handleSendSessionMessage}
                        />}
          {profileMode && loggedIn && <ProfileView token={token} onChatClick={handleChatClick} />}
          {playMode && <LaunchpadView sessionId={activeSession} onBack={handleBackFromPlay} />}
          {activeChat && (
            <ChatWindow
              recipient={activeChat}
              messages={conversations[activeChat] || []}
              onSendMessage={(text) => handleSendMessage(activeChat, text)}
              onClose={() => setActiveChat(null)}
            />
          )}
      </main>
      <footer>
        {!playMode && <button className="bg-transparent text-white/40 text-xs tracking-nav font-sans cursor-pointer no-underline transition-colors hover:text-white/80 hover:underline"> Terms & Conditions </button>}
      </footer>
    </>
  )
}

export default App
