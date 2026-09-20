// Tracked setTimeouts so teardown can clear them all.

export function createUiTimers() {
  const ids = new Set()

  function cancel(id) {
    ids.delete(id)
    clearTimeout(id)
  }

  function track(fn, delayMs) {
    const id = setTimeout(() => {
      ids.delete(id)
      fn()
    }, delayMs)
    ids.add(id)
    return id
  }

  function clearAll() {
    for (const id of ids) clearTimeout(id)
    ids.clear()
  }

  return { track, cancel, clearAll }
}
