// Friend requests and friend list routes
export default async function friends(fastify) {
    const { prisma } = fastify

    // finds the friendship row between two users, whichever of them sent the request
    function findFriendship(aId, bId) {
        return prisma.friendships.findFirst({
            where: {
                OR: [
                    { requester_id: aId, addressee_id: bId },
                    { requester_id: bId, addressee_id: aId },
                ]
            }
        })
    }

    function findUserByName(username) {
        return prisma.users.findUnique({ where: { username: String(username) } })
    }

    // Returns the caller's friends and pending requests, as usernames.
    // Shape: { friends: [username], incoming: [username], outgoing: [username] }
    fastify.get('/friends', { onRequest: [fastify.authenticate] }, async (request) => {
        const me = request.user.id
        const rows = await prisma.friendships.findMany({
            where: { OR: [{ requester_id: me }, { addressee_id: me }] },
            include: {
                requester: { select: { username: true } },
                addressee: { select: { username: true } },
            }
        })

        const result = { friends: [], incoming: [], outgoing: [] }
        for (const row of rows) {
            const sentByMe = row.requester_id === me
            const other = sentByMe ? row.addressee.username : row.requester.username
            if (row.status === 'accepted') result.friends.push(other)
            else if (sentByMe) result.outgoing.push(other)
            else result.incoming.push(other)
        }
        return result
    })

    // Sends a friend request. If the other user already requested us, accepts theirs instead.
    fastify.post('/friends/requests', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const me = request.user.id
        const other = await findUserByName(request.body?.username)
        if (!other) {
            return reply.code(404).send({ error: 'User not found' })
        }
        if (other.id === me) {
            return reply.code(400).send({ error: 'You cannot add yourself' })
        }

        const existing = await findFriendship(me, other.id)
        if (existing?.status === 'accepted') {
            return reply.code(409).send({ error: 'Already friends' })
        }
        if (existing?.requester_id === me) {
            return reply.code(409).send({ error: 'Request already sent' })
        }
        if (existing) {
            await prisma.friendships.update({
                where: { requester_id_addressee_id: { requester_id: other.id, addressee_id: me } },
                data: { status: 'accepted' }
            })
            return { status: 'accepted' }
        }

        await prisma.friendships.create({ data: { requester_id: me, addressee_id: other.id } })
        return { status: 'pending' }
    })

    // Accepts a pending request that :username sent to the caller
    fastify.post('/friends/requests/:username/accept', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const other = await findUserByName(request.params.username)
        if (!other) {
            return reply.code(404).send({ error: 'User not found' })
        }
        const { count } = await prisma.friendships.updateMany({
            where: { requester_id: other.id, addressee_id: request.user.id, status: 'pending' },
            data: { status: 'accepted' }
        })
        if (count === 0) {
            return reply.code(404).send({ error: 'Friend request not found' })
        }
        return { status: 'accepted' }
    })

    // Rejects a pending request that :username sent to the caller
    fastify.delete('/friends/requests/:username', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const other = await findUserByName(request.params.username)
        if (!other) {
            return reply.code(404).send({ error: 'User not found' })
        }
        const { count } = await prisma.friendships.deleteMany({
            where: { requester_id: other.id, addressee_id: request.user.id, status: 'pending' }
        })
        if (count === 0) {
            return reply.code(404).send({ error: 'Friend request not found' })
        }
        return { ok: true }
    })

    // Removes a friend, whichever of the two sent the original request
    fastify.delete('/friends/:username', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const me = request.user.id
        const other = await findUserByName(request.params.username)
        if (!other) {
            return reply.code(404).send({ error: 'User not found' })
        }
        const { count } = await prisma.friendships.deleteMany({
            where: {
                status: 'accepted',
                OR: [
                    { requester_id: me, addressee_id: other.id },
                    { requester_id: other.id, addressee_id: me },
                ]
            }
        })
        if (count === 0) {
            return reply.code(404).send({ error: 'Friend not found' })
        }
        return { ok: true }
    })
}
