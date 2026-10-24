import { useEffect, useRef } from "react";
import PolicyDocument from "./Policies.jsx";
import { useTranslation } from 'react-i18next'

export default function PolicyDialog({ kind, onClose }) {
    const { t } = useTranslation()
    const dialogRef = useRef(null);
    const titleRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current

        if (!dialog.open) {
            dialog.showModal()
        }

        titleRef.current?.focus()

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [])


    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={`policy-${kind}-title`}
            onClose={onClose}
            className="m-auto max-h-[85dvh] w-[min(92vw,48rem)] overflow-y-auto rounded-xl border border-white/20 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/70"
        >
            <div className="sticky top-0 z-10 flex justify-end border-b border-white/10 bg-slate-900 p-3">
                <button type="button" onClick={() => dialogRef.current.close()}
                    className="cursor-pointer rounded-md bg-white/10 px-4 py-2 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                >
                    {t('policies.close')}
                </button>
            </div>
            <PolicyDocument kind={kind} titleRef={titleRef}
            />
        </dialog>
    )
}

