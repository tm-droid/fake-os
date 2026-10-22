// Start-style launcher: a searchable grid of every app, shown above the taskbar.
import { appTile, glyph } from './icons.js';

export function createLauncher({ el, processes, launchApp }) {
  el.innerHTML = `
    <div class="launcher-panel" role="dialog" aria-label="Launcher">
      <label class="launcher-search">
        ${glyph('search')}
        <input type="search" placeholder="Search apps" aria-label="Search apps" autocomplete="off" spellcheck="false">
      </label>
      <div class="launcher-grid"></div>
    </div>`;

  const panel = el.querySelector('.launcher-panel');
  const input = el.querySelector('input');
  const grid = el.querySelector('.launcher-grid');

  function matches() {
    const q = input.value.trim().toLowerCase();
    return processes.apps().filter((app) => !q || app.name.toLowerCase().includes(q));
  }

  function render() {
    grid.replaceChildren(
      ...matches().map((app) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'launcher-item';
        btn.dataset.app = app.id;
        btn.innerHTML = `${appTile(app, 'is-lg')}<span class="launcher-label"></span>`;
        btn.querySelector('.launcher-label').textContent = app.name;
        return btn;
      }),
    );
  }

  function close() {
    el.hidden = true;
  }

  function open() {
    input.value = '';
    render();
    el.hidden = false;
    input.focus();
  }

  function toggle() {
    if (el.hidden) open();
    else close();
  }

  function launchFrom(appId) {
    close();
    launchApp(appId);
  }

  el.addEventListener('pointerdown', (event) => {
    if (!panel.contains(event.target)) close();
  });

  grid.addEventListener('click', (event) => {
    const btn = event.target.closest('.launcher-item');
    if (btn) launchFrom(btn.dataset.app);
  });

  input.addEventListener('input', render);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = matches()[0];
      if (first) launchFrom(first.id);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  return { open, close, toggle, isOpen: () => !el.hidden };
}
