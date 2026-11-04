import { useTranslation } from "react-i18next"

export default function PolicyDocument({ kind, titleRef }) {
    const { t, i18n } = useTranslation()

    const policy = t(`policies.${kind}`, {
        returnObjects: true,
    })

    return (
        <article dir={i18n.dir()}
            className="p-6 text-start text-white sm:p-8">
            <h1 id={`policy-${kind}-title`}
                ref={titleRef}
                tabIndex={-1}
                className="text-2xl font-semibold focus:outline-none">
                {policy.title}
            </h1>
            {policy.sections.map((section) => (
                <section key={section.title} className="mt-6">
                    <h2 className="text-lg font-semibold">
                        {section.title}
                    </h2>
                    <p className="mt-2 leading-relaxed text-white/80">
                        {section.text}
                    </p>
                </section>
            ))}
        </article>
    )
}
