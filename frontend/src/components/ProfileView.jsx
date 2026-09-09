import { useEffect, useState } from 'react'
import { fetchProfile } from '../auth.js'

export default function ProfileView({ token }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchProfile(token)
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="Profile">
      {error && <div className="FormError">{error}</div>}
      {!error && !profile && <div>Loading...</div>}
      {profile && <div>Logged in as: {profile.username}</div>}
      {profile && <div>Here will be avatar and additional information</div>}
    </div>
  )
}
