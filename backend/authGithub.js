import crypto from 'node:crypto'
import cookie from '@fastify/cookie'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { AVATAR_DIR, removeUserAvatars } from './avatars.js'

const REQUIRED_ENV = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL']
const STATE_COOKIE = 'gh_oauth_state'

export default async function githubAuth(fastify) {
	const { prisma } = fastify

	// Fail at startup instead of sending GitHub a client_id of "undefined"
	for (const name of REQUIRED_ENV) {
		if (!process.env[name]) {
			throw new Error(`Missing env var: ${name}`)
		}
	}

	await fastify.register(cookie)

	const frontend = process.env.FRONTEND_URL || 'https://localhost:8443'

	// Results go in the URL fragment (#...), which the browser never sends to a server or logs
	const redirectToFrontend = (reply, fields) =>
		reply.redirect(`${frontend}/#${new URLSearchParams(fields)}`)

	// Send the browser to GitHub's consent screen
	fastify.get('/auth/github', async (request, reply) => {
		// Random state, remembered in this browser, proves the callback is for a login we started
		const state = crypto.randomBytes(16).toString('hex')
		reply.setCookie(STATE_COOKIE, state, {
			path: '/',
			httpOnly: true,		// not readable from JS
			secure: true,		// HTTPS only
			sameSite: 'lax',	// still sent on the top-level redirect back from GitHub
			maxAge: 600,		// 10 min
		})

		const params = new URLSearchParams({
			client_id: process.env.GITHUB_CLIENT_ID,
			redirect_uri: process.env.GITHUB_CALLBACK_URL,
			state,
		})
		return reply.redirect(`https://github.com/login/oauth/authorize?${params}`)
	})

	// GitHub sends the user back here with a one-time code and our state
	fastify.get('/auth/github/callback', async (request, reply) => {
		const { code: githubAuthCode, state, error } = request.query

		const expectedState = request.cookies[STATE_COOKIE]
		reply.clearCookie(STATE_COOKIE, { path: '/' })	// one-time use, cleared even on failure

		// error could be user clicked "Cancel" on GitHub or similar
		if (error) {
			return redirectToFrontend(reply, { error: 'GitHub login cancelled' })
		}
		if (!state || state !== expectedState) {
			return redirectToFrontend(reply, { error: 'GitHub login expired, please try again' })
		}
		if (!githubAuthCode) {
			return redirectToFrontend(reply, { error: 'GitHub login failed' })
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
			return redirectToFrontend(reply, { error: 'GitHub login failed' })
		}

		// Load the GitHub profile with that token
		const githubUserResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${githubAccessToken}`,
				Accept: 'application/json',
				'User-Agent': 'launchpadbay',	// GitHub API rejects requests without one
			},
		})
		const githubUser = await githubUserResponse.json()
		if (!githubUser.id) {
			return redirectToFrontend(reply, { error: 'GitHub login failed' })
		}

		const githubId = String(githubUser.id)

		// Find existing local user, or create one linked to this GitHub id
		let user = await prisma.users.findUnique({ where: { github_id: githubId } })
		if (!user) {
			const createUser = (username, email) => prisma.users.create({
				data: {
					username,
					email,
					password_hash: null,
					github_id: githubId,
				},
			})

			try {
				user = await createUser(githubUser.login, githubUser.email ?? null)	// null if private on GitHub
			} catch (err) {
				if (err.code !== 'P2002') {
					throw err
				}
				// Name or email already used by a local account: suffix the name, skip the email
				user = await createUser(`${githubUser.login}-${githubId}`, null)
			}

			if (githubUser.avatar_url) {
				try {
					const githubAvatarResponse = await fetch(githubUser.avatar_url, {
						headers: { 'User-Agent': 'launchpadbay' },
					})
					if (githubAvatarResponse.ok) {
						const buf = Buffer.from(await githubAvatarResponse.arrayBuffer())
						const filename = `${user.id}.jpg`
						await removeUserAvatars(user.id)
						await writeFile(path.join(AVATAR_DIR, filename), buf)
						user = await prisma.users.update({
							where: { id: user.id },
							data: { avatar: filename },
						})
					}
				} catch {
					// if no github avatar -> keeps DefaultAvatar
				}
			}
		}

		// Mint our app JWT (same as password login) and hand it to the frontend
		const jwt = fastify.jwt.sign({ id: user.id, username: user.username })
		return redirectToFrontend(reply, { token: jwt, id: user.id, username: user.username })
	})
}
