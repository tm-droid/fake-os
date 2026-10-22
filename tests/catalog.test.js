import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, CATALOG_KEY } from '../js/kernel/catalog.js';
import { createStorage } from '../js/kernel/storage.js';
import { createEvents } from '../js/kernel/events.js';

const APPS = [
  { id: 'files', name: 'Files', glyph: 'folder', tile: 'x' },
  { id: 'settings', name: 'Settings', glyph: 'gear', tile: 'x' },
  { id: 'store', name: 'App Store', glyph: 'grid', tile: 'x' },
  { id: 'snake', name: 'Snake', glyph: 'snake', tile: 'x' },
  { id: 'clock', name: 'Clock', glyph: 'clock', tile: 'x' },
];

function makeCatalog(storage = createStorage(null)) {
  const events = createEvents();
  const seen = [];
  events.on('apps:installed', (payload) => seen.push(payload));
  const catalog = createCatalog({ apps: APPS, storage, events });
  return { catalog, storage, seen };
}

test('every registered app starts installed', () => {
  const { catalog } = makeCatalog();
  assert.deepEqual(
    catalog.installedApps().map((app) => app.id),
    APPS.map((app) => app.id),
  );
});

test('uninstall and install round trip, announcing each change', () => {
  const { catalog, seen } = makeCatalog();
  assert.deepEqual(catalog.uninstall('snake'), { ok: true });
  assert.equal(catalog.isInstalled('snake'), false);
  assert.ok(!catalog.installedApps().some((app) => app.id === 'snake'));

  assert.deepEqual(catalog.install('snake'), { ok: true });
  assert.equal(catalog.isInstalled('snake'), true);
  assert.deepEqual(seen, [
    { id: 'snake', installed: false },
    { id: 'snake', installed: true },
  ]);
});

test('repeating the current state is a no-op with no event', () => {
  const { catalog, seen } = makeCatalog();
  assert.deepEqual(catalog.install('clock'), { ok: true });
  assert.equal(seen.length, 0);
});

test('core apps cannot be removed', () => {
  const { catalog, seen } = makeCatalog();
  for (const id of ['files', 'settings', 'store']) {
    assert.deepEqual(catalog.uninstall(id), { ok: false, reason: 'core' });
    assert.equal(catalog.isInstalled(id), true);
  }
  assert.equal(seen.length, 0);
});

test('unknown apps are refused', () => {
  const { catalog } = makeCatalog();
  assert.deepEqual(catalog.install('nope'), { ok: false, reason: 'unknown' });
  assert.deepEqual(catalog.uninstall('nope'), { ok: false, reason: 'unknown' });
  assert.equal(catalog.isInstalled('nope'), false);
});

test('removals persist across instances', () => {
  const { catalog, storage } = makeCatalog();
  catalog.uninstall('clock');
  const again = createCatalog({ apps: APPS, storage, events: createEvents() });
  assert.equal(again.isInstalled('clock'), false);
  assert.equal(again.isInstalled('snake'), true);
  assert.deepEqual(storage.get(CATALOG_KEY), { removed: ['clock'] });
});

test('corrupt or stale stored data is sanitized', () => {
  const storage = createStorage(null);
  storage.set(CATALOG_KEY, { removed: ['ghost', 'files', 'snake', 42] });
  const catalog = createCatalog({ apps: APPS, storage, events: createEvents() });
  assert.equal(catalog.isInstalled('files'), true);
  assert.equal(catalog.isInstalled('snake'), false);
  assert.equal(catalog.installedApps().length, APPS.length - 1);
});

test('a failed save rolls back and reports the reason', () => {
  const storage = createStorage(null);
  storage.set = () => ({ ok: false, reason: 'quota' });
  const catalog = createCatalog({ apps: APPS, storage, events: createEvents() });
  assert.deepEqual(catalog.uninstall('snake'), { ok: false, reason: 'quota' });
  assert.equal(catalog.isInstalled('snake'), true);
});

test('listings carry store metadata and installed state', () => {
  const { catalog } = makeCatalog();
  catalog.uninstall('snake');
  const snake = catalog.listing('snake');
  assert.equal(snake.category, 'Games');
  assert.equal(snake.publisher, 'FakeOS');
  assert.equal(snake.installed, false);
  assert.equal(snake.core, false);
  assert.equal(catalog.listing('files').core, true);
  assert.equal(catalog.listing('missing'), null);
  assert.deepEqual(
    catalog.listings().map((app) => app.name),
    ['App Store', 'Clock', 'Files', 'Settings', 'Snake'],
  );
});
