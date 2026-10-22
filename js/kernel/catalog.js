// App catalog: which registered apps are installed, and the store listing that describes each one.
// Every app is installed by default. Only removals are saved, so an app shipped later shows up installed.
import { events as defaultEvents } from './events.js';
import { storage as defaultStorage } from './storage.js';

export const CATALOG_KEY = 'fakeos.apps.v1';

// Core apps are part of the system: they can be opened but never removed.
export const CORE_APPS = Object.freeze(['files', 'settings', 'store']);

export const CATEGORIES = Object.freeze(['All', 'Utilities', 'Games', 'System']);

// Store copy and size for each app, keyed by app id. Unknown ids get a generic listing.
export const LISTINGS = Object.freeze({
  files: { category: 'System', summary: 'Browse, organize and open every file on your disk.', size: 6.2 },
  notes: { category: 'Utilities', summary: 'Write and save plain-text notes.', size: 3.4 },
  terminal: { category: 'Utilities', summary: 'Run commands against the FakeOS file system.', size: 4.8 },
  calculator: { category: 'Utilities', summary: 'Basic and scientific calculations.', size: 2.1 },
  paint: { category: 'Utilities', summary: 'Sketch and edit images on a canvas.', size: 5.6 },
  settings: { category: 'System', summary: 'Change wallpaper, accent color and appearance.', size: 3.0 },
  snake: { category: 'Games', summary: 'Eat, grow and avoid the walls.', size: 1.2 },
  clock: { category: 'Utilities', summary: 'World time, alarms and a stopwatch.', size: 1.9 },
  activity: { category: 'System', summary: 'See what is running and quit stuck apps.', size: 1.6 },
  store: { category: 'System', summary: 'Find, install and remove apps.', size: 2.7 },
});

const PUBLISHER = 'FakeOS';

export function createCatalog({ apps, storage = defaultStorage, events = defaultEvents, key = CATALOG_KEY }) {
  const byId = new Map(apps.map((app) => [app.id, app]));

  // Reads the saved removals and drops anything that is unknown or core.
  function load() {
    const raw = storage.get(key);
    const list = Array.isArray(raw?.removed) ? raw.removed : [];
    return new Set(list.filter((id) => byId.has(id) && !CORE_APPS.includes(id)));
  }

  let removed = load();

  function save() {
    return storage.set(key, { removed: [...removed] });
  }

  function isInstalled(id) {
    return byId.has(id) && !removed.has(id);
  }

  function isCore(id) {
    return CORE_APPS.includes(id);
  }

  function listing(id) {
    const app = byId.get(id);
    if (!app) return null;
    const meta = LISTINGS[id] ?? { category: 'Utilities', summary: `${app.name} for FakeOS.`, size: 1 };
    return {
      id,
      name: app.name,
      glyph: app.glyph,
      tile: app.tile,
      publisher: PUBLISHER,
      category: meta.category,
      summary: meta.summary,
      size: meta.size,
      core: isCore(id),
      installed: isInstalled(id),
    };
  }

  // Every app with its listing, sorted by name, for the store.
  function listings() {
    return [...byId.keys()].map(listing).sort((a, b) => a.name.localeCompare(b.name));
  }

  function installedApps() {
    return [...byId.values()].filter((app) => isInstalled(app.id));
  }

  // Returns { ok, reason } so callers can tell the user why a change was refused.
  function setInstalled(id, installed) {
    if (!byId.has(id)) return { ok: false, reason: 'unknown' };
    if (!installed && isCore(id)) return { ok: false, reason: 'core' };
    if (isInstalled(id) === installed) return { ok: true };

    const previous = new Set(removed);
    if (installed) removed.delete(id);
    else removed.add(id);

    const saved = save();
    if (!saved.ok) {
      removed = previous;
      return { ok: false, reason: saved.reason ?? 'unknown' };
    }
    events.emit('apps:installed', { id, installed });
    return { ok: true };
  }

  return {
    isInstalled,
    isCore,
    listing,
    listings,
    installedApps,
    install: (id) => setInstalled(id, true),
    uninstall: (id) => setInstalled(id, false),
  };
}
