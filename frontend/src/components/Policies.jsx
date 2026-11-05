import { useTranslation } from "react-i18next"
import Icon from "./Icon.jsx"

export default function PolicyDocument({ kind, titleRef, onClose }) {
    const { t, i18n } = useTranslation()

    const policy = t(`policies.${kind}`, {
        returnObjects: true,
    })

    return (
        <article dir={i18n.dir()}
            className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col text-start text-white">
            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-6 py-4 sm:px-8">
                <h1 id={`policy-${kind}-title`}
                    ref={titleRef}
                    tabIndex={-1}
                    className="min-w-0 flex-1 break-words text-2xl font-semibold focus:outline-none">
                    {policy.title}
                </h1>
                <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <Icon name="close" className="size-5" />
                </button>
            </header>
            <div className="chat-scrollbar min-h-0 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8">
                {policy.sections.map((section) => (
                    <section key={section.id} className="mt-6 first:mt-0">
                        <h2 className="text-lg font-semibold">
                            {section.title}
                        </h2>
                        <p className="mt-2 leading-relaxed text-white/80">
                            {section.text}
                        </p>
                    </section>
                ))}
            </div>
        </article>
    )
}
