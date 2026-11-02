import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from './auth.js'
import { onMessage } from './useSocket.js'

const EMPTY = { friends: [], incoming: [], outgoing: [] }

// Keeps the logged-in user's friends and pending requests (all as { id, username }).
// REST: refetches on login, on refresh(), and after each of our own actions.
// The socket only brings renames, so the names stay current without a refetch.
export default function useFriends(token, socket) {
  const [lists, setLists] = useState(EMPTY)
  // ids of users with a friend action still on its way: a second click (e.g. a double
  // click on 'add') is ignored until the first one is done, so no duplicate request is sent
  const inFlight = useRef(new Set())

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

  useEffect(() => {
    if (!socket) return
    const rename = (list, msg) => list.map((user) => (user.id === msg.id ? { ...user, username: msg.username } : user))
    return onMessage(socket, (msg) => {
      if (msg.type !== 'user_renamed') return
      setLists((prev) => ({
        friends: rename(prev.friends, msg),
        incoming: rename(prev.incoming, msg),
        outgoing: rename(prev.outgoing, msg),
      }))
    })
  }, [socket])

  // runs an API call for the given user ({ id, username }), then refetches so every
  // list stays in sync with the server. A failed call needs no message: it's almost always
  // the other user acting first (e.g. removing the request), and the refetch shows the result
  const act = (apiCall) => (user) => {
    if (inFlight.current.has(user.id)) return Promise.resolve()
    inFlight.current.add(user.id)
    return apiCall(token, user.id)
      .catch(() => {})
      .finally(() => {
        inFlight.current.delete(user.id)
        refresh()
      })
  }

  return {
    ...lists,
    refresh,
    add: act(sendFriendRequest),
    accept: act(acceptFriendRequest),
    reject: act(rejectFriendRequest),
    remove: act(removeFriend),
  }
}
