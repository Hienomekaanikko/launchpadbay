import path from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import multipart from '@fastify/multipart'
import { getSessionByUserId } from './sessions.js'
import {
	MAX_PAD_SAMPLE_BYTES,
	SESSION_SOUNDS_DIR,
	isValidPad,
	isWavBuffer,
	sessionSoundUrl,
} from './padSamples.js'

// Per-session pad sample uploads. Multipart is registered here with its own size
// limit; the one in profile.js is scoped to that plugin and sized for avatars
export default async function padSampleRoutes(fastify) {
	await fastify.register(multipart, {
		limits: { fileSize: MAX_PAD_SAMPLE_BYTES },
	})

	// Replaces one pad's sample for the uploader's current session. The file lives
	// under uploads/sounds/session/<sessionId>/ until the session closes.
	// Multipart fields, in this order: pad (1..PAD_COUNT), file (WAV). Returns { pad, url }
	fastify.post('/session/pad-sample', { onRequest: [fastify.authenticate] }, async (request, reply) => {
		const session = getSessionByUserId(request.user.id)
		if (!session) {
			return reply.code(403).send({ error: 'not_in_session' })
		}

		const upload = await request.file()
		if (!upload) {
			return reply.code(400).send({ error: 'no_file_uploaded' })
		}

		// `pad` must be sent before `file`: fields that come after the file aren't
		// on upload.fields yet (auth.js uploadPadSample keeps this order)
		const pad = Number(upload.fields.pad?.value)
		if (!isValidPad(pad)) {
			return reply.code(400).send({ error: 'invalid_pad' })
		}

		// Read stream into buffer to inspect bytes before anything touches disk
		const buffer = await upload.toBuffer()
		if (!isWavBuffer(buffer)) {
			return reply.code(400).send({ error: 'invalid_sample_content' })
		}

		// a new name on every upload: the browser caches samples by URL
		const filename = `${pad}.${randomUUID()}.wav`
		const dir = path.join(SESSION_SOUNDS_DIR, session.id)
		await mkdir(dir, { recursive: true })
		await writeFile(path.join(dir, filename), buffer)

		// one override per pad: drop the file this one replaces
		const previous = session.overrides.get(pad)
		if (previous) {
			await unlink(path.join(dir, previous)).catch(() => {})
		}
		session.overrides.set(pad, filename)

		return { pad, url: sessionSoundUrl(session.id, filename) }
	})
}
