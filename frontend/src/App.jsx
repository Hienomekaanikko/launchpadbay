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
import useSocket, { sendMessage, useCloseCode } from './useSocket.js'
import usePresence from './usePresence.js'
import useFriends from './useFriends.js'
import useSessions from './useSessions.js'
import useSessionJoin from './useSessionJoin.js'
import useChat from './useChat.js'
import JoinRequestPopup from './components/JoinRequestPopup.jsx'
import UserProfilePopup from './components/UserProfilePopup.jsx'
import PolicyDialog from './components/PoliciesDialog.jsx'
import AlreadyOpenNotice from './components/AlreadyOpenNotice.jsx'

function App() {
  const { t } = useTranslation()

  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
  const [username, setUsername] = useState(() => localStorage.getItem('username'));
  const [lobbyMode, setLobbyMode] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [viewedUser, setViewedUser] = useState(null) // { id, username } whose profile popup is open
  const loggedIn = Boolean(token)
  const { socket, reconnecting } = useSocket(token)
  const closeCode = useCloseCode(socket)
  const onlineUsers = usePresence(socket).filter((user) => user.id !== userId)
  const join = useSessionJoin(socket)
  const { activeSession } = join
  const chat = useChat(socket, userId, activeSession)
  // our join request and its rejection are local state, so server updates to the list can't overwrite them
  const sessions = useSessions(socket).map((session) => {
    if (session.id === join.pendingSessionId) return { ...session, status: 'pending' }
    if (session.id === join.rejection?.sessionId) return { ...session, rejectedReason: join.rejection.reason }
    return session
  })
  // only show who we're playing with while they're actually still in the session
  const partner = sessions.find((session) => session.id === activeSession)?.current > 1 ? join.partner : null
  const friendsState = useFriends(token)
  const isOnline = (id) => onlineUsers.some((user) => user.id === id && user.online)
  const friendsWithStatus = friendsState.friends.map((friend) => ({ ...friend, online: isOnline(friend.id) }))
  const chatRecipientOnline = isOnline(chat.activeChat?.id)
  const [openPolicy, setOpenPolicy] = useState(null)

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

  const handleLoggedIn = (newToken, newUserId, newUsername) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('userId', newUserId)
    localStorage.setItem('username', newUsername)
    setToken(newToken)
    setUserId(newUserId)
    setUsername(newUsername)
  }

  // OAuth callback lands here with #token=...&id=...&username=... (or #error=...) from the backend redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const oauthToken = params.get('token')
    const oauthUserId = params.get('id')
    const oauthUsername = params.get('username')
    const oauthError = params.get('error')

    if (oauthToken && oauthUserId && oauthUsername) {
      handleLoggedIn(oauthToken, oauthUserId, oauthUsername)
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
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    setToken(null)
    setUserId(null)
    setUsername(null)
    setProfileMode(false)
    setLobbyMode(false)
    setViewedUser(null)
  }

  // the server refused our token (expired or invalid): reconnecting can't help, log out
  useEffect(() => {
    if (closeCode === 4001) handleLogout()
  }, [closeCode])

  // logged in before user ids were stored: log in again to get one.
  // Reads localStorage, since the OAuth effect above may have just logged us in
  useEffect(() => {
    if (localStorage.getItem('token') && !localStorage.getItem('userId')) handleLogout()
  }, [])

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

  const inList = (list, id) => list.some((user) => user.id === id)

  // hide the add button for existing friends and requests we've already sent
  const canAddFriend = (id) =>
    !inList(friendsState.friends, id) && !inList(friendsState.outgoing, id)

  // if they already sent us a request, adding them just accepts it
  const handleAddFriendClick = (other) => {
    if (inList(friendsState.incoming, other.id)) friendsState.accept(other)
    else friendsState.add(other)
  }

  const friendStatusOf = (id) => {
    if (inList(friendsState.friends, id)) return 'friend'
    if (inList(friendsState.incoming, id)) return 'incoming'
    if (inList(friendsState.outgoing, id)) return 'outgoing'
    return 'none'
  }

  // the friend lists are only fetched on demand, so refresh them for an up-to-date button
  const handleProfileClick = (other) => {
    friendsState.refresh()
    setViewedUser(other)
  }

  const handleProfileChatClick = (other) => {
    setViewedUser(null)
    chat.openChat(other)
  }

  return (
    <>
      <AppNavbar
        playMode={playMode}
        loggedIn={loggedIn}
        username={username}
        sessionId={activeSession}
        partner={partner}
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
              inSession={Boolean(activeSession)}
              onAccountDeleted={handleLogout}
              friends={friendsWithStatus}
              incoming={friendsState.incoming}
              unread={chat.unread}
              onProfileClick={handleProfileClick}
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
              onProfileClick={handleProfileClick}
              onChatClick={chat.openChat}
              sessionMessages={chat.sessionMessages}
              onSendSessionMessage={chat.sendSession}
            />}
          </div>
        )}
        {playMode && <LaunchpadView socket={socket} activeSession={activeSession} />}
        {join.incomingRequest && (
          <JoinRequestPopup
            username={join.incomingRequest.from.name}
            onAcceptClick={handleAcceptJoin}
            onRejectClick={join.rejectRequest}
          />
        )}
        {loggedIn && viewedUser && (
          <UserProfilePopup
            token={token}
            userId={viewedUser.id}
            online={isOnline(viewedUser.id)}
            friendStatus={friendStatusOf(viewedUser.id)}
            onAddFriendClick={handleAddFriendClick}
            onRemoveClick={friendsState.remove}
            onChatClick={handleProfileChatClick}
            onClose={() => setViewedUser(null)}
          />
        )}
        {chat.activeChat && (
          <ChatWindow
            recipient={chat.activeChat.username}
            recipientOnline={chatRecipientOnline}
            messages={chat.conversations[chat.activeChat.id] || []}
            error={chat.error}
            onSendMessage={(text) => chat.sendPrivate(chat.activeChat.id, text)}
            onClose={chat.closeChat}
          />
        )}
        {closeCode === 1008 && <AlreadyOpenNotice />}
        {reconnecting && (
          <div role="status" className="fixed top-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-white text-xs">
            {t('common.reconnecting')}
          </div>
        )}
        {/* someone joined or left our session; the reconnecting notice takes the spot if both are up */}
        {chat.sessionNotice && !reconnecting && (
          <div role="status" className="fixed top-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-white text-xs">
            {t(`session.${chat.sessionNotice.system}`, { username: chat.sessionNotice.username })}
          </div>
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
