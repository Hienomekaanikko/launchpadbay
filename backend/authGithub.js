export default async function githubAuth(fastify) {
	const { prisma } = fastify

	// Send the browser to GitHub's consent screen
	fastify.get('/auth/github', async (request, reply) => {
		const params = new URLSearchParams({
			client_id: process.env.GITHUB_CLIENT_ID,
			redirect_uri: process.env.GITHUB_CALLBACK_URL,
			scope: 'read:user',
		})
		return reply.redirect(`https://github.com/login/oauth/authorize?${params}`)
	})

	// GitHub sends the user back here with a one-time code
	fastify.get('/auth/github/callback', async (request, reply) => {
		const { code: githubAuthCode } = request.query
		if (!githubAuthCode) {
			return reply.code(400).send({ error: 'Missing code' })
		}

		// Exchange that code for a GitHub access token
		const githubTokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: process.env.GITHUB_CLIENT_ID,
				client_secret: process.env.GITHUB_CLIENT_SECRET,
				code: githubAuthCode,
				redirect_uri: process.env.GITHUB_CALLBACK_URL,
			}),
		})
		const githubTokenPayload = await githubTokenResponse.json()
		const githubAccessToken = githubTokenPayload.access_token
		if (!githubAccessToken) {
			return reply.code(401).send({ error: 'GitHub auth failed' })
		}

		// Load the GitHub profile with that token
		const githubUserResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${githubAccessToken}`,
				Accept: 'application/json',
				'User-Agent': 'launchpadbay',
			},
		})
		const githubUser = await githubUserResponse.json()
		if (!githubUser.id) {
			return reply.code(401).send({ error: 'GitHub user fetch failed' })
		}

		const githubId = String(githubUser.id)

		// Find existing local user, or create one linked to this GitHub id
		let user = await prisma.users.findUnique({ where: { github_id: githubId } })
		if (!user) {
			try {
				user = await prisma.users.create({
					data: {
						username: githubUser.login,
						email: githubUser.email ?? null,
						password_hash: null,
						github_id: githubId,
					},
				})
			} catch (err) {
				if (err.code === 'P2002') {
					return reply.code(409).send({ error: 'Username or email already taken' })
				}
				throw err
			}
		}

		// Mint our app JWT (same as password login)
		const jwt = fastify.jwt.sign({ id: user.id, username: user.username })

		// Hand the token to the frontend
		const frontend = process.env.FRONTEND_URL || 'http://localhost:8080'
		const q = new URLSearchParams({ token: jwt, username: user.username })
		return reply.redirect(`${frontend}/?${q}`)
	})
}
