import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import useChat from './useChat.js'
import JoinRequestPopup from './components/JoinRequestPopup.jsx'
import PolicyDialog from './components/PoliciesDialog.jsx'
import { useTranslation } from 'react-i18next'

function App() {
  const { t } = useTranslation()

  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const loggedIn = Boolean(token)
  const socket = useSocket(token)
  const onlineUsers = usePresence(socket).filter((user) => user.username !== username)
  const join = useSessionJoin(socket)
  const { activeSession } = join
  const chat = useChat(socket, username, activeSession)
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
  const [openPolicy, setOpenPolicy] = useState(null)
  const { t } = useTranslation();

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
    chat.closeChat()
    setShowLogin(false)
  }

  // a new player joins our session: their session chat starts empty, so ours does too
  const handleAcceptJoin = () => {
    chat.clearSessionChat()
    join.acceptRequest()
  }

  // hide the add button for existing friends and requests we've already sent
  const canAddFriend = (other) =>
    !friendsState.friends.includes(other) && !friendsState.outgoing.includes(other)

  // if they already sent us a request, adding them just accepts it
  const handleAddFriendClick = (other) => {
    if (friendsState.incoming.includes(other)) friendsState.accept(other)
    else friendsState.add(other)
  }

  return (
    <>
      <AppNavbar
        playMode={playMode}
        loggedIn={loggedIn}
        username={username}
        sessionId={activeSession}
        hasUnread={chat.unread.length > 0}
        lobbyOpen={lobbyMode}
        profileOpen={profileMode}
        onHome={handleHome}
        onLobby={() => setLobbyMode((open) => !open)}
        onProfile={() => setProfileMode((open) => !open)}
      />
      <main className={`app-main${playMode ? ' app-main-play' : ''}`}>
        {!playMode && (
          <div className="flex flex-wrap justify-center gap-4 px-4 py-8">
            <NavButton onClick={handlePlayClick}>{t('nav.play')}</NavButton>
            <NavButton onClick={loggedIn ? handleLogout : handleOpenLogin}>
              {loggedIn ? t('nav.logout') : t('nav.login')}
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
              unread={chat.unread}
              onChatClick={chat.openChat}
              onAcceptClick={friendsState.accept}
              onRejectClick={friendsState.reject}
              onRemoveClick={friendsState.remove}
              onFriendsOpen={friendsState.refresh}
            />}
            {lobbyMode && <LobbyView
              activeSession={activeSession}
              online={onlineUsers}
              unread={chat.unread}
              canAddFriend={canAddFriend}
              onAddFriendClick={handleAddFriendClick}
              sessions={sessions}
              onJoinClick={join.requestJoin}
              onCancelClick={join.cancelJoin}
              onChatClick={chat.openChat}
              sessionMessages={chat.sessionMessages}
              onSendSessionMessage={chat.sendSession}
            />}
          </div>
        )}
        {playMode && <LaunchpadView />}
        {join.incomingRequest && (
          <JoinRequestPopup
            username={join.incomingRequest.from.name}
            onAcceptClick={handleAcceptJoin}
            onRejectClick={join.rejectRequest}
          />
        )}
        {chat.activeChat && (
          <ChatWindow
            recipient={chat.activeChat}
            messages={chat.conversations[chat.activeChat] || []}
            error={chat.error}
            onSendMessage={(text) => chat.sendPrivate(chat.activeChat, text)}
            onClose={chat.closeChat}
          />
        )}
      </main>
      <footer className="flex-wrap gap-6 px-4 py-6">
        <button
          type="button"
          onClick={() => setOpenPolicy('privacy')}
          className="cursor-pointer text-sm text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300"
        >
          {t('policies.privacy.title')}
        </button>

        <button
          type="button"
          onClick={() => setOpenPolicy('service')}
          className="cursor-pointer text-sm text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300"
        >
          {t('policies.service.title')}
        </button>
      </footer>

      {openPolicy && (
        <PolicyDialog
          kind={openPolicy}
          onClose={() => setOpenPolicy(null)}
        />
      )}

    </>
  )
}

export default App
