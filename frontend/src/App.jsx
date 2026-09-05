import { useEffect, useState } from 'react'
import './App.css'
import LaunchpadView from './launchpad/LaunchpadView.jsx'
import landing from './assets/landing.jpg'

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
      <button className="FormButton" onClick={()=> {checkValidated(false); setRegisterView(false)}}>Continue!</button>
    </div>
  )
}

function RegisterView({ setRegisterView }) {
  const [validated, checkValidated] = useState(false)
  return (
    <>
      <div className="RegisterView">
        <button className="CloseButton" onClick={() => setRegisterView(false)}>x</button>
        <input className="inputbox" type="text" placeholder="Set username"/>
        <input className="inputbox" type="password" placeholder="Set password"/>
        <input className="inputbox" type="password" placeholder="Type password again"/>
        <button className="FormButton" onClick={() => checkValidated(true)}>Submit</button>
      </div>
      {validated && <ValidateRegister checkValidated={checkValidated} setRegisterView={setRegisterView}/>}

    </>
  )
}

function LoginView({ setLoggedIn, setShowLogin }) {
  const [registerView, setRegisterView] = useState(false)

  return (
    <>
      {!registerView && <div className="LoginView">
        <button className="CloseButton" onClick={() => setShowLogin(false)}>x</button>
        <input className="inputbox" type="text" placeholder="Username" />
        <input className="inputbox" type="password" placeholder="Password" />
        <button className="FormButton" onClick={()=> {setLoggedIn(true); setShowLogin(false)}}>Login</button>
        <button className="FormButton" onClick={()=> {setRegisterView(true)}}>Not registered yet?</button>
      </div>}
       {registerView && <RegisterView setRegisterView={setRegisterView} />}
    </>
  )
}

function App() {
  const [playMode, setPlayMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [lobbyMode, setLobbyMode] = useState(false);

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

  return (
    <>
      <header>
        {!playMode && <div className="Logo">
          LaunchpadBay
        </div>}
        <nav>
          {!playMode && <button className="NavButton" onClick={() => setPlayMode(true)}>Play</button>}
          {!playMode && <button className="NavButton" onClick={() => {setShowLogin(!loggedIn); loggedIn && setLoggedIn(false)}}>{loggedIn ? 'Logout' : 'Login'}</button>}
        </nav>
      </header>
      {!playMode && <div className="Tagline">JAM WITH EASE</div>}
      <main>
          {showLogin && !playMode && 
          <LoginView 
            setLoggedIn={setLoggedIn}
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
