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

    function findUser(id) {
        return prisma.users.findUnique({ where: { id: String(id) } })
    }

    // Returns the caller's friends and pending requests, as user refs.
    // Shape: { friends: [{ id, username }], incoming: [...], outgoing: [...] }
    fastify.get('/friends', { onRequest: [fastify.authenticate] }, async (request) => {
        const me = request.user.id
        const rows = await prisma.friendships.findMany({
            where: { OR: [{ requester_id: me }, { addressee_id: me }] },
            include: {
                requester: { select: { id: true, username: true } },
                addressee: { select: { id: true, username: true } },
            }
        })

        const result = { friends: [], incoming: [], outgoing: [] }
        for (const row of rows) {
            const sentByMe = row.requester_id === me
            const other = sentByMe ? row.addressee : row.requester
            if (row.status === 'accepted') result.friends.push(other)
            else if (sentByMe) result.outgoing.push(other)
            else result.incoming.push(other)
        }
        return result
    })

    // Sends a friend request. If the other user already requested us, accepts theirs instead.
    fastify.post('/friends/requests', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const me = request.user.id
        const other = await findUser(request.body?.id)
        if (!other) {
            return reply.code(404).send({ error: 'user_not_found' })
        }
        if (other.id === me) {
            return reply.code(400).send({ error: 'cannot_add_self' })
        }

        // Already done (e.g. from another tab): not an error, just answer with the current state
        const existing = await findFriendship(me, other.id)
        if (existing?.status === 'accepted') {
            return { status: 'accepted' }
        }
        if (existing?.requester_id === me) {
            return { status: 'pending' }
        }
        if (existing) {
            // updateMany, not update: their request may have been rejected or removed
            // since we looked, and then there is no row left to accept
            const { count } = await prisma.friendships.updateMany({
                where: { requester_id: other.id, addressee_id: me, status: 'pending' },
                data: { status: 'accepted' }
            })
            if (count === 0) {
                return reply.code(404).send({ error: 'friend_request_not_found' })
            }
            return { status: 'accepted' }
        }

        try {
            await prisma.friendships.create({ data: { requester_id: me, addressee_id: other.id } })
        } catch (err) {
            if (err.code === 'P2002') { // the same request sent twice at once (e.g. a double click)
                return { status: 'pending' }
            }
            throw err
        }

        // If the other user added us at the same moment, both checks above saw nothing and
        // there is now one row per direction. Both requests resolve it the same way: keep the
        // row whose requester id sorts first, as an accepted friendship, and drop the other.
        const reverse = await prisma.friendships.findUnique({
            where: { requester_id_addressee_id: { requester_id: other.id, addressee_id: me } }
        })
        if (reverse) {
            const [first, second] = [me, other.id].sort()
            await prisma.$transaction([
                prisma.friendships.deleteMany({ where: { requester_id: second, addressee_id: first } }),
                prisma.friendships.updateMany({
                    where: { requester_id: first, addressee_id: second },
                    data: { status: 'accepted' }
                })
            ])
            return { status: 'accepted' }
        }
        return { status: 'pending' }
    })

    // Accepts a pending request that :id sent to the caller
    fastify.post('/friends/requests/:id/accept', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const other = await findUser(request.params.id)
        if (!other) {
            return reply.code(404).send({ error: 'user_not_found' })
        }
        const { count } = await prisma.friendships.updateMany({
            where: { requester_id: other.id, addressee_id: request.user.id, status: 'pending' },
            data: { status: 'accepted' }
        })
        if (count === 0) {
            // accepted already (e.g. from another tab) is fine; a request that's gone isn't
            const existing = await findFriendship(request.user.id, other.id)
            if (existing?.status !== 'accepted') {
                return reply.code(404).send({ error: 'friend_request_not_found' })
            }
        }
        return { status: 'accepted' }
    })

    // Rejects a pending request that :id sent to the caller. Like remove below, it succeeds
    // when there's nothing left to delete, since the result is what the caller wanted
    fastify.delete('/friends/requests/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const other = await findUser(request.params.id)
        if (!other) {
            return reply.code(404).send({ error: 'user_not_found' })
        }
        await prisma.friendships.deleteMany({
            where: { requester_id: other.id, addressee_id: request.user.id, status: 'pending' }
        })
        return { ok: true }
    })

    // Removes a friend, whichever of the two sent the original request
    fastify.delete('/friends/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const me = request.user.id
        const other = await findUser(request.params.id)
        if (!other) {
            return reply.code(404).send({ error: 'user_not_found' })
        }
        await prisma.friendships.deleteMany({
            where: {
                status: 'accepted',
                OR: [
                    { requester_id: me, addressee_id: other.id },
                    { requester_id: other.id, addressee_id: me },
                ]
            }
        })
        return { ok: true }
    })
}
