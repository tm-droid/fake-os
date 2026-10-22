// Desktop surface: icons for ~/Desktop, marquee selection, right-click menus and the Trash.
import { glyph, fileTile } from './icons.js';
import { HOME, TRASH, basename, joinPath } from '../kernel/fs.js';

const DESK = `${HOME}/Desktop`;

export function createDesktop({ root, iconsEl, os }) {
  const { events, fs, dialogs, popper, launch, openPath } = os;

  const marquee = document.createElement('div');
  marquee.className = 'marquee';
  marquee.hidden = true;
  root.append(marquee);

  const trash = document.createElement('button');
  trash.type = 'button';
  trash.className = 'desk-trash';
  trash.setAttribute('aria-label', 'Trash');
  trash.innerHTML = `<span class="file-icon kind-trash">${glyph('trash')}</span><span class="desk-label">Trash</span>`;
  root.append(trash);

  // Runs a fs call and reports any failure in a dialog instead of throwing.
  function attempt(fn) {
    try {
      return fn();
    } catch (err) {
      dialogs.alert(err.message, { title: 'Something went wrong' });
      return undefined;
    }
  }

  function iconFor(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'desk-icon';
    btn.dataset.path = item.path;
    btn.title = item.name;
    btn.innerHTML = fileTile(item.type, item.name);
    const label = document.createElement('span');
    label.className = 'desk-label';
    label.textContent = item.name;
    btn.append(label);
    return btn;
  }

  function render() {
    let items = [];
    try {
      items = fs.list(DESK);
    } catch (err) {
      console.error('[desktop] cannot read the Desktop folder', err);
    }
    iconsEl.replaceChildren(...items.map(iconFor));
  }

  function clearSelection() {
    for (const node of root.querySelectorAll('.desk-icon, .desk-trash')) node.classList.remove('is-selected');
  }

  function select(el, additive) {
    if (!additive) clearSelection();
    el.classList.toggle('is-selected', additive ? !el.classList.contains('is-selected') : true);
  }

  function freeName(base) {
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let name = base;
    for (let i = 2; fs.exists(joinPath(DESK, name)); i += 1) name = `${stem} ${i}${ext}`;
    return name;
  }

  async function rename(path) {
    const current = basename(path);
    const next = await dialogs.prompt('Rename to:', { title: 'Rename', input: { value: current }, ok: 'Rename' });
    const clean = typeof next === 'string' ? next.trim() : '';
    if (!clean || clean === current) return;
    attempt(() => fs.rename(path, clean));
  }

  function newFolder() {
    const path = joinPath(DESK, freeName('untitled folder'));
    if (attempt(() => fs.mkdir(path))) rename(path);
  }

  function newTextFile() {
    const path = joinPath(DESK, freeName('untitled.txt'));
    if (attempt(() => fs.write(path, ''))) openPath(path);
  }

  async function emptyTrash() {
    const yes = await dialogs.confirm('Items in the Trash will be deleted for good.', {
      title: 'Empty Trash?',
      ok: 'Empty Trash',
      destructive: true,
    });
    if (yes) attempt(() => fs.emptyTrash());
  }

  function desktopMenu() {
    return [
      { label: 'New Folder', action: newFolder },
      { label: 'New Text File', action: newTextFile },
      '-',
      { label: 'Change Wallpaper…', action: () => launch('settings', { pane: 'wallpaper' }) },
      { label: 'Open Terminal', action: () => launch('terminal') },
    ];
  }

  function iconMenu(path) {
    return [
      { label: 'Open', action: () => openPath(path) },
      { label: 'Rename…', action: () => rename(path) },
      '-',
      { label: 'Move to Trash', danger: true, action: () => attempt(() => fs.trash(path)) },
    ];
  }

  function trashMenu() {
    return [
      { label: 'Open', action: () => openPath(TRASH) },
      '-',
      { label: 'Empty Trash…', danger: true, action: emptyTrash },
    ];
  }

  iconsEl.addEventListener('click', (event) => {
    const icon = event.target.closest('.desk-icon');
    if (icon) select(icon, event.shiftKey || event.metaKey || event.ctrlKey);
  });

  iconsEl.addEventListener('dblclick', (event) => {
    const icon = event.target.closest('.desk-icon');
    if (icon) openPath(icon.dataset.path);
  });

  trash.addEventListener('click', () => select(trash, false));
  trash.addEventListener('dblclick', () => openPath(TRASH));

  // Dragging on empty desktop draws a marquee that selects every icon it touches.
  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.desk-icon, .desk-trash')) return;
    if (!event.shiftKey) clearSelection();
    const origin = { x: event.clientX, y: event.clientY };

    const move = (e) => {
      const x = Math.min(origin.x, e.clientX);
      const y = Math.min(origin.y, e.clientY);
      const w = Math.abs(e.clientX - origin.x);
      const h = Math.abs(e.clientY - origin.y);
      Object.assign(marquee.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      marquee.hidden = w < 3 && h < 3;
      for (const node of root.querySelectorAll('.desk-icon, .desk-trash')) {
        const r = node.getBoundingClientRect();
        const hit = r.left < x + w && r.right > x && r.top < y + h && r.bottom > y;
        node.classList.toggle('is-selected', hit);
      }
    };

    const end = () => {
      marquee.hidden = true;
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', end);
      root.removeEventListener('pointercancel', end);
    };

    root.setPointerCapture(event.pointerId);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  });

  root.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const icon = event.target.closest('.desk-icon');
    if (icon) {
      select(icon, false);
      popper.show(event.clientX, event.clientY, iconMenu(icon.dataset.path));
    } else if (event.target.closest('.desk-trash')) {
      select(trash, false);
      popper.show(event.clientX, event.clientY, trashMenu());
    } else {
      clearSelection();
      popper.show(event.clientX, event.clientY, desktopMenu());
    }
  });

  events.on('fs:change', render);
  render();
  return { render };
}
