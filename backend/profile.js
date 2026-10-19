import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import multipart from '@fastify/multipart'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const AVATAR_DIR = path.join(__dirname, 'uploads', 'images', 'avatars')
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DEFAULT_AVATAR = 'DefaultAvatar.png'

// Must stay in sync with the @fastify/static prefix in server.js, and with nginx's /api/ proxy
const avatarUrl = (filename) => `/api/uploads/images/avatars/${filename}`

const extensionFor = (mimetype) => mimetype === 'image/png' ? 'png'
	: mimetype === 'image/webp' ? 'webp'
	: 'jpg'

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
			avatar: avatarUrl(user.avatar || DEFAULT_AVATAR),
		}
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

		const filename = `${request.user.id}-${randomUUID()}.${extensionFor(upload.mimetype)}`
		await pipeline(upload.file, createWriteStream(path.join(AVATAR_DIR, filename)))

		await prisma.users.update({
			where: { id: request.user.id },
			data: { avatar: filename },
		})

		return { avatar: avatarUrl(filename) }
	})
}
