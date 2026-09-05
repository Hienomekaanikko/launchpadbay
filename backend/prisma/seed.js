import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    allowPublicKeyRetrieval: true,
})

const prisma = new PrismaClient({ adapter })

async function main() {
    await prisma.themes.upsert({
        where: { id: 'local' },
        update: {
            name: 'Default',
            bg_image: 'theme-1.jpg',
        },
        create: {
            id: 'local',
            name: 'Default',
            bg_image: 'theme-1.jpg',
        },
    })

    for (let slot = 1; slot <= 25; slot++) {
        const filename = `sound${slot}.wav`
        await prisma.theme_sounds.upsert({
            where: { theme_id_slot: { theme_id: 'local', slot } },
            update: { filename },
            create: { theme_id: 'local', slot, filename },
        })
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err)
        await prisma.$disconnect()
        process.exit(1)
    })
