import { useEffect, useRef } from "react";
import PolicyDocument from "./Policies.jsx";

export default function PolicyDialog({ kind, onClose }) {
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
              if (e.target !== dialogRef.current) return
              const bounds = e.currentTarget.getBoundingClientRect()
              if (e.clientX < bounds.left || e.clientX > bounds.right
                  || e.clientY < bounds.top || e.clientY > bounds.bottom) {
                e.currentTarget.close()
              }
            }}
            className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),48rem)] overflow-y-auto rounded-[20px] border-0 border-t border-t-white/18 border-b border-b-white/8 bg-surface/30 p-0 text-white shadow-panel backdrop-blur-[15px] backdrop:bg-transparent backdrop:backdrop-blur-sm"
        >
            <PolicyDocument kind={kind} titleRef={titleRef} />
        </dialog>
    )
}

