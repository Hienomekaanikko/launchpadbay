// Fetches the theme list (colors, background image, and per-slot sound URLs)
// from the backend's /themes route, proxied through nginx at /api/themes.
// Replaces the old static import.meta.glob-bundled version — sounds and
// theme images now live on the backend, not in the frontend build.
async function fetchThemesOnce() {
  const res = await fetch('/api/themes')
  if (!res.ok) throw new Error(`Failed to load themes: ${res.status}`)
  return res.json()
}

// The backend container can still be starting up (e.g. waiting on a slow
// MySQL) when the launchpad loads, so a single failed request here isn't a
// real failure — retry with backoff instead of surfacing a broken UI while
// the backend catches up. isCancelled lets the caller stop retrying once the
// component unmounts.
export async function fetchThemes(isCancelled = () => false) {
  let delay = 1000
  for (;;) {
    try {
      return await fetchThemesOnce()
    } catch (err) {
      if (isCancelled()) throw err
      console.warn(`Themes not available yet, retrying in ${delay}ms:`, err.message)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, 10000)
    }
  }
}
