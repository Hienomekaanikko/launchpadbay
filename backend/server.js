import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import bcrypt from 'bcrypt'
import websocket from '@fastify/websocket'
import {
    wsConnectionRegistry,
    broadcastPresenceUpdate,
    removeEntry,
    stopHeartbeat
} from './ws.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({
    logger: true
})

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

await fastify.register(jwt, {
    secret: process.env.JWT_SECRET
  })

await fastify.register(websocket)

fastify.decorate('authenticate', async function (request, reply) {
    try {
        await request.jwtVerify()
    } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' })
    }
})

fastify.addHook('onClose', () => {
    stopHeartbeat()
})

// WebSocket route
fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const token = request.query.token
    let jwtPayload

    try {
        jwtPayload = await fastify.jwt.verify(token)
    } catch (err) {
        socket.close(1008, 'Unauthorized')
        return
    }

    // check whether the new connection originated from an already connected user;
    // if it did, politely close the stale socket, as a new replacement will
    // be created right afterwards
    const previous = wsConnectionRegistry.get(jwtPayload.id)
    if (previous) {
        previous.socket.close(1008, 'Replaced by a new connection')
    }

    // create a new entry, and insert it into the registry.
    // In case the user was already connected (i.e. with the 'previous' entry),
    // the registry's set() member function updates that user's entry
    const entry = { username: jwtPayload.username, socket, isAlive: true }

    // Announce new connection to everyone already connected (except the new client).
    // Skip on reconnect: other clients already see this client as connected
    if (!previous) {
        broadcastPresenceUpdate({ type: 'user_connected', username: entry.username })
    }

    wsConnectionRegistry.set(jwtPayload.id, entry)

    // 'pong' handler: operates in tandem with 'ping' requests in 'heartbeatRound()'
    socket.on('pong', () => {
        entry.isAlive = true
    })

    // handler for WebSocket closure
    socket.on('close', () => {
        removeEntry(jwtPayload.id, entry)
    })

    // socket error handler, for extra safety
    socket.on('error', () => {
        removeEntry(jwtPayload.id, entry)
    })
})

fastify.get('/health/db', async () => {
    const [{ ok }] = await prisma.$queryRaw`SELECT 1 AS ok`
    return { ok: Number(ok) }
})

fastify.get('/themes', async () => {
    const themeRows = await prisma.themes.findMany({
        include: { theme_sounds: true }
    })

    return themeRows.map((theme) => {
        const sampleUrls = {}
        for (const sound of theme.theme_sounds) {
            sampleUrls[sound.slot] = `/api/uploads/sounds/${sound.filename}`
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

fastify.post('/register', async (request, reply) => {
    const { username, email, password } = request.body

    const password_hash = await bcrypt.hash(password, 10)

    try {
      const user = await prisma.users.create({
        data: { username, email, password_hash }
      })
      return { id: user.id, username: user.username }
    } catch (err) {
      if (err.code === 'P2002') {
        return reply.code(409).send({ error: 'Username or email already taken' })
      }
      throw err
    }
})

fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user) {
      return reply.code(401).send({ error: 'Invalid username or password' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid username or password' })
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username })
    return { token }
})

fastify.get('/profile', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.users.findUnique({ where: { id: request.user.id } })
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }
    return { id: user.id, username: user.username, email: user.email }
})

// Returns a snapshot of all registered users, with their current online status.
// Shape: { username, online }
fastify.get('/online', { onRequest: [fastify.authenticate] }, async () => {
    const users = await prisma.users.findMany({ select: { id: true, username: true } })
    return users.map((user) => ({
        username: user.username,
        online: wsConnectionRegistry.has(user.id),
    }))
})

fastify.listen({port: 3000, host: '0.0.0.0'}, function(err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})
