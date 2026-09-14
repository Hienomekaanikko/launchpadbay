// Fetch-and-decode cache keyed by URL, so switching back to a theme doesn't
// re-download or re-decode anything.
//
// Takes a getter rather than the AudioContext itself because the context is
// built during init, after this is constructed. Decoding doesn't need a
// *running* context — a suspended one decodes fine — so nothing here has to
// wait on the user's first gesture.
export function createBuffers(getContext) {
  const cache = new Map()

  return {
    async load(url) {
      if (!cache.has(url)) {
        const resp = await fetch(url)
        const raw = await resp.arrayBuffer()
        cache.set(url, await getContext().decodeAudioData(raw))
      }
      return cache.get(url)
    },
  }
}
