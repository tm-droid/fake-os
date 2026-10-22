// Tiny pub/sub bus. The whole OS talks through one shared instance.
export function createEvents() {
  const listeners = new Map();

  function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    listeners.get(name)?.delete(fn);
  }

  function emit(name, payload) {
    for (const fn of [...(listeners.get(name) ?? [])]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] "${name}" listener failed`, err);
      }
    }
  }

  return { on, off, emit };
}

export const events = createEvents();
