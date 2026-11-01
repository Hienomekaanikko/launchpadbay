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
            onClick={(e) => {
              if (e.target === dialogRef.current){
                dialogRef.current.close()
              }
            }}
            className="m-auto max-h-[85dvh] w-[min(92vw,48rem)] overflow-y-auto rounded-xl border border-white/20 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/70"
        >
            <div className="sticky top-0 z-10 flex justify-end border-b border-white/10 bg-slate-900 p-3">
           
            </div>
            <PolicyDocument kind={kind} titleRef={titleRef}
            />
        </dialog>
    )
}

