// Settings: appearance, accent, wallpaper and system info. Every change goes through ctx.prefs.
import { glyph } from '../ui/icons.js';
import { ACCENTS, WALLPAPERS } from '../kernel/prefs.js';

const PANES = {
  appearance: { label: 'Appearance', icon: 'sun', title: 'Appearance' },
  wallpaper: { label: 'Wallpaper', icon: 'monitor', title: 'Wallpaper' },
  about: { label: 'About', icon: 'info', title: 'About This FakeOS' },
};

const MODES = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export default {
  id: 'settings',
  name: 'Settings',
  glyph: 'gear',
  tile: 'linear-gradient(#d1d1d6, #8e8e93)',
  pinned: true,
  width: 720,
  height: 470,
  minWidth: 520,
  minHeight: 340,
  open(ctx) {
    const { window: win, prefs } = ctx;
    const root = el('div', 'settings');
    const sidebar = el('nav', 'settings-sidebar');
    const main = el('div', 'settings-main');
    const title = el('h2', 'settings-title');
    const content = el('div', 'settings-content');
    let pane = null;

    main.append(title, content);
    root.append(sidebar, main);
    win.body.append(root);

    for (const [id, info] of Object.entries(PANES)) {
      const item = el('button', 'settings-nav-item');
      item.type = 'button';
      item.dataset.pane = id;
      item.innerHTML = glyph(info.icon);
      item.append(el('span', '', info.label));
      item.addEventListener('click', () => show(id));
      sidebar.append(item);
    }

    function appearanceView() {
      const wrap = el('div');
      const seg = el('div', 'settings-segmented');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Appearance');
      for (const mode of MODES) {
        const btn = el('button', 'settings-seg');
        btn.type = 'button';
        btn.dataset.appearance = mode.value;
        btn.innerHTML = glyph(mode.icon);
        btn.append(el('span', '', mode.label));
        btn.addEventListener('click', () => prefs.set({ appearance: mode.value }));
        seg.append(btn);
      }

      const heading = el('h3', 'settings-group', 'Accent Color');
      const swatches = el('div', 'settings-swatches');
      for (const [key, accent] of Object.entries(ACCENTS)) {
        const btn = el('button', 'settings-swatch');
        btn.type = 'button';
        btn.title = accent.label;
        btn.setAttribute('aria-label', accent.label);
        btn.dataset.accent = key;
        btn.style.background = accent.value;
        btn.style.color = accent.value; // the selection ring is drawn in the swatch color
        btn.addEventListener('click', () => prefs.set({ accent: key }));
        swatches.append(btn);
      }

      wrap.append(seg, heading, swatches);
      return wrap;
    }

    function wallpaperView() {
      const grid = el('div', 'settings-wallpapers');
      for (const [key, wallpaper] of Object.entries(WALLPAPERS)) {
        const btn = el('button', 'settings-wallpaper');
        btn.type = 'button';
        btn.dataset.wallpaper = key;
        const preview = el('span', 'settings-wallpaper-preview');
        preview.style.background = wallpaper.css;
        btn.append(preview, el('span', '', wallpaper.label));
        btn.addEventListener('click', () => prefs.set({ wallpaper: key }));
        grid.append(btn);
      }
      return grid;
    }

    function aboutView() {
      const wrap = el('div', 'settings-about');
      const apps = el('div', 'settings-row settings-row-apps');
      const names = ctx.processes.apps().map((app) => app.name).join(', ');
      apps.append(el('span', 'settings-row-label', 'Apps'), el('span', '', names));

      const reset = el('button', 'btn destructive', 'Reset System...');
      reset.type = 'button';
      reset.addEventListener('click', resetSystem);
      const resetRow = el('div', 'settings-reset');
      resetRow.append(reset);

      wrap.append(
        el('p', 'settings-row', 'Version 1.0'),
        el('p', 'settings-row', 'Files, notes and drawings are saved in this browser'),
        apps,
        resetRow,
      );
      return wrap;
    }

    async function resetSystem() {
      const ok = await ctx.dialogs.confirm(
        'All files, notes, drawings and settings will be erased from this browser. This cannot be undone.',
        { title: 'Reset System?', ok: 'Reset', cancel: 'Cancel', destructive: true },
      );
      if (!ok) return;
      ctx.fs.reset();
      ctx.prefs.reset();
      location.reload();
    }

    const views = { appearance: appearanceView, wallpaper: wallpaperView, about: aboutView };

    function show(id) {
      pane = id;
      title.textContent = PANES[id].title;
      content.replaceChildren(views[id]());
      refresh();
    }

    // Keeps the pane list, selection rings and appearance control in step with the saved prefs.
    function refresh() {
      const current = prefs.get();
      const mark = (node, on) => {
        node.classList.toggle('is-selected', on);
        node.setAttribute('aria-pressed', String(on));
      };
      for (const node of root.querySelectorAll('[data-pane]')) mark(node, node.dataset.pane === pane);
      for (const node of root.querySelectorAll('[data-appearance]')) {
        mark(node, node.dataset.appearance === current.appearance);
      }
      for (const node of root.querySelectorAll('[data-accent]')) mark(node, node.dataset.accent === current.accent);
      for (const node of root.querySelectorAll('[data-wallpaper]')) {
        mark(node, node.dataset.wallpaper === current.wallpaper);
      }
    }

    win.setMenu([
      {
        title: 'View',
        items: Object.entries(PANES).map(([id, info]) => ({ label: info.label, action: () => show(id) })),
      },
    ]);
    ctx.on('prefs:change', refresh);
    show(Object.hasOwn(PANES, ctx.args?.pane) ? ctx.args.pane : 'appearance');
  },
};
