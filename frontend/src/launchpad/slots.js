// Slots run 1..25, left-to-right then top-to-bottom, five per row. A slot's pad
// is `btn<slot>` and its sound is `sound<slot>`, so the row and the sound/pad
// pairing are both derivable — no lookup tables needed.

export const ROWS = 5
export const PADS = 25
export const PADS_PER_ROW = PADS / ROWS

export const buttonIdOfSlot = (slot) => `btn${slot}`
export const soundNameOfSlot = (slot) => `sound${slot}`
export const buttonIdOfSound = (name) => `btn${name.slice(5)}`
export const rowOfButton = (buttonId) =>
  Math.floor((Number(buttonId.slice(3)) - 1) / PADS_PER_ROW) + 1
