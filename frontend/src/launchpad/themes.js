// Fetches the theme list (colors, background image, and per-slot sound URLs)
// from the backend's /themes route, proxied through nginx at /api/themes.
// Replaces the old static import.meta.glob-bundled version — sounds and
// theme images now live on the backend, not in the frontend build.
export async function fetchThemes() {
  const res = await fetch('/api/themes')
  if (!res.ok) throw new Error(`Failed to load themes: ${res.status}`)
  return res.json()
}
