import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'
import LobbyView from './components/LobbyView.jsx'
import LoginView from './components/LoginView.jsx'
import ProfileView from './components/ProfileView.jsx'
import NavButton from './components/NavButton.jsx'
import AppNavbar from './components/AppNavbar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import usePresence from './usePresence.js'
import useFriends from './useFriends.js'

const INITIAL_SESSIONS = [
  { id: 'session1', current: 1, max: 2, status: 'open' },
  { id: 'session2', current: 2, max: 2, status: 'open' },
  { id: 'session3', current: 1, max: 2, status: 'open' },
]

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState({});
  const [sessionMessages, setSessionMessages] = useState([]);
  const loggedIn = Boolean(token)
  const onlineUsers = usePresence(token).filter((user) => user.username !== username)
  const friendsState = useFriends(token)
  const friendsWithStatus = friendsState.friends.map((friend) => ({
    username: friend,
    online: onlineUsers.some((user) => user.username === friend && user.online),
  }))

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

  // OAuth callback lands here with #token=...&username=... (or #error=...) from the backend redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const oauthToken = params.get('token')
    const oauthUsername = params.get('username')
    const oauthError = params.get('error')

    if (oauthToken && oauthUsername) {
      handleLoggedIn(oauthToken, oauthUsername)
    } else if (oauthError) {
      setLoginError(oauthError)
      setShowLogin(true)
    } else {
      return
    }
    // Drop #token from the URL bar and Back history
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const handleOpenLogin = () => {
    setLoginError('')
    setShowLogin(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setUsername(null)
    setProfileMode(false)
    setLobbyMode(false)
    setActiveChat(null)
    setConversations({})
    setSessionMessages([])
  }

  const handleSessionJoined = (sessionId) => {
    setActiveSession(sessionId)
    setPlayMode(true)
  }

  const handleHome = () => {
    setPlayMode(false)
    setActiveSession(null)
    setLobbyMode(false)
    setProfileMode(false)
    setActiveChat(null)
    setShowLogin(false)
  }

  const handleJoinClick = (sessionId) => {
    setSessions((prev) => prev.map((session) =>
      session.id === sessionId ? { ...session, status: 'pending' } : session
    ))

    // stand-in for a real "session accepted" event arriving over the
    // websocket and then this setTimeout goes away entirely
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

  // hide the add button for existing friends and requests we've already sent
  const canAddFriend = (other) =>
    !friendsState.friends.includes(other) && !friendsState.outgoing.includes(other)

  // if they already sent us a request, adding them just accepts it
  const handleAddFriendClick = (other) => {
    if (friendsState.incoming.includes(other)) friendsState.accept(other)
    else friendsState.add(other)
  }

  // local-only for now: appends the message straight to state. Once the
  // webSocket exists, this becomes "send over the socket" instead, and a
  // socket message handler calls setConversations the same way incoming
  // messages do. ChatWindow itself won't need to change.
  const handleSendMessage = (username, text) => {
    setConversations((prev) => ({
      ...prev,
      [username]: [...(prev[username] || []), { id: crypto.randomUUID(), text, fromMe: true }],
    }))
  }

  // local-only stand-in as handleSendMessage above — once the
  // WebSocket exists, this sends to the session's room instead, and a
  // socket handler appends incoming messages from the other participants.
  const handleSendSessionMessage = (text) => {
    setSessionMessages((prev) => [...prev, { id: crypto.randomUUID(), text, fromMe: true }])
  }

  return (
    <>
      <AppNavbar
        playMode={playMode}
        loggedIn={loggedIn}
        username={username}
        sessionId={activeSession}
        lobbyOpen={lobbyMode}
        profileOpen={profileMode}
        onHome={handleHome}
        onLobby={() => setLobbyMode((open) => !open)}
        onProfile={() => setProfileMode((open) => !open)}
      />
      <main className={`app-main${playMode ? ' app-main-play' : ''}`}>
        {!playMode && (
          <div className="flex flex-wrap justify-center gap-4 px-4 py-8">
            <NavButton onClick={() => setPlayMode(true)}>Play</NavButton>
            <NavButton onClick={loggedIn ? handleLogout : handleOpenLogin}>
              {loggedIn ? 'Logout' : 'Login'}
            </NavButton>
          </div>
        )}
        {showLogin && !playMode &&
          <LoginView
            onLoggedIn={handleLoggedIn}
            setShowLogin={setShowLogin}
            initialError={loginError}
          />}
        {(lobbyMode || (profileMode && loggedIn)) && (
          <div className="app-panels">
            {profileMode && loggedIn && <ProfileView
                                            token={token}
                                            friends={friendsWithStatus}
                                            incoming={friendsState.incoming}
                                            onChatClick={handleChatClick}
                                            onAcceptClick={friendsState.accept}
                                            onRejectClick={friendsState.reject}
                                            onRemoveClick={friendsState.remove}
                                            onFriendsOpen={friendsState.refresh}
                                          />}
            {lobbyMode && <LobbyView
                              activeSession={activeSession}
                              online={onlineUsers}
                              canAddFriend={canAddFriend}
                              onAddFriendClick={handleAddFriendClick}
                              sessions={sessions}
                              onJoinClick={handleJoinClick}
                              onCancelClick={handleCancelClick}
                              onChatClick={handleChatClick}
                              sessionMessages={sessionMessages}
                              onSendSessionMessage={handleSendSessionMessage}
            />}
          </div>
        )}
        {playMode && <LaunchpadView />}
        {activeChat && (
          <ChatWindow
            recipient={activeChat}
            messages={conversations[activeChat] || []}
            onSendMessage={(text) => handleSendMessage(activeChat, text)}
            onClose={() => setActiveChat(null)}
          />
        )}
      </main>
      {!playMode && (
        <footer>
          <button className="bg-transparent text-white/40 text-xs tracking-nav font-sans cursor-pointer no-underline transition-colors hover:text-white/80 hover:underline">
            Terms & Conditions
          </button>
        </footer>
      )}
    </>
  )
}

export default App
