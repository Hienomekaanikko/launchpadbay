import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, unlink } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const AVATAR_DIR = path.join(__dirname, 'uploads', 'images', 'avatars')
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Must stay in sync with the @fastify/static prefixes in server.js, and with nginx's /api/ proxy
export const DEFAULT_AVATAR_URL = '/api/defaultImages/DefaultAvatar.png'
export const avatarUrl = (filename) => `/api/uploads/images/avatars/${filename}`

export const extensionFor = (mimetype) => mimetype === 'image/png' ? 'png'
	: mimetype === 'image/webp' ? 'webp'
	: 'jpg'

export async function removeUserAvatars(userId) {
	const files = await readdir(AVATAR_DIR).catch(() => [])
	await Promise.all(
		files
			.filter((filename) => filename.startsWith(`${userId}.`))
			.map((filename) => unlink(path.join(AVATAR_DIR, filename)).catch(() => {}))
	)
}
