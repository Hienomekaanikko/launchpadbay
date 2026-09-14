// Slots run 1..25, left-to-right then top-to-bottom, five per row. A slot is an
// integer everywhere inside the engine: it keys `sounds`, it's what the voice
// functions take, and the row derives from it. The pad's DOM id is the only
// string form, so `padId` is the sole encoder here and only the view calls it.

export const ROWS = 5
export const PADS = 25
export const PADS_PER_ROW = PADS / ROWS

export const rowOfSlot = (slot) => Math.ceil(slot / PADS_PER_ROW)
export const padId = (slot) => `btn${slot}`
