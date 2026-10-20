import Modal from './Modal.jsx'
import FormButton from './FormButton.jsx'

// shown to the host over everything (launchpad included) when someone asks to join
export default function JoinRequestPopup({ username, onAcceptClick, onRejectClick }) {
  return (
    <Modal className="z-30">
      <div className="text-white text-sm font-sans text-center">
        <span className="font-medium">{username}</span> wants to join your session
      </div>
      <div className="flex gap-2">
        {/* darker than the default FormButton so the white text reads on the light popup */}
        <FormButton type="button" className="bg-black/35 hover:bg-black/45" onClick={onAcceptClick}>Accept</FormButton>
        <FormButton type="button" className="bg-black/35 hover:bg-black/45" onClick={onRejectClick}>Reject</FormButton>
      </div>
    </Modal>
  )
}
