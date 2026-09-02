import 'dotenv/config'
import Fastify from 'fastify'
import mysql from 'mysql2/promise'

const fastify = Fastify({
    logger: true
})

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
})

fastify.decorate('mysql', pool)

fastify.addHook('onClose', async () => {
    await pool.end()
})

import cors from '@fastify/cors'

await fastify.register(cors, {
    origin: 'http://localhost:5173'
})

fastify.get('/health/db', async () => {
    const [rows] = await fastify.mysql.query('SELECT 1 AS ok')
    return rows[0]
})

fastify.listen({port: 3000}, function(err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})