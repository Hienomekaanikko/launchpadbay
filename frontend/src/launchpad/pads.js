export const CHANNEL_COUNT = 5
export const SLOTS_PER_CHANNEL = 5
export const PAD_COUNT = CHANNEL_COUNT * SLOTS_PER_CHANNEL

export const channelOfPad = (pad) => Math.ceil(pad / SLOTS_PER_CHANNEL)
export const slotOfPad = (pad) => ((pad - 1) % SLOTS_PER_CHANNEL) + 1
export const padAt = (channelId, slot) => (channelId - 1) * SLOTS_PER_CHANNEL + slot
export const padDomId = (pad) => `btn${pad}`
