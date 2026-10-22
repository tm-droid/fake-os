import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrefs, DEFAULTS } from '../js/kernel/prefs.js';
import { createStorage } from '../js/kernel/storage.js';
import { createEvents } from '../js/kernel/events.js';

function makePrefs() {
  const storage = createStorage(null);
  const events = createEvents();
  const seen = [];
  events.on('prefs:change', (next) => seen.push(next));
  return { prefs: createPrefs({ storage, events }), seen, storage, events };
}

test('starts from the defaults', () => {
  const { prefs } = makePrefs();
  assert.deepEqual(prefs.get(), DEFAULTS);
});

test('set merges, validates and announces the change', () => {
  const { prefs, seen } = makePrefs();
  const next = prefs.set({ accent: 'pink', appearance: 'dark', wallpaper: 'not-a-wallpaper' });
  assert.equal(next.accent, 'pink');
  assert.equal(next.appearance, 'dark');
  assert.equal(next.wallpaper, DEFAULTS.wallpaper);
  assert.deepEqual(seen.at(-1), next);
});

test('preferences survive a new instance and reset returns to defaults', () => {
  const { prefs, storage, events } = makePrefs();
  prefs.set({ appearance: 'dark' });
  assert.equal(createPrefs({ storage, events: createEvents() }).get().appearance, 'dark');
  prefs.reset();
  assert.deepEqual(prefs.get(), DEFAULTS);
});
