// Owns everything that has to be undone when the launchpad unmounts: listeners
// registered through `on`, timeouts scheduled through `track`, and the
// `destroyed` flag that deferred callbacks check before they touch anything.
//
// A factory rather than module state on purpose — LaunchpadView mounts and
// unmounts the engine from an effect, and each mount needs its own registry.
export function createLifecycle() {
  let destroyed = false
  const listeners = [] // { target, type, handler, opts }
  const timeouts = new Set()

  return {
    isDestroyed: () => destroyed,

    on(target, type, handler, opts) {
      target.addEventListener(type, handler, opts)
      listeners.push({ target, type, handler, opts })
    },

    track(fn, ms) {
      const id = setTimeout(() => {
        timeouts.delete(id)
        fn()
      }, ms)
      timeouts.add(id)
      return id
    },

    // Cancels a tracked timeout before it fires.
    cancel(id) {
      clearTimeout(id)
      timeouts.delete(id)
    },

    teardown() {
      destroyed = true

      for (const id of timeouts) clearTimeout(id)
      timeouts.clear()

      for (const { target, type, handler, opts } of listeners) {
        target.removeEventListener(type, handler, opts)
      }
      listeners.length = 0
    },
  }
}
