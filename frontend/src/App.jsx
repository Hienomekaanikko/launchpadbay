import { useState } from 'react'
import './App.css'
import bg from './assets/bg.png'

function LaunchpadButton() {
  return <button className="LaunchpadButton"></button>
}

function LaunchpadGrid() {
  return (
    <div className="container">
      {Array.from({ length: 25 }).map((_, i) => (
        <LaunchpadButton key={i} />
      ))}
    </div>
    )
}

function PlayView() {
  return (
    <div className="PlayView"
      style={{
      backgroundImage: `url(${bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
    <LaunchpadGrid />
    </div>
  )
}

function LobbyView() {
  return (
    <div className="Lobby">
      <div>Live data of who is currently playing</div>
      <div>Open a chat with anyone</div>
      <div>Join anyones session or observe</div>
    </div>
  )
}

function ValidateRegister( {checkValidated, setRegisterView} ) {
  return (
    <div className="RegisterView">
      Input/registering validation not done yet but this would say "Registering succesful! Or Failed"
      <button onClick={()=> {checkValidated(false); setRegisterView(false)}}>Continue!</button>
    </div>
  )
}

function RegisterView({ setRegisterView }) {
  const [validated, checkValidated] = useState(false)
  return (
    <>
      <div className="RegisterView">
        <button onClick={() => setRegisterView(false)}>x</button>
        <input type="text" placeholder="Set username"/>
        <input type="password" placeholder="Set password"/>
        <input type="password" placeholder="Type password again"/>
        <button onClick={() => checkValidated(true)}>Submit</button> 
      </div>
      {validated && <ValidateRegister checkValidated={checkValidated} setRegisterView={setRegisterView}/>}

    </>
  )
}

function LoginView({ setLoggedIn, setShowLogin }) {
  const [registerView, setRegisterView] = useState(false)

  return (
    <>
      <div className="LoginView">
        <button onClick={() => setShowLogin(false)}>x</button>
        <input type="text" placeholder="Username" />
        <input type="password" placeholder="Password" />
        <button onClick={()=> {setLoggedIn(true); setShowLogin(false)}}>Login</button>
        <button onClick={()=> {setRegisterView(true)}}>Not registered yet?</button>
      </div>
       {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
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
            setLoggedIn={setLoggedIn}
            setShowLogin={setShowLogin}
            />}
          {loggedIn && <button 
                        className="Lobbybutton"
                        onClick={() => setLobbyMode(!lobbyMode)}>{lobbyMode ? 'Hide' : 'Lobby'}</button>}
          {lobbyMode && <LobbyView />}
          {playMode && <PlayView />}
      </main>
      <footer>
        {!playMode && <button> Terms & Conditions </button>}
      </footer>
    </>
  )
}

export default App
