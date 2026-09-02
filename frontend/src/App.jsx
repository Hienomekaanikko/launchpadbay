import { useState } from 'react'
import './App.css'

function LobbyView() {
  return (
    <div className="Lobby">
      <div>Live data of who is currently playing</div>
      <div>Open a chat with anyone</div>
      <div>Join anyones session or observe</div>
    </div>
  )
}

function LoginView({ onClose, setLoggedIn }) {
  return (
    <div className="LoginView">
      <button onClick={onClose}>x</button>
      <input type="text" placeholder="Username" />
      <input type="password" placeholder="Password" />
      <button onClick={()=> {setLoggedIn(true); onClose()}}>Login</button>
      <button>Not registered?</button>
    </div>
  )
}

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [lobbyMode, setLobbyMode] = useState(false);

  return (
    <>
      <header>
        <nav>
          <button onClick={() => setPlayMode(!playMode)}>{playMode ? 'Home' : 'Play'}</button>
          <button onClick={() => {setShowLogin(!loggedIn); loggedIn && setLoggedIn(false)}}>{loggedIn ? 'Logout' : 'Login'}</button>
        </nav>
      </header>
      <main>
          {showLogin && 
          <LoginView 
            onClose={() => setShowLogin(false)}
            setLoggedIn={setLoggedIn}
            />}
          {loggedIn && <button 
                        className="Lobbybutton"
                        onClick={() => setLobbyMode(!lobbyMode)}>{lobbyMode ? 'Hide' : 'Lobby'}</button>}
          {lobbyMode && <LobbyView />}
      </main>
      <footer>
        <button>
          Terms & Conditions
        </button>
      </footer>
    </>
  )
}

export default App
