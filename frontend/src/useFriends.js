import { useCallback, useEffect, useState } from 'react'
import {
  fetchFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from './auth.js'

const EMPTY = { friends: [], incoming: [], outgoing: [] }

// Keeps the logged-in user's friends and pending requests (all as usernames).
// REST only: refetches on login, on refresh(), and after each of our own actions.
export default function useFriends(token) {
  const [lists, setLists] = useState(EMPTY)

  const refresh = useCallback(() => {
    if (!token) return
    fetchFriends(token)
      .then(setLists)
      .catch((err) => console.error('Failed to fetch friends:', err))
  }, [token])

  // initial load per login; ignores a late response if the user has logged out meanwhile
  useEffect(() => {
    setLists(EMPTY)
    if (!token) return
    let cancelled = false
    fetchFriends(token)
      .then((data) => { if (!cancelled) setLists(data) })
      .catch((err) => console.error('Failed to fetch friends:', err))
    return () => { cancelled = true }
  }, [token])

  // runs an API call, then refetches so every list stays in sync with the server
  const act = (apiCall, label) => (username) =>
    apiCall(token, username)
      .catch((err) => console.error(`Failed to ${label}:`, err))
      .finally(refresh)

  return {
    ...lists,
    refresh,
    add: act(sendFriendRequest, 'send friend request'),
    accept: act(acceptFriendRequest, 'accept friend request'),
    reject: act(rejectFriendRequest, 'reject friend request'),
    remove: act(removeFriend, 'remove friend'),
  }
}
