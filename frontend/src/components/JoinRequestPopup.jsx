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
        <FormButton type="button" onClick={onAcceptClick}>Accept</FormButton>
        <FormButton type="button" onClick={onRejectClick}>Reject</FormButton>
      </div>
    </Modal>
  )
}
