import { useTranslation } from 'react-i18next'
import Modal from './Modal.jsx'

// Shown over everything when the backend refuses this tab because the session
// is already open somewhere else
export default function AlreadyOpenNotice() {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Modal className="max-w-sm text-center">
        <p className="text-white text-sm font-sans">
          {t('alreadyOpen.alreadyOpenNotice')}<br />
          {t('alreadyOpen.closeAndReload')}
        </p>
      </Modal>
    </div>
  )
}
