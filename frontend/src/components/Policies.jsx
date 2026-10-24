const policies = {
    privacy: {
        title: 'Privacy Policy',
        sections: [
            {

                title: 'About',
                text: 'Launchpad Bay is a browser based music application.'
            },
            {
                title: 'Information Processing',
                text: 'We process up and to including your username, email address, password hasd, avatar, Github account identifier, friendship connections, and chat messages.'
            },
        ],
    },
    service: {
        title: 'Termss of Service',
        sections: [
            {
                title: 'About',
                text: 'Launchpad Bay is a browser based launchpad for playing music together with an account and social features.',

            },
            {
                title: 'Acceptable Use',
                text: 'Do not cause harm to other users by spamming, uploading unlawful content, or attempting to disrupt ordinary function of the application.',
            },
        ],
    },
}

export default function PolicyDocument({ kind }) {
    const policy = policies[kind]

    return (
        <article className="rounded-xl bg-slate-900 p-6 text-left text-slate-100">
            <h1 className="text-2xl font-bold">
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