// App registry and process table. A process is one running instance of an app.
// Starting or stopping a process emits events; main.js turns those into windows.
import { events as defaultEvents } from './events.js';

export function createProcesses({ events = defaultEvents } = {}) {
  const registry = new Map();
  const table = [];
  let nextPid = 100;

  function register(app) {
    if (!app || !app.id || typeof app.open !== 'function') throw new Error('Invalid app definition');
    if (registry.has(app.id)) throw new Error(`App already registered: ${app.id}`);
    registry.set(app.id, app);
    events.emit('apps:change');
    return app;
  }

  function app(id) {
    return registry.get(id) ?? null;
  }

  function apps() {
    return [...registry.values()];
  }

  function running(appId) {
    return appId ? table.filter((proc) => proc.appId === appId) : [...table];
  }

  function start(appId, args = {}) {
    const def = registry.get(appId);
    if (!def) throw new Error(`Unknown app: ${appId}`);
    const proc = { pid: nextPid++, appId, args, title: def.name };
    table.push(proc);
    events.emit('proc:start', proc);
    return proc;
  }

  function stop(pid) {
    const index = table.findIndex((proc) => proc.pid === pid);
    if (index === -1) return false;
    const [proc] = table.splice(index, 1);
    events.emit('proc:stop', proc);
    return true;
  }

  return { register, app, apps, running, start, stop };
}
