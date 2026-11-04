import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeSync, openSync, readSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Theme sounds (seeded, permanent) live directly under SOUNDS_DIR; per-session
// pad uploads go under SESSION_SOUNDS_DIR/<sessionId>/ and are wiped on every
// boot (docker-entrypoint.sh) and when their session closes
export const SOUNDS_DIR = path.join(__dirname, 'uploads', 'sounds')
export const SESSION_SOUNDS_DIR = path.join(SOUNDS_DIR, 'session')
export const MAX_PAD_SAMPLE_BYTES = 10 * 1024 * 1024 // keep nginx client_max_body_size above this
export const PAD_COUNT = 25 // mirrors frontend/src/launchpad/pads.js

export const isValidPad = (pad) => Number.isInteger(pad) && pad >= 1 && pad <= PAD_COUNT

export const sessionSoundUrl = (sessionId, filename) =>
	`/api/uploads/sounds/session/${sessionId}/${filename}`

// A WAV file starts with "RIFF", 4 bytes of size, then "WAVE". Used on an
// upload before anything touches disk
export const isWavBuffer = (buffer) =>
	buffer.length >= 12
	&& buffer.toString('ascii', 0, 4) === 'RIFF'
	&& buffer.toString('ascii', 8, 12) === 'WAVE'

// Reads only the first 12 bytes, so a missing file, an empty one or e.g. a
// renamed jpg all count as unusable
export function isWavFile(filePath) {
	const header = Buffer.alloc(12)
	let fd
	try {
		fd = openSync(filePath, 'r')
		return readSync(fd, header, 0, 12, 0) === 12 && isWavBuffer(header)
	} catch {
		return false
	} finally {
		if (fd !== undefined) closeSync(fd)
	}
}
