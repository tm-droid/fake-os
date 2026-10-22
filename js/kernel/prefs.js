// User preferences: wallpaper, accent color, appearance. Kept apart from the virtual disk.
import { events as defaultEvents } from './events.js';
import { storage as defaultStorage } from './storage.js';

export const PREFS_KEY = 'fakeos.prefs.v1';

export const WALLPAPERS = {
  dusk: { label: 'Dusk', css: 'linear-gradient(160deg, #0f2027 0%, #2c5364 45%, #f2a365 100%)' },
  aurora: { label: 'Aurora', css: 'radial-gradient(circle at 20% 20%, #5ee7df 0%, #b490ca 45%, #1b1f3b 100%)' },
  sand: { label: 'Sand', css: 'linear-gradient(180deg, #fbd3a2 0%, #f7797d 60%, #5e3a6e 100%)' },
  graphite: { label: 'Graphite', css: 'linear-gradient(180deg, #3a3d52 0%, #14151f 100%)' },
};

export const ACCENTS = {
  blue: { label: 'Blue', value: '#0a84ff' },
  purple: { label: 'Purple', value: '#bf5af2' },
  pink: { label: 'Pink', value: '#ff375f' },
  orange: { label: 'Orange', value: '#ff9f0a' },
  green: { label: 'Green', value: '#30d158' },
  graphite: { label: 'Graphite', value: '#8e8e93' },
};

export const DEFAULTS = Object.freeze({ wallpaper: 'dusk', accent: 'blue', appearance: 'light' });

function sanitize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    wallpaper: WALLPAPERS[src.wallpaper] ? src.wallpaper : DEFAULTS.wallpaper,
    accent: ACCENTS[src.accent] ? src.accent : DEFAULTS.accent,
    appearance: src.appearance === 'dark' ? 'dark' : 'light',
  };
}

export function createPrefs({ storage = defaultStorage, events = defaultEvents, key = PREFS_KEY } = {}) {
  let current = sanitize(storage.get(key));

  function get() {
    return { ...current };
  }

  function set(patch) {
    current = sanitize({ ...current, ...patch });
    const result = storage.set(key, current);
    if (!result.ok) events.emit('prefs:error', { reason: result.reason });
    events.emit('prefs:change', get());
    return get();
  }

  function reset() {
    storage.remove(key);
    current = sanitize(DEFAULTS);
    events.emit('prefs:change', get());
  }

  return { get, set, reset };
}
