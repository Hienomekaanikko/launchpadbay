// Fetch-and-decode cache keyed by URL, so switching back to a theme doesn't
// re-download or re-decode anything. A suspended AudioContext decodes fine.
export function createBuffers(ctx) {
  const cache = new Map()

  return {
    async load(url) {
      if (!cache.has(url)) {
        const resp = await fetch(url)
        const raw = await resp.arrayBuffer()
        cache.set(url, await ctx.decodeAudioData(raw))
      }
      return cache.get(url)
    },
  }
}
