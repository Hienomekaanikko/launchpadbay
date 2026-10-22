import Modal from './Modal.jsx'

// Shown over everything when the backend refuses this tab because the session
// is already open somewhere else
export default function AlreadyOpenNotice() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Modal className="max-w-sm text-center">
        <p className="text-white text-sm font-sans">
          LaunchpadBay is already open in another tab.<br />
          Close it, then reload this page.
        </p>
      </Modal>
    </div>
  )
}
