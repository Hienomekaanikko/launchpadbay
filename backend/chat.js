import {
    send,
    sendToUser,
    wsConnectionRegistry,
    MAX_WS_BYTES_PER_FRAME
} from './ws.js'

// Math.max() with 0 as first argument protects us from ever getting a negative
// value, should the constant byte cap (per frame) ever change
const MAX_TEXT_BYTES = Math.max(0, Math.floor(MAX_WS_BYTES_PER_FRAME * 0.75))

// Delivers chat message to the recipient and saves its row in the DB - but only
// if recipient is online
export async function handleChatMessage(msg, { userId, username, socket, prisma }) {
    // trimming leading and trailing spaces is standard in chat functionality
    const text = typeof msg.text === 'string' ? msg.text.trim() : ''
    if (!text) {
        send(socket, { type: 'error', reason: 'empty_message' })
        return
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
        send(socket, { type: 'error', reason: 'message_too_long' })
        return
    }
    if (typeof msg.to !== 'string' || msg.to === username) {
        send(socket, { type: 'error', reason: 'no_such_user' })
        return
    }

    const recipient = await prisma.users.findUnique({
        where: { username: msg.to },
        select: { id: true, username: true }
    })
    if (!recipient) {
        send(socket, { type: 'error', reason: 'no_such_user' })
        return
    }

    if (!wsConnectionRegistry.has(recipient.id)) {
        send(socket, { type: 'error', reason: 'user_offline' })
        return
    }

    const saved = await prisma.messages.create({
        data: { sender_id: userId, receiver_id: recipient.id, content: text },
        select: { id: true, created_at: true }
    })

    const payload = {
        type: 'chat_message',
        from: username,
        to: recipient.username, // for the recipient to route message to the correct conversation
        text,
        id: saved.id,
        clientId: msg.clientId, // useful for optimistic reconciliation on sender's side
        createdAt: saved.created_at // for ordering, and history merge
    }
    // forward the message to the recipient
    sendToUser(recipient.id, payload)
    // and forward it also to the sender, as a sign of success
    send(socket, payload)
}
