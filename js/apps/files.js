// Files: browses the virtual disk. Folders open in place; files go to the app that suits them.
import { glyph, fileTile } from '../ui/icons.js';
import { HOME, TRASH, normalize, segments, joinPath, dirname, basename } from '../kernel/fs.js';

const FAVORITES = [
  { label: 'Home', path: HOME, icon: 'user' },
  { label: 'Desktop', path: `${HOME}/Desktop`, icon: 'monitor' },
  { label: 'Documents', path: `${HOME}/Documents`, icon: 'doc' },
  { label: 'Downloads', path: `${HOME}/Downloads`, icon: 'folder' },
  { label: 'Pictures', path: `${HOME}/Pictures`, icon: 'image' },
  { label: 'Trash', path: TRASH, icon: 'trash' },
];

const isIn = (path, dir) => path === dir || path.startsWith(`${dir}/`);
const inTrash = (path) => isIn(path, TRASH);
const titleOf = (path) => (path === HOME ? 'Home' : path === TRASH ? 'Trash' : basename(path));
const countLabel = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmtDate = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

function el(tag, cls = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function crumbSep() {
  const sep = el('span', 'files-sep');
  sep.innerHTML = glyph('chevron-right');
  return sep;
}

// Missing or non-folder paths fall back to Home and say why.
function startFolder(fs, dialogs, raw) {
  if (!raw) return HOME;
  const path = normalize(raw);
  if (fs.isDir(path)) return path;
  const reason = fs.exists(path) ? 'ENOTDIR: not a directory' : 'ENOENT: no such file or directory';
  dialogs.alert(`${reason}, '${path}'`, { title: 'Cannot open folder' });
  return HOME;
}

export default {
  id: 'files',
  name: 'Files',
  glyph: 'folder',
  tile: 'linear-gradient(#7fd3ff, #0a84ff)',
  pinned: true,
  width: 760,
  height: 480,
  minWidth: 460,
  minHeight: 300,

  open(ctx) {
    const { fs, dialogs, popper, wm } = ctx;
    const win = ctx.window;

    const root = el('div', 'files-app');
    root.tabIndex = -1;
    root.innerHTML = `
      <div class="files-toolbar">
        <div class="files-group">
          <button type="button" class="files-tool" data-act="back" aria-label="Back" title="Back">${glyph('chevron-left')}</button>
          <button type="button" class="files-tool" data-act="forward" aria-label="Forward" title="Forward">${glyph('chevron-right')}</button>
          <button type="button" class="files-tool" data-act="up" aria-label="Enclosing folder" title="Enclosing folder">${glyph('up')}</button>
        </div>
        <nav class="files-crumbs" aria-label="Path"></nav>
        <div class="files-group">
          <button type="button" class="files-tool" data-view="icons" aria-label="As Icons" title="As Icons">${glyph('grid')}</button>
          <button type="button" class="files-tool" data-view="list" aria-label="As List" title="As List">${glyph('list')}</button>
        </div>
        <button type="button" class="btn files-new" data-act="new">${glyph('plus')}<span>New Folder</span></button>
      </div>
      <div class="files-body">
        <aside class="files-sidebar">
          <h3 class="files-side-title">Favorites</h3>
          <div class="files-side-list"></div>
        </aside>
        <div class="files-content"></div>
      </div>`;

    const q = (sel) => root.querySelector(sel);
    const crumbsEl = q('.files-crumbs');
    const sideEl = q('.files-side-list');
    const contentEl = q('.files-content');
    const backBtn = q('[data-act="back"]');
    const forwardBtn = q('[data-act="forward"]');
    const upBtn = q('[data-act="up"]');
    const viewBtns = root.querySelectorAll('[data-view]');

    const trail = [startFolder(fs, dialogs, ctx.args?.path)]; // visited folders; `index` marks the current one
    let index = 0;
    let view = 'icons';
    let entries = []; // listing of the current folder, folders first
    const selected = new Set(); // selected item names in the current folder
    let menuInTrash = inTrash(trail[0]);
    const picked = () => entries.filter((entry) => selected.has(entry.name));
    const focusRoot = () => root.focus({ preventScroll: true });

    for (const fav of FAVORITES) {
      const btn = el('button', 'files-side-item');
      btn.type = 'button';
      btn.dataset.path = fav.path;
      btn.innerHTML = glyph(fav.icon);
      const label = el('span');
      label.textContent = fav.label;
      btn.append(label);
      btn.addEventListener('click', () => visit(fav.path));
      sideEl.append(btn);
    }

    backBtn.addEventListener('click', () => step(-1));
    forwardBtn.addEventListener('click', () => step(1));
    upBtn.addEventListener('click', up);
    for (const btn of viewBtns) btn.addEventListener('click', () => setView(btn.dataset.view));
    q('[data-act="new"]').addEventListener('click', newFolder);

    // Moves to the nearest existing ancestor when the current folder has been removed.
    function settle() {
      let path = trail[index];
      while (!fs.isDir(path)) path = dirname(path);
      trail[index] = path;
    }

    function visit(path) {
      const next = normalize(path);
      if (next === trail[index]) return;
      trail.splice(index + 1);
      trail.push(next);
      index = trail.length - 1;
      selected.clear();
      render();
    }

    function step(delta) {
      const next = index + delta;
      if (next < 0 || next >= trail.length) return;
      index = next;
      selected.clear();
      render();
    }

    function up() {
      if (trail[index] !== '/') visit(dirname(trail[index]));
    }

    function setView(next) {
      view = next;
      render();
    }

    function render() {
      const active = document.activeElement;
      const keyboardIdle = !active || active === document.body || root.contains(active);
      settle();
      const folder = trail[index];
      entries = fs.list(folder);
      for (const name of [...selected]) {
        if (!entries.some((entry) => entry.name === name)) selected.delete(name);
      }
      if (inTrash(folder) !== menuInTrash) {
        menuInTrash = inTrash(folder);
        win.setMenu(buildMenu(menuInTrash));
      }
      const title = titleOf(folder);
      if (win.title !== title) win.setTitle(title);
      renderCrumbs(folder);
      renderSidebar(folder);
      backBtn.disabled = index === 0;
      forwardBtn.disabled = index === trail.length - 1;
      upBtn.disabled = folder === '/';
      for (const btn of viewBtns) btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
      renderContent();
      if (keyboardIdle && wm.focused()?.id === win.id) focusRoot();
    }

    function renderCrumbs(folder) {
      const crumb = (label, path) => {
        const btn = el('button', 'files-crumb');
        btn.type = 'button';
        btn.textContent = label;
        if (path === folder) btn.setAttribute('aria-current', 'location');
        btn.addEventListener('click', () => visit(path));
        return btn;
      };
      const nodes = [crumb('/', '/')];
      let path = '';
      for (const part of segments(folder)) {
        path += `/${part}`;
        nodes.push(crumbSep(), crumb(part, path));
      }
      crumbsEl.replaceChildren(...nodes);
      crumbsEl.scrollLeft = crumbsEl.scrollWidth;
    }

    function renderSidebar(folder) {
      const match = FAVORITES.filter((fav) => isIn(folder, fav.path)).sort((a, b) => b.path.length - a.path.length)[0];
      for (const btn of sideEl.children) btn.classList.toggle('is-active', btn.dataset.path === match?.path);
    }

    function renderContent() {
      contentEl.replaceChildren();
      if (!entries.length) {
        const empty = el('p', 'files-empty');
        empty.textContent = 'This folder is empty';
        contentEl.append(empty);
      } else {
        contentEl.append(view === 'list' ? listView() : gridView());
      }
    }

    // Items carry data-name so the mouse handlers can find them without re-rendering.
    function gridView() {
      const grid = el('div', 'files-grid');
      for (const entry of entries) {
        const item = el('div', 'files-item');
        item.dataset.name = entry.name;
        item.classList.toggle('is-selected', selected.has(entry.name));
        const tile = el('div', 'files-tile');
        tile.innerHTML = fileTile(entry.type, entry.name);
        const label = el('span', 'files-name');
        label.textContent = entry.name;
        item.append(tile, label);
        grid.append(item);
      }
      return grid;
    }

    function listView() {
      const table = el('table', 'files-table');
      table.innerHTML = `
        <thead><tr>
          <th>Name</th>
          <th class="files-col-modified">Modified</th>
          <th class="files-col-size">Size</th>
          <th class="files-col-kind">Kind</th>
        </tr></thead>`;
      const body = el('tbody');
      for (const entry of entries) {
        const row = el('tr', 'files-row');
        row.dataset.name = entry.name;
        row.classList.toggle('is-selected', selected.has(entry.name));
        const nameCell = el('td');
        const wrap = el('span', 'files-name-wrap');
        const mini = el('span', 'files-mini');
        mini.innerHTML = fileTile(entry.type, entry.name);
        const label = el('span', 'files-name');
        label.textContent = entry.name;
        wrap.append(mini, label);
        nameCell.append(wrap);
        const modified = el('td', 'files-col-modified');
        modified.textContent = fmtDate(entry.modified);
        const size = el('td', 'files-col-size');
        size.textContent = entry.type === 'dir' ? countLabel(entry.items) : fmtSize(entry.size);
        const kind = el('td', 'files-col-kind');
        kind.textContent = entry.type === 'dir' ? 'Folder' : 'Document';
        row.append(nameCell, modified, size, kind);
        body.append(row);
      }
      table.append(body);
      return table;
    }

    function paintSelection() {
      for (const node of contentEl.querySelectorAll('[data-name]')) {
        node.classList.toggle('is-selected', selected.has(node.dataset.name));
      }
    }

    // Selection: click picks one, ctrl or meta toggles, empty space clears.
    contentEl.addEventListener('pointerdown', (event) => {
      const node = event.target.closest('[data-name]');
      if (!node) {
        if (selected.size) {
          selected.clear();
          paintSelection();
        }
        return;
      }
      if (event.button !== 0) return;
      const name = node.dataset.name;
      if (event.ctrlKey || event.metaKey) {
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
      } else {
        selected.clear();
        selected.add(name);
      }
      paintSelection();
    });

    contentEl.addEventListener('dblclick', (event) => {
      const node = event.target.closest('[data-name]');
      const entry = node && entries.find((item) => item.name === node.dataset.name);
      if (entry) openEntry(entry);
    });

    contentEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const node = event.target.closest('[data-name]');
      if (node) {
        if (!selected.has(node.dataset.name)) {
          selected.clear();
          selected.add(node.dataset.name);
          paintSelection();
        }
        popper.show(event.clientX, event.clientY, itemMenu());
      } else {
        popper.show(event.clientX, event.clientY, folderMenu());
      }
    });

    root.addEventListener('keydown', (event) => {
      const cmd = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (cmd && event.shiftKey && key === 'n') newFolder();
      else if (cmd && key === 'w') win.close();
      else if (key === 'backspace' || key === 'delete') trashSelected();
      else if (key === 'enter' && event.target.tagName !== 'BUTTON') openFirst();
      else return;
      event.preventDefault();
    });

    function openEntry(entry) {
      if (entry.type === 'dir') visit(entry.path);
      else ctx.openPath(entry.path);
    }

    function openFirst() {
      const [first] = picked();
      if (first) openEntry(first);
    }

    // Inside the Trash, this deletes for good after a confirm.
    async function trashSelected() {
      const items = picked();
      if (!items.length) return;
      try {
        if (!inTrash(trail[index])) {
          for (const item of items) fs.trash(item.path);
          return;
        }
        const label = items.length === 1 ? `"${items[0].name}"` : `${items.length} items`;
        const ok = await dialogs.confirm(`Delete ${label} permanently? This cannot be undone.`, {
          title: 'Delete Forever',
          ok: 'Delete',
          destructive: true,
        });
        focusRoot();
        if (!ok) return;
        for (const item of items) fs.remove(item.path);
      } catch (err) {
        dialogs.alert(err.message, { title: 'Files' });
      }
    }

    function renamePicked() {
      const items = picked();
      if (items.length === 1) renameItem(items[0]);
    }

    async function renameItem(entry) {
      const next = await dialogs.prompt('Enter a new name.', {
        title: 'Rename',
        ok: 'Rename',
        input: { value: entry.name },
      });
      focusRoot();
      if (next === null) return;
      try {
        const to = fs.rename(entry.path, next);
        selected.clear();
        selected.add(basename(to));
        render();
      } catch (err) {
        dialogs.alert(err.message, { title: 'Rename' });
      }
    }

    function newFolder() {
      const folder = trail[index];
      let name = 'untitled folder';
      for (let n = 2; fs.exists(joinPath(folder, name)); n += 1) name = `untitled folder ${n}`;
      try {
        fs.mkdir(joinPath(folder, name));
      } catch (err) {
        dialogs.alert(err.message, { title: 'New Folder' });
        return;
      }
      selected.clear();
      selected.add(name);
      render();
      renameItem({ name, path: joinPath(folder, name) });
    }

    async function emptyTrash() {
      const ok = await dialogs.confirm('All items in the Trash will be deleted permanently. This cannot be undone.', {
        title: 'Empty Trash',
        ok: 'Empty Trash',
        destructive: true,
      });
      focusRoot();
      if (!ok) return;
      try {
        fs.emptyTrash();
      } catch (err) {
        dialogs.alert(err.message, { title: 'Files' });
      }
    }

    function itemMenu() {
      return [
        { label: 'Open', action: openFirst },
        { label: 'Rename...', disabled: picked().length !== 1, action: renamePicked },
        '-',
        inTrash(trail[index])
          ? { label: 'Delete Forever', danger: true, action: trashSelected }
          : { label: 'Move to Trash', danger: true, action: trashSelected },
      ];
    }

    function folderMenu() {
      const items = [{ label: 'New Folder', action: newFolder }];
      if (inTrash(trail[index])) items.push('-', { label: 'Empty Trash...', danger: true, action: emptyTrash });
      return items;
    }

    function buildMenu(trash) {
      return [
        {
          title: 'File',
          items: [
            { label: 'New Folder', shortcut: 'Shift+Cmd+N', action: newFolder },
            { label: 'Open', action: openFirst },
            { label: 'Rename...', action: renamePicked },
            { label: trash ? 'Delete Forever' : 'Move to Trash', shortcut: 'Cmd+Backspace', action: trashSelected },
            '-',
            { label: 'Close Window', shortcut: 'Cmd+W', action: () => win.close() },
          ],
        },
        {
          title: 'View',
          items: [
            { label: 'As Icons', action: () => setView('icons') },
            { label: 'As List', action: () => setView('list') },
          ],
        },
        {
          title: 'Go',
          items: [
            { label: 'Back', action: () => step(-1) },
            { label: 'Forward', action: () => step(1) },
            { label: 'Enclosing Folder', action: up },
            { label: 'Home', action: () => visit(HOME) },
          ],
        },
      ];
    }

    win.body.append(root);
    win.setMenu(buildMenu(menuInTrash));
    ctx.on('fs:change', () => render());
    ctx.on('win:focus', ({ id }) => {
      if (id === win.id) focusRoot();
    });
    render();
    focusRoot();
  },
};
