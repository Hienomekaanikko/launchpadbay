import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const AVATAR_DIR = path.join(__dirname, 'uploads', 'images', 'avatars')
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Must stay in sync with the @fastify/static prefixes in server.js, and with nginx's /api/ proxy
export const DEFAULT_AVATAR_URL = '/api/defaultImages/DefaultAvatar.png'
export const avatarUrl = (filename) => `/api/uploads/images/avatars/${filename}`

const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

// Inspects file magic bytes (signatures) to prevent MIME-type spoofing and
// verify the genuine image format (JPEG, PNG, WebP).
export function detectAvatarType(buffer) {
	if (!Buffer.isBuffer(buffer)) {
		return null
	}

	if (buffer.length >= 3
			&& buffer[0] === 0xff
			&& buffer[1] === 0xd8
			&& buffer[2] === 0xff) {
		return 'image/jpeg'
	}

	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
		return 'image/png'
	}

	if (buffer.length >= 12
			&& buffer.toString('ascii', 0, 4) === 'RIFF'
			&& buffer.toString('ascii', 8, 12) === 'WEBP') {
		return 'image/webp'
	}

	return null
}

export const extensionFor = (mimetype) => mimetype === 'image/png' ? 'png'
	: mimetype === 'image/webp' ? 'webp'
	: 'jpg'

export const newAvatarFilename = (userId, mimetype) =>
	`${userId}.${randomUUID()}.${extensionFor(mimetype)}`

export async function removeUserAvatars(userId, keepFilename) {
	const files = await readdir(AVATAR_DIR).catch(() => [])
	await Promise.all(
		files
			.filter((filename) => filename.startsWith(`${userId}.`) && filename !== keepFilename)
			.map((filename) => unlink(path.join(AVATAR_DIR, filename)).catch(() => {}))
	)
}

// Per-user queue for avatar uploads: key = userId, value = the promise of the
// latest queued upload. The entry is dropped once that user's queue is empty
const avatarLocks = new Map()

export function withAvatarLock(userId, task) {
	const previous = avatarLocks.get(userId) ?? Promise.resolve()
	const current = previous.catch(() => {}).then(task)
	avatarLocks.set(userId, current)
	return current.finally(() => {
		if (avatarLocks.get(userId) === current) {
			avatarLocks.delete(userId)
		}
	})
}
