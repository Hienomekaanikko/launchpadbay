import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import multipart from '@fastify/multipart'
import bcrypt from 'bcrypt'
import { getSessionByUserId } from './sessions.js'
import { wsConnectionRegistry, broadcastEvent, removeEntry } from './ws.js'
import {
	AVATAR_DIR,
	ALLOWED_AVATAR_TYPES,
	DEFAULT_AVATAR_URL,
	avatarUrl,
	extensionFor,
	removeUserAvatars,
} from './avatars.js'
import {
	USERNAME_LOOKUP_MAX_LENGTH,
	validateEmail,
	validateNewPassword,
	isPasswordInput,
	trimUsername,
	isBoundedString
} from './validation.js'

export default async function profileRoutes(fastify) {
	const { prisma } = fastify

	await fastify.register(multipart, {
		limits: { fileSize: 2 * 1024 * 1024 },
	})

	fastify.get('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'User not found' })
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
			return reply.code(404).send({ error: 'User not found' })
		}
		return {
			id: user.id,
			username: user.username,
			avatar: user.avatar ? avatarUrl(user.avatar) : DEFAULT_AVATAR_URL,
			createdAt: user.created_at,
		}
	})

	fastify.patch('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const email = validateEmail(request.body?.email)
		if (email.error) {
			return reply.code(400).send({ error: email.error, params: email.params })
		}
		try {
			const updated = await prisma.users.update({ where: { id: request.user.id }, data: { email: email.value } })
			return { email: updated.email }
		} catch (err) {
			if (err.code === 'P2002') {
				return reply.code(409).send({ error: 'Email already taken' })
			}
			throw err
		}
	})

	fastify.put('/profile/password', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const { currentPassword, newPassword } = request.body ?? {}
		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'User not found' })
		}
		if (!user.password_hash) {
			return reply.code(400).send({ error: 'This account signs in with GitHub and has no password' })
		}

		const parsedPassword = validateNewPassword(newPassword)
		if (parsedPassword.error) {
			return reply.code(400).send({ error: parsedPassword.error, params: parsedPassword.params })
		}
		if (!isPasswordInput(currentPassword) || !(await bcrypt.compare(currentPassword, user.password_hash))) {
			return reply.code(403).send({ error: 'current_password_incorrect' })
		}

		await prisma.users.update({
			where: { id: user.id },
			data: { password_hash: await bcrypt.hash(parsedPassword.value, 10) },
		})
		return { ok: true }
	})

	// Deletes the account; friendships and messages go with it (onDelete: Cascade).
	// Password accounts confirm with their password, GitHub-only ones by typing their username
	fastify.delete('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const { password, username } = request.body ?? {}
		const user = await prisma.users.findUnique({ where: { id: request.user.id } })
		if (!user) {
			return reply.code(404).send({ error: 'User not found' })
		}

		const typedUsername = trimUsername(username)
		const confirmed = user.password_hash
			? isPasswordInput(password) && await bcrypt.compare(password, user.password_hash)
			: isBoundedString(typedUsername, USERNAME_LOOKUP_MAX_LENGTH) && typedUsername === user.username

		if (!confirmed) {
			return reply.code(403).send({ error: user.password_hash ? 'Password is incorrect' : 'Username does not match' })
		}
		if (getSessionByUserId(user.id)) {
			return reply.code(409).send({ error: 'Leave your session before deleting your account' })
		}

		await prisma.users.delete({ where: { id: user.id } })
		if (user.avatar) {
			await unlink(path.join(AVATAR_DIR, user.avatar)).catch(() => {})
		}

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
			return reply.code(400).send({ error: 'No file uploaded' })
		}

		// Re-checked here because the client's accept attribute is only a hint
		if (!ALLOWED_AVATAR_TYPES.includes(upload.mimetype)) {
			return reply.code(400).send({ error: 'Only JPEG, PNG, or WebP allowed' })
		}

		const filename = `${request.user.id}.${extensionFor(upload.mimetype)}`
		await removeUserAvatars(request.user.id)
		await pipeline(upload.file, createWriteStream(path.join(AVATAR_DIR, filename)))

		await prisma.users.update({
			where: { id: request.user.id },
			data: { avatar: filename },
		})

		return { avatar: avatarUrl(filename) }
	})
}
