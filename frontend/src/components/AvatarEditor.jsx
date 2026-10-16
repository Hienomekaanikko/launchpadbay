import { useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import Modal from './Modal.jsx'
import CloseButton from './CloseButton.jsx'

export default function AvatarEditor({ onClose }) {
  return (
    <Modal className="z-30 w-[min(90vw,20rem)]">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-white text-sm font-medium tracking-nav
font-sans">Change avatar</h2>
        <CloseButton onClick={onClose}>x</CloseButton>
      </div>
      <p className="text-white/60 text-xs font-sans text-center">
        Upload and crop — coming soon
      </p>
      {/* file input + Cropper later */}
    </Modal>
  )
}


// crop functionality (react-easy-crop)

// avatar POST  to backend (auth.js?), update user.avatar
