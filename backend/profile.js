import path from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'
import multipart from '@fastify/multipart'
import bcrypt from 'bcrypt'
import { getSessionByUserId } from './sessions.js'
import { wsConnectionRegistry, broadcastEvent, removeEntry } from './ws.js'
import {
	AVATAR_DIR,
	ALLOWED_AVATAR_TYPES,
	DEFAULT_AVATAR_URL,
	avatarUrl,
	detectAvatarType,
	newAvatarFilename,
	removeUserAvatars,
	withAvatarLock,
} from './avatars.js'
import {
	USERNAME_LOOKUP_MAX_LENGTH,
	validateEmail,
	validateNewPassword,
	validateUsername,
	isPasswordInput,
	trimUsername,
	isBoundedString
} from './validation.js'

export default async function profileRoutes(fastify) {
	const { prisma } = fastify

	await fastify.register(multipart, {
		limits: { fileSize: 2 * 1024 * 1024 }, // keep nginx client_max_body_size above this
	})

	fastify.get('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'user_not_found' })
		}
		return {
			id: user.id,
			username: user.username,
			email: user.email,
			avatar: user.avatar ? avatarUrl(user.avatar) : DEFAULT_AVATAR_URL,
			createdAt: user.created_at,
			hasPassword: Boolean(user.password_hash), // false for GitHub-only accounts
		}
	})

	// Another user's public profile: never their email
	fastify.get('/users/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const user = await prisma.users.findUnique({ where: { id: String(request.params.id) } })
		if (!user) {
			return reply.code(404).send({ error: 'user_not_found' })
		}
		return {
			id: user.id,
			username: user.username,
			avatar: user.avatar ? avatarUrl(user.avatar) : DEFAULT_AVATAR_URL,
			createdAt: user.created_at,
		}
	})

	// Changes any of { username, email, newPassword } in one save; fields left out stay
	// as they are, and nothing is saved unless every field checks out.
	// Email (it's the login) and password changes need currentPassword on password accounts
	fastify.patch('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const body = request.body ?? {}
		const data = {}

		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'user_not_found' })
		}

		if (body.username !== undefined) {
			const username = validateUsername(body.username)
			if (username.error) {
				return reply.code(400).send({ error: username.error, params: username.params })
			}
			// only the exact same name; changing just the capitals is still a change
			if (username.value === user.username) {
				return reply.code(400).send({ error: 'username_unchanged' })
			}
			// a session keeps its players' names; renaming mid-session would leave them stale
			if (getSessionByUserId(request.user.id)) {
				return reply.code(409).send({ error: 'leave_session_before_rename' })
			}
			data.username = username.value
		}
		if (body.email !== undefined) {
			const email = validateEmail(body.email)
			if (email.error) {
				return reply.code(400).send({ error: email.error, params: email.params })
			}
			data.email = email.value
		}
		const changesPassword = body.newPassword !== undefined
		if (changesPassword && !user.password_hash) {
			return reply.code(400).send({ error: 'github_only_account' })
		}
		if (Object.keys(data).length === 0 && !changesPassword) {
			return reply.code(400).send({ error: 'invalid_request_body' })
		}

		// GitHub-only accounts have no password to ask for
		if ((data.email !== undefined || changesPassword) && user.password_hash
			&& (!isPasswordInput(body.currentPassword)
				|| !(await bcrypt.compare(body.currentPassword, user.password_hash)))) {
			return reply.code(403).send({ error: 'current_password_incorrect' })
		}
		if (changesPassword) {
			const parsedPassword = validateNewPassword(body.newPassword)
			if (parsedPassword.error) {
				return reply.code(400).send({ error: parsedPassword.error, params: parsedPassword.params })
			}
			data.password_hash = await bcrypt.hash(parsedPassword.value, 10)
		}

		let updated
		try {
			updated = await prisma.users.update({ where: { id: request.user.id }, data })
		} catch (err) {
			if (err.code === 'P2002') {
				// with both username and email, look for the clashing field in the error details
				const usernameTaken = data.username !== undefined
					&& (data.email === undefined || JSON.stringify(err.meta ?? {}).includes('username'))
				return reply.code(409).send({ error: usernameTaken ? 'username_taken' : 'email_taken' })
			}
			throw err
		}

		if (data.username) {
			// the server's own copy of the name, used for chat 'from' and join requests
			const entry = wsConnectionRegistry.get(updated.id)
			if (entry) {
				entry.username = updated.username
			}
			broadcastEvent({ type: 'user_renamed', id: updated.id, username: updated.username })
		}

		// the saved values (trimmed, normalized); the password hash never leaves the server
		const changed = {}
		for (const key of ['username', 'email']) {
			if (data[key] !== undefined) {
				changed[key] = updated[key]
			}
		}
		if (changesPassword) {
			changed.passwordChanged = true
		}
		return changed
	})

	// Deletes the account; friendships and messages go with it (onDelete: Cascade).
	// Password accounts confirm with their password, GitHub-only ones by typing their username
	fastify.delete('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const { password, username } = request.body ?? {}
		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'user_not_found' })
		}

		const typedUsername = trimUsername(username)
		const confirmed = user.password_hash
			? isPasswordInput(password) && await bcrypt.compare(password, user.password_hash)
			: isBoundedString(typedUsername, USERNAME_LOOKUP_MAX_LENGTH) && typedUsername === user.username

		if (!confirmed) {
			return reply.code(403).send({ error: user.password_hash ? 'password_incorrect' : 'username_mismatch' })
		}
		if (getSessionByUserId(user.id)) {
			return reply.code(409).send({ error: 'leave_session_before_delete' })
		}

		await prisma.users.delete({ where: { id: user.id } })
		// every file of this user, not just the current one, so no orphans stay behind
		await removeUserAvatars(user.id)

		// unregister before closing, so the disconnect goes out before 'user_deleted'
		const entry = wsConnectionRegistry.get(user.id)
		if (entry) {
			removeEntry(user.id, entry)
			entry.socket.close(1000, 'Account deleted')
		}
		broadcastEvent({ type: 'user_deleted', id: user.id })
		return { ok: true }
	})

	// Stores the filename only; GET /profile builds the URL from it
	fastify.post('/profile/avatar', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const upload = await request.file()
		if (!upload) {
			return reply.code(400).send({ error: 'no_file_uploaded' })
		}

		// Re-checked here because the client's accept attribute is only a hint
		if (!ALLOWED_AVATAR_TYPES.includes(upload.mimetype)) {
			return reply.code(400).send({ error: 'invalid_avatar_type' })
		}

		// Read stream into buffer to inspect bytes and save file safely
		const buffer = await upload.toBuffer()
		const detectedType = detectAvatarType(buffer)

		// Ensure file has valid magic bytes and matches the claimed MIME type
		if (!detectedType || detectedType !== upload.mimetype) {
			return reply.code(400).send({ error: 'invalid_avatar_content' })
		}

		// one upload per user at a time (preventing concurrent race conditions):
		// the old file now stays intact until the DB points to the new one,
		// ensuring a failed write never leaves a broken file.
		const filename = newAvatarFilename(request.user.id, detectedType)
		await withAvatarLock(request.user.id, async () => {
			// stream is consumed by toBuffer(), so writeFile() is used
			await writeFile(path.join(AVATAR_DIR, filename), buffer)
			await prisma.users.update({
				where: { id: request.user.id },
				data: { avatar: filename },
			})
			await removeUserAvatars(request.user.id, filename)
		})

		return { avatar: avatarUrl(filename) }
	})
}
