// Taskbar: Start button, a dock of pinned and running apps, and the tray with Wi-Fi, battery and clock.
import { appTile, glyph } from './icons.js';

const TRACKED = [
  'proc:start',
  'proc:stop',
  'apps:change',
  'apps:installed',
  'win:open',
  'win:close',
  'win:focus',
  'win:minimize',
  'win:restore',
];

export function createTaskbar({ el, os, toggleLauncher }) {
  const { events, wm, processes, popper, launch, catalog } = os;

  el.innerHTML = `
    <button type="button" class="tb-start" aria-label="Open launcher" title="Launcher">${glyph('grid')}</button>
    <div class="dock" role="toolbar" aria-label="Applications"></div>
    <div class="tray">
      <span class="tray-icon" title="Wi-Fi">${glyph('wifi')}</span>
      <span class="tray-icon" title="Battery">${glyph('battery')}<span class="battery-level"></span></span>
      <div class="clock"><span class="clock-time"></span><span class="clock-date"></span></div>
    </div>`;

  const dock = el.querySelector('.dock');
  const batteryLevel = el.querySelector('.battery-level');
  const timeEl = el.querySelector('.clock-time');
  const dateEl = el.querySelector('.clock-date');

  function renderDock() {
    const focused = wm.focused();
    const runningIds = new Set(processes.running().map((proc) => proc.appId));
    const shown = processes
      .apps()
      .filter((app) => catalog.isInstalled(app.id) && (app.pinned || runningIds.has(app.id)));
    dock.replaceChildren(
      ...shown.map((app) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dock-item';
        btn.dataset.app = app.id;
        btn.title = app.name;
        btn.setAttribute('aria-label', app.name);
        btn.classList.toggle('is-running', runningIds.has(app.id));
        btn.classList.toggle('is-active', focused?.appId === app.id);
        btn.innerHTML = `${appTile(app)}<span class="dock-dot"></span>`;
        return btn;
      }),
    );
  }

  // Click behaves like macOS: open if closed, hide if it is the frontmost app, otherwise bring its newest window forward.
  function activate(appId) {
    const pids = new Set(processes.running(appId).map((proc) => proc.pid));
    if (pids.size === 0) {
      launch(appId);
      return;
    }
    const focused = wm.focused();
    if (focused && pids.has(focused.pid)) {
      wm.minimize(focused.id);
      return;
    }
    const mine = wm.stacking().filter((win) => pids.has(win.pid));
    if (mine.length) wm.focus(mine[mine.length - 1].id);
    else launch(appId);
  }

  function quit(appId) {
    for (const proc of processes.running(appId)) processes.stop(proc.pid);
  }

  dock.addEventListener('click', (event) => {
    const btn = event.target.closest('.dock-item');
    if (btn) activate(btn.dataset.app);
  });

  dock.addEventListener('contextmenu', (event) => {
    const btn = event.target.closest('.dock-item');
    if (!btn) return;
    event.preventDefault();
    const appId = btn.dataset.app;
    const items = [{ label: 'New Window', action: () => launch(appId) }];
    if (processes.running(appId).length > 0) {
      items.push('-', { label: 'Quit', danger: true, action: () => quit(appId) });
    }
    popper.show(event.clientX, event.clientY, items);
  });

  el.querySelector('.tb-start').addEventListener('click', () => toggleLauncher());

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  function tick() {
    const now = new Date();
    timeEl.textContent = timeFmt.format(now);
    dateEl.textContent = dateFmt.format(now);
  }
  tick();
  setInterval(tick, 1000);

  // Battery is optional: some browsers do not expose it, and the tray simply shows no number.
  const pendingBattery = navigator.getBattery?.();
  pendingBattery
    ?.then((battery) => {
      const show = () => {
        batteryLevel.textContent = ` ${Math.round(battery.level * 100)}%`;
      };
      show();
      battery.addEventListener('levelchange', show);
    })
    .catch(() => {});

  for (const name of TRACKED) events.on(name, renderDock);
  renderDock();
}
