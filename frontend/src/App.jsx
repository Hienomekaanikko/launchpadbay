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
import useSocket, { sendMessage } from './useSocket.js'
import usePresence from './usePresence.js'
import useFriends from './useFriends.js'
import useSessions from './useSessions.js'
import useSessionJoin from './useSessionJoin.js'
import JoinRequestPopup from './components/JoinRequestPopup.jsx'

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState({});
  const [sessionMessages, setSessionMessages] = useState([]);
  const loggedIn = Boolean(token)
  const socket = useSocket(token)
  const onlineUsers = usePresence(socket).filter((user) => user.username !== username)
  const join = useSessionJoin(socket)
  const { activeSession } = join
  // our join request and its rejection are local state, so server updates to the list can't overwrite them
  const sessions = useSessions(socket).map((session) => {
    if (session.id === join.pendingSessionId) return { ...session, status: 'pending' }
    if (session.id === join.rejection?.sessionId) return { ...session, rejectedReason: join.rejection.reason }
    return session
  })
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

  // accepted into a session (guest) or hosting one: make sure the launchpad is open
  useEffect(() => {
    if (activeSession) setPlayMode(true)
  }, [activeSession])

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

  // logged in, Play also hosts a new session that shows up in everyone's lobby.
  // The backend drops a pending join request on create, so we drop ours too
  const handlePlayClick = () => {
    if (join.pendingSessionId) join.cancelJoin()
    if (loggedIn) sendMessage(socket, { type: 'session_create' })
    setPlayMode(true)
  }

  const handleHome = () => {
    join.leave()
    setPlayMode(false)
    setLobbyMode(false)
    setProfileMode(false)
    setActiveChat(null)
    setShowLogin(false)
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
            <NavButton onClick={handlePlayClick}>Play</NavButton>
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
                              onJoinClick={join.requestJoin}
                              onCancelClick={join.cancelJoin}
                              onChatClick={handleChatClick}
                              sessionMessages={sessionMessages}
                              onSendSessionMessage={handleSendSessionMessage}
            />}
          </div>
        )}
        {playMode && <LaunchpadView />}
        {join.incomingRequest && (
          <JoinRequestPopup
            username={join.incomingRequest.from.name}
            onAcceptClick={join.acceptRequest}
            onRejectClick={join.rejectRequest}
          />
        )}
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
