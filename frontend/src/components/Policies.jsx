import { useTranslation } from "react-i18next"

export default function PolicyDocument({ kind, titleRef }) {
    const { t, i18n } = useTranslation()

    const policy = t(`policies.${kind}`, {
        returnObjects: true,
    })

    return (
        <article dir={i18n.language === 'hebrew' ? 'rtl' : 'ltr'}
            className="rounded-xl bg-slate-900 p-6 text-start text-slate-100">
            <h1 id={`policy-${kind}-title`}
                ref={titleRef}
                tabIndex={-1}
                className="text-2xl font-bold">
                {policy.title}
            </h1>
            {policy.sections.map((section) => (
                <section key={section.title} className="mt-6">
                    <h2 className="text-lg font-semibold">
                        {section.title}
                    </h2>
                    <p className="mt-2 leading-relaxed text-slate-200">
                        {section.text}
                    </p>
                </section>
            ))}
        </article>
    )
}