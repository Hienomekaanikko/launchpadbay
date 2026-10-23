import { useEffect, useRef } from 'react'

const NEAR_BOTTOM_PX = 40

// Keeps a scrolling message list at the bottom as new messages arrive, unless
// the user has scrolled up to read older ones. Our own messages always scroll down.
// Put listRef and onScroll on the scrolling element.
export default function useStickToBottom(messages) {
  const listRef = useRef(null)
  const atBottomRef = useRef(true)

  const onScroll = () => {
    const list = listRef.current
    atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (atBottomRef.current || messages.at(-1)?.fromMe) list.scrollTop = list.scrollHeight
  }, [messages])

  return { listRef, onScroll }
}
