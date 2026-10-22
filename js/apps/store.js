// App Store window: browse, search, install and remove apps. Core apps can be opened but never removed.
import { appTile, glyph } from '../ui/icons.js';
import { CATEGORIES } from '../kernel/catalog.js';

// Build an element with an optional class and text. Text goes in through textContent only.
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const FAILURES = {
  core: 'This app is part of FakeOS and cannot be removed.',
  unknown: 'That app is not available.',
  quota: 'This browser has run out of space for FakeOS files. Delete something to make room, then try again.',
};

function sizeLabel(mb) {
  return `${mb.toFixed(1)} MB`;
}

function buttonFor(action, label, extra = '') {
  const btn = make('button', `btn ${extra}`.trim(), label);
  btn.type = 'button';
  btn.dataset.action = action;
  return btn;
}

export default {
  id: 'store',
  name: 'App Store',
  glyph: 'store',
  tile: 'linear-gradient(#5ac8fa, #0a6fd6)',
  pinned: true,
  width: 760,
  height: 480,
  minWidth: 480,
  minHeight: 320,
  resizable: true,
  open(ctx) {
    const { catalog } = ctx.os;
    const { dialogs } = ctx;
    const body = ctx.window.body;
    body.classList.add('store-body');

    let category = 'All';
    let query = '';

    const root = make('div', 'store');
    const sidebar = make('nav', 'store-sidebar');
    sidebar.setAttribute('aria-label', 'Categories');
    const main = make('section', 'store-main');
    const toolbar = make('header', 'store-toolbar');
    const search = make('input', 'store-search');
    search.type = 'search';
    search.placeholder = 'Search apps';
    search.setAttribute('aria-label', 'Search apps');
    search.autocomplete = 'off';
    search.spellcheck = false;
    const searchWrap = make('label', 'store-search-wrap');
    searchWrap.innerHTML = glyph('search');
    searchWrap.append(search);
    const count = make('span', 'store-count');
    toolbar.append(searchWrap, count);

    const list = make('div', 'store-list');
    list.setAttribute('role', 'list');
    const empty = make('div', 'store-empty', 'No apps match');
    main.append(toolbar, list, empty);
    root.append(sidebar, main);
    body.replaceChildren(root);

    // Sidebar buttons are rebuilt on each render so their counts stay current.
    function renderSidebar(all) {
      const buttons = CATEGORIES.map((name) => {
        const total = name === 'All' ? all.length : all.filter((app) => app.category === name).length;
        const btn = make('button', 'store-category');
        btn.type = 'button';
        btn.dataset.category = name;
        btn.setAttribute('aria-pressed', String(name === category));
        btn.append(make('span', '', name), make('span', 'store-category-count', String(total)));
        return btn;
      });
      sidebar.replaceChildren(...buttons);
    }

    function cardFor(app) {
      const card = make('article', 'store-card');
      card.setAttribute('role', 'listitem');
      card.dataset.app = app.id;

      const tile = make('span', 'store-tile');
      tile.innerHTML = appTile(app);

      const info = make('div', 'store-info');
      const meta = app.core ? `${app.publisher} · Built in` : `${app.publisher} · ${sizeLabel(app.size)}`;
      info.append(make('h3', 'store-name', app.name), make('p', 'store-meta', meta), make('p', 'store-summary', app.summary));

      const actions = make('div', 'store-actions');
      if (!app.installed) {
        actions.append(buttonFor('install', 'Get', 'primary'));
      } else {
        actions.append(buttonFor('open', 'Open'));
        if (!app.core) actions.append(buttonFor('remove', 'Remove', 'destructive'));
      }

      card.append(tile, info, actions);
      return card;
    }

    function render() {
      const all = catalog.listings();
      const q = query.trim().toLowerCase();
      const shown = all.filter((app) => {
        if (category !== 'All' && app.category !== category) return false;
        if (!q) return true;
        return app.name.toLowerCase().includes(q) || app.summary.toLowerCase().includes(q);
      });

      renderSidebar(all);
      list.replaceChildren(...shown.map(cardFor));
      empty.hidden = shown.length > 0;
      const installed = all.filter((app) => app.installed).length;
      count.textContent = `${installed} of ${all.length} installed`;
    }

    // Runs a catalog change and tells the user why it was refused, if it was.
    function report(result, title) {
      if (result.ok) return;
      dialogs.alert(FAILURES[result.reason] ?? 'That change could not be made.', { title });
    }

    async function remove(id) {
      const app = catalog.listing(id);
      if (!app) return;
      const confirmed = await dialogs.confirm(
        `${app.name} will be removed and any open windows will close. Your files are kept.`,
        { title: `Remove ${app.name}?`, ok: 'Remove', cancel: 'Cancel', destructive: true },
      );
      if (confirmed) report(catalog.uninstall(id), 'Cannot remove app');
    }

    list.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.closest('.store-card').dataset.app;
      if (btn.dataset.action === 'install') report(catalog.install(id), 'Cannot install app');
      else if (btn.dataset.action === 'open') ctx.launch(id);
      else if (btn.dataset.action === 'remove') remove(id);
    });

    sidebar.addEventListener('click', (event) => {
      const btn = event.target.closest('.store-category');
      if (!btn) return;
      category = btn.dataset.category;
      render();
    });

    search.addEventListener('input', () => {
      query = search.value;
      render();
    });

    // Installs and removals from anywhere (including the Activity Monitor) refresh the store.
    ctx.on('apps:installed', render);

    render();
    search.focus();
  },
};
