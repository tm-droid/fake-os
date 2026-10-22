// JSON wrapper over localStorage. A blocked or full store never throws into the rest of the OS;
// when storage is unavailable everything falls back to memory for the life of the page.
function defaultArea() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some sandboxed contexts throw on access
  }
}

export function createStorage(area = defaultArea()) {
  const memory = new Map();
  let usable = false;

  try {
    if (area) {
      area.setItem('__fakeos_probe__', '1');
      area.removeItem('__fakeos_probe__');
      usable = true;
    }
  } catch {
    usable = false;
  }

  return {
    usable,

    get(key, fallback = null) {
      try {
        const raw = usable ? area.getItem(key) : (memory.get(key) ?? null);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      const raw = JSON.stringify(value);
      if (!usable) {
        memory.set(key, raw);
        return { ok: true };
      }
      try {
        area.setItem(key, raw);
        return { ok: true };
      } catch (err) {
        const quota = err?.name === 'QuotaExceededError' || err?.code === 22;
        return { ok: false, reason: quota ? 'quota' : 'unknown' };
      }
    },

    remove(key) {
      if (!usable) {
        memory.delete(key);
        return;
      }
      try {
        area.removeItem(key);
      } catch {
        // ignore: nothing useful to do if the store refuses
      }
    },
  };
}

export const storage = createStorage();
