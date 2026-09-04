import theme1Bg from '../assets/theme-1.jpg'

// Bulk-import every src/assets/soundN.wav at build time. `eager: true` +
// `import: 'default'` resolves each one to its final built URL immediately,
// instead of returning a lazy import() promise per file.
const soundFiles = import.meta.glob('../assets/sound*.wav', { eager: true, query: '?url', import: 'default' })

// Reshape { '../assets/sound7.wav': '/assets/sound7-xyz.wav', ... } into
// { 7: '/assets/sound7-xyz.wav', ... } — the slot-number keys engine.js
// expects (it maps slot N to button btnN).
const sounds = {}
for (const path in soundFiles) {
  const slot = path.match(/sound(\d+)\.wav$/)?.[1]
  if (slot) sounds[slot] = soundFiles[path]
}

// Local placeholder theme — the original launchpad fetches this list (and each
// theme's sound files) from Supabase. No backend is wired up here yet, so this
// is a single static theme using the original's default palette, with the
// 25 local sound files above assigned by slot number.
export const themes = [
  {
    id: 'local',
    name: 'Default',
    colors: ['#ff1f71', '#2db2ff', '#1eff45', '#ffd500', '#ff6a00'],
    bg: ['#0f0a03', '#050300'],
    bgImage: theme1Bg,
    bodyClass: null,
    sounds,
  },
]
