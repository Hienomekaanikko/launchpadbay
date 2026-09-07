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

fastify.get('/health/db', async () => {
    const [{ ok }] = await prisma.$queryRaw`SELECT 1 AS ok`
    return { ok: Number(ok) }
})

fastify.get('/themes', async () => {
    const themeRows = await prisma.themes.findMany({
        include: { theme_sounds: true }
    })

    return themeRows.map((theme) => {
        const sounds = {}
        for (const sound of theme.theme_sounds) {
            sounds[sound.slot] = `/api/uploads/sounds/${sound.filename}`
        }
        return {
            id: theme.id,
            name: theme.name,
            bgImage: theme.bg_image ? `/api/uploads/images/${theme.bg_image}` : null,
            bodyClass: theme.body_class,
            sounds,
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

fastify.listen({port: 3000, host: '0.0.0.0'}, function(err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})
