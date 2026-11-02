import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeSync, openSync, readFileSync, readSync } from 'node:fs'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import bcrypt from 'bcrypt'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import {
    MAX_WS_BYTES_PER_FRAME,
    wsConnectionRegistry,
    broadcastEvent,
    cancelPendingLeave,
    createRateLimiter,
    onGraceExpired,
    removeEntry,
    stopHeartbeat,
    send
} from './ws.js'
import {
    getAllSessionViews,
    sendSessionState,
    handleSessionCreate,
    handleJoinRequest,
    handleJoinCancel,
    handleSessionAccept,
    handleSessionReject,
    handleSessionLeave,
    handleSessionAction,
    leaveSessionAndBroadcastUpdate
} from './sessions.js'
import {
    validateRegistrationInput,
    validateLoginInput
} from './validation.js'
import { handleChatMessage } from './chat.js'
import githubAuth from './authGithub.js'
import friends from './friends.js'
import { registerMetrics } from './metrics.js'
import profileRoutes from './profile.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// WebSocket rate limits, per socket: sustained messages per second, and how many
// can come in one burst. Fast launchpad play sends ~10-15 actions per second.
const WS_MSGS_PER_SECOND = 20
const WS_MSGS_BURST = 40
const WS_CHAT_PER_SECOND = 5
const WS_CHAT_BURST = 10
const RATE_LIMIT_NOTICE_MS = 1000

// login / register attempts per IP; each one costs a bcrypt hash
const AUTH_ATTEMPTS_PER_MINUTE = 10

// how long a login lasts; after that the frontend logs out and the user logs in again
const JWT_EXPIRES_IN = '1d'

const fastify = Fastify({
    logger: true,
    https: {
        key: readFileSync('/run/tls/backend-key.pem'),
        cert: readFileSync('/run/tls/backend.pem')
    }
})

// Intercepts framework limits and unhandled server crashes, preventing database/
// Prisma details from leaking while standardizing 500 error responses
fastify.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
        return
    }
    const statusCode = error.statusCode ?? 500

    // Catch the 413 file size error explicitly.
    // FST_REQ_FILE_TOO_LARGE is a @fastify/multipart (upload plugin) error code
    if (statusCode === 413 || error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'file_too_large' })
    }

    // @fastify/rate-limit throws its 429 here too; keep its code instead of the generic one below
    if (statusCode === 429) {
        return reply.code(429).send({ error: 'rate_limited' })
    }

    // Keep thrown 4xx responses machine-readable without exposing messages.
    if (statusCode < 500) {
        return reply.code(statusCode).send({ error: 'invalid_request_body' })
    }

    // Catch all unhandled 5xx crashes (Prisma / database / runtime details
    // that should never be exposed)
    request.log.error({ err: error }, 'Unhandled request error')
    return reply.code(500).send({ error: 'internal_error' })
})

registerMetrics(fastify)

const adapter = new PrismaMariaDb({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    allowPublicKeyRetrieval: true,
})

const prisma = new PrismaClient({ adapter })

fastify.decorate('prisma', prisma)

fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
})

await fastify.register(cors, {
    origin: 'http://localhost:5173'
})

await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'uploads'),
    prefix: '/uploads/'
})

await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'defaultImages'),
    prefix: '/defaultImages/',
    decorateReply: false,
})

// Every token expires (JWT_EXPIRES_IN) and carries the user's token_version as 'tv';
// a password change bumps the version, so tokens signed before it stop working
await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
    sign: { expiresIn: JWT_EXPIRES_IN }
})

await fastify.register(githubAuth)

// Only routes that opt in (config.rateLimit) are limited.
// Behind nginx every request comes from the nginx container, so the client's
// address is read from the X-Real-IP header nginx sets
await fastify.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.headers['x-real-ip'] ?? request.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited' })
})

const authRateLimit = { rateLimit: { max: AUTH_ATTEMPTS_PER_MINUTE, timeWindow: '1 minute' } }

await fastify.register(websocket, {
    options: { maxPayload: MAX_WS_BYTES_PER_FRAME }
})

// Valid signature and not expired isn't enough: the account must still exist, and the
// token must not be older than the last password change
fastify.decorate('authenticate', async function (request, reply) {
    try {
        await request.jwtVerify()
    } catch (err) {
        return reply.code(401).send({ error: 'unauthorized' })
    }
    const user = await prisma.users.findUnique({
        where: { id: request.user.id },
        select: { token_version: true }
    })
    if (!user || user.token_version !== request.user.tv) {
        return reply.code(401).send({ error: 'unauthorized' })
    }
})

// Registered after the 'authenticate' decorator above: their routes reference it at definition time
await fastify.register(friends)
await fastify.register(profileRoutes)

fastify.addHook('onClose', () => {
    stopHeartbeat()
})

// dispatch table for client->server messages
// NOTE: 'create(null)' ensures a pure dispatch table which does not inherit any
// invisible default handlers from 'Object.prototype', not unlike a simple C dispatch
const wsHandlers = Object.create(null)
wsHandlers.session_create = handleSessionCreate
wsHandlers.join_request   = handleJoinRequest
wsHandlers.join_cancel    = handleJoinCancel
wsHandlers.session_accept = handleSessionAccept
wsHandlers.session_reject = handleSessionReject
wsHandlers.session_leave  = handleSessionLeave
wsHandlers.session_action = handleSessionAction
wsHandlers.chat_message   = handleChatMessage
wsHandlers.session_chat   = handleChatMessage

// When a user's grace period ended after a disconnect, they are really gone:
// drop them from their session
onGraceExpired(leaveSessionAndBroadcastUpdate)

// WebSocket route
fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const token = request.query.token
    const tabId = request.query.tabId
    let jwtPayload

    try {
        jwtPayload = await fastify.jwt.verify(token)
    } catch (err) {
        socket.close(4001, 'Unauthorized')
        return
    }

    // The token proves who this is; the current name comes from the DB, since the
    // name inside the token is out of date once the user renames themselves
    const user = await prisma.users.findUnique({
        where: { id: jwtPayload.id },
        select: { username: true, token_version: true }
    })
    // account deleted, or the token is from before the last password change
    if (!user || user.token_version !== jwtPayload.tv) {
        socket.close(4001, 'Unauthorized')
        return
    }

    // Check if the user already has an active socket connection
    const previous = wsConnectionRegistry.get(jwtPayload.id)
    if (previous) {
        // case A: The incoming connection is from a different tab/window
        if (previous.tabId !== tabId) {
            socket.close(1008, 'Already open in another tab')
            return
        }
        // case B: The new connection is a refresh of the same tab; close the old socket
        previous.socket.close(1008, 'Replaced by a reload of this tab')
    }
    cancelPendingLeave(jwtPayload.id) // user may have refreshed or opened a new tab

    // create a new entry, and insert it into the registry.
    // In case the user was already connected (i.e. with the 'previous' entry),
    // the registry's set() member function updates that user's entry
    const entry = { username: user.username, socket, isAlive: true, tabId }

    // Announce new connection to everyone already connected (except the new client).
    // Skip on reconnect: other clients already see this client as connected
    if (!previous) {
        broadcastEvent({ type: 'user_connected', id: jwtPayload.id, username: entry.username })
    }

    wsConnectionRegistry.set(jwtPayload.id, entry)

    /* WebSocket Listeners (event handlers) */

    // 'pong' handler: operates in tandem with 'ping' requests in 'heartbeatRound()'
    socket.on('pong', () => {
        entry.isAlive = true
    })

    // Create a queue system, that is at first 'resolved' - i.e.: empty.
    // Since handleMessage() is asynchronous, as it 'awaits' responses for its
    // DB queries, quick messages can result in data races, and be processed in
    // the wrong order. To solve this problem, each incoming message is first
    // appended to the back of this queue, and messages are then handled in a
    // "first come, first served" basis.
    let queue = Promise.resolve()

    // Per-socket rate limits: one for all messages, and a stricter one for chat.
    // Each also remembers when it last told the client about it, so a flood
    // doesn't get a flood of errors back.
    const limits = {
        all:  { bucket: createRateLimiter(WS_MSGS_PER_SECOND, WS_MSGS_BURST), lastNotice: 0 },
        chat: { bucket: createRateLimiter(WS_CHAT_PER_SECOND, WS_CHAT_BURST), lastNotice: 0 }
    }

    // returns true if the message fits within the limits, otherwise tells the
    // client (at most once per second per limit) and returns false
    function withinLimits(msg) {
        const isChat = msg.type === 'chat_message' || msg.type === 'session_chat'
        let limit
        if (!limits.all.bucket.take()) {
            limit = limits.all
        } else if (isChat && !limits.chat.bucket.take()) {
            limit = limits.chat
        } else {
            return true
        }

        const now = Date.now()
        if (now - limit.lastNotice >= RATE_LIMIT_NOTICE_MS) {
            limit.lastNotice = now
            const notice = { type: 'error', reason: 'rate_limited' }
            // lets the frontend show the error in the right chat
            if (msg.type === 'chat_message') notice.to = msg.to
            if (msg.type === 'session_chat') notice.chat = 'session'
            send(socket, notice)
        }
        return false
    }

    async function handleMessage(msg) {
        const handler = wsHandlers[msg.type]
        if (!handler) {
            send(socket, { type: 'error', reason: 'unknown_message' })
            return
        }

        // catch handler failures so an eventual bug wouldn't crash the process
        try {
            await handler(msg, {
                userId: jwtPayload.id,
                username: entry.username, // kept up to date by a rename (PATCH /profile)
                socket,
                prisma
            })
        } catch (err) {
            request.log.error(err, 'ws: handler exception')
            send(socket, { type: 'error', reason: 'internal_error' })
        }
    }

    // Append the new task to the back of the promise queue. This also schedules
    // it to be executed, via handleMessage(), as soon as the task before it
    // finishes. JavaScript's built-in garbage collector automatically notices
    // when a task is not needed anymore, and cleans it out of memory.
    // Parsing and rate limiting happen before queueing, so a flood of messages
    // can't grow the queue without bounds.
    socket.on('message', (raw) => {
        let msg

        try {
            msg = JSON.parse(raw.toString())
        } catch {
            request.log.warn({ userId: jwtPayload.id }, 'ws: invalid JSON')
            send(socket, { type: 'error', reason: 'bad_json' })
            return
        }
        // the "?." syntax avoids errors if 'msg' is null / undefined
        if (typeof msg?.type !== 'string') {
            send(socket, { type: 'error', reason: 'bad_type' })
            return
        }

        if (!withinLimits(msg)) {
            return
        }

        queue = queue.then(() => handleMessage(msg))
    })

    const handleDisconnect = () => {
        removeEntry(jwtPayload.id, entry)
    }

    // closing socket handler
    socket.on('close', handleDisconnect)

    // socket error handler, for extra safety
    socket.on('error', handleDisconnect)

    // Initial snapshots (online users + active sessions) are sent synchronously,
    // before any live events, so the client starts from a consistent state
    try {
        const users = [...wsConnectionRegistry].map(([id, { username }]) => ({
            id,
            username,
            online: true
        }))
        send(socket, { type: 'presence_snapshot', users })
        send(socket, { type: 'sessions_snapshot', sessions: getAllSessionViews() })
        // restore whatever this client was doing before a refresh
        sendSessionState(socket, jwtPayload.id)
    } catch (err) {
        request.log.error(err, `ws: failed to send initial snapshots ` +
            `(userId=${jwtPayload.id}, username=${entry.username})`)
    }
})

fastify.get('/health/db', async () => {
    const [{ ok }] = await prisma.$queryRaw`SELECT 1 AS ok`
    return { ok: Number(ok) }
})

// Launchpad sounds live on disk; the database only names them (prisma/seed.js).
// A file can go missing or be swapped for something else without the app noticing,
// so check before handing out its URL
const SOUNDS_DIR = path.join(__dirname, 'uploads', 'sounds')

// A WAV file starts with "RIFF", 4 bytes of size, then "WAVE". Reads only those 12 bytes,
// so a missing file, an empty one or e.g. a renamed jpg all count as unusable
function soundFileUsable(filename) {
    const header = Buffer.alloc(12)
    let fd
    try {
        fd = openSync(path.join(SOUNDS_DIR, filename), 'r')
        const bytesRead = readSync(fd, header, 0, 12, 0)
        return bytesRead === 12
            && header.toString('ascii', 0, 4) === 'RIFF'
            && header.toString('ascii', 8, 12) === 'WAVE'
    } catch {
        return false
    } finally {
        if (fd !== undefined) closeSync(fd)
    }
}

// Run once the server is up: a broken sound shows here, in docker logs, instead of
// being found later by a player. Never stops the server
async function warnAboutMissingSounds() {
    try {
        const sounds = await prisma.theme_sounds.findMany()
        for (const sound of sounds) {
            if (!soundFileUsable(sound.filename)) {
                fastify.log.warn(`launchpad sound file missing or not a WAV: theme ${sound.theme_id}, slot ${sound.slot}, ${sound.filename}`)
            }
        }
    } catch (err) {
        fastify.log.error(err, 'could not check launchpad sound files')
    }
}

// Unusable sounds are left out, so the browser never asks for them: the launchpad
// still works, that pad is just silent, and the console stays clean
fastify.get('/themes', async () => {
    const themeRows = await prisma.themes.findMany({
        include: { theme_sounds: true }
    })

    return themeRows.map((theme) => {
        const sampleUrls = {}
        for (const sound of theme.theme_sounds) {
            if (soundFileUsable(sound.filename)) {
                sampleUrls[sound.slot] = `/api/uploads/sounds/${sound.filename}`
            }
        }
        return {
            id: theme.id,
            name: theme.name,
            bgImage: theme.bg_image ? `/api/uploads/images/${theme.bg_image}` : null,
            bodyClass: theme.body_class,
            sampleUrls,
        }
    })
})

fastify.post('/register', { config: authRateLimit }, async (request, reply) => {
    const parsed = validateRegistrationInput(request.body)
    if (parsed.error) {
        return reply.code(400).send({ error: parsed.error, params: parsed.params })
    }
    const { username, email, password } = parsed.credentials

    const password_hash = await bcrypt.hash(password, 10)
    try {
        const user = await prisma.users.create({
            data: { username, email, password_hash }
        })
        return { id: user.id, username: user.username }
    } catch (err) {
        if (err.code === 'P2002') {
            return reply.code(409).send({ error: 'already_taken' })
        }
        throw err
    }
})

fastify.post('/login', { config: authRateLimit }, async (request, reply) => {
    const parsed = validateLoginInput(request.body)
    if (parsed.error) {
        return reply.code(400).send({ error: parsed.error, params: parsed.params })
    }
    const { email, password } = parsed.credentials

    const user = await prisma.users.findUnique({ where: { email } })
    if (!user || !user.password_hash) { // GitHub-only accounts have no password
        return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
        return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const token = fastify.jwt.sign({ id: user.id, tv: user.token_version })
    return { token, id: user.id, username: user.username }
})

fastify.listen({port: 3000, host: '0.0.0.0'}, function(err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    warnAboutMissingSounds()
})

// trigger Fastify's graceful shutdown on terminating signals.
// node is PID 1, and the kernel ignores unhandled SIGTERM/SIGINT for PID 1
const sigHandler = async (signal) => {
    fastify.log.info(`received ${signal}, shutting down`)
    try {
        await fastify.close()
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

process.on('SIGTERM', sigHandler)
process.on('SIGINT', sigHandler)
