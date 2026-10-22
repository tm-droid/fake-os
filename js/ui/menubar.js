// Menubar: Apple-style system menu, the focused app's name and menus, and the launcher button.
import { glyph, LOGO } from './icons.js';

const TRACKED = ['win:focus', 'win:close', 'win:menu', 'win:minimize', 'win:restore'];

export function createMenubar({ el, os, toggleLauncher }) {
  const { events, wm, popper, dialogs, fs, prefs } = os;

  el.innerHTML = `
    <div class="menubar-left">
      <button type="button" class="menubar-btn menubar-logo" aria-label="System menu">${LOGO}</button>
      <span class="menubar-app"></span>
      <div class="menubar-menus"></div>
    </div>
    <div class="menubar-right">
      <button type="button" class="menubar-btn" aria-label="Open launcher" title="Open launcher">${glyph('search')}</button>
    </div>`;

  const logo = el.querySelector('.menubar-logo');
  const appName = el.querySelector('.menubar-app');
  const menusEl = el.querySelector('.menubar-menus');
  const searchBtn = el.querySelector('.menubar-right .menubar-btn');
  let groups = [];
  let activeBtn = null;

  function resetSystem() {
    dialogs
      .confirm('This erases every file, note and drawing and restores the default desktop.', {
        title: 'Reset FakeOS?',
        ok: 'Reset',
        destructive: true,
      })
      .then((yes) => {
        if (!yes) return;
        fs.reset();
        prefs.reset();
        location.reload();
      });
  }

  const systemItems = [
    { label: 'About This FakeOS', action: () => os.launch('settings', { pane: 'about' }) },
    { label: 'System Settings…', action: () => os.launch('settings', { pane: 'wallpaper' }) },
    '-',
    { label: 'Restart', action: () => location.reload() },
    { label: 'Reset System…', danger: true, action: resetSystem },
  ];

  function render() {
    popper.close();
    const win = wm.focused();
    groups = win ? win.menu : [];
    appName.textContent = win ? win.appName : 'Desktop';
    menusEl.replaceChildren(
      ...groups.map((group, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menubar-btn';
        btn.dataset.index = String(index);
        btn.textContent = group.title;
        return btn;
      }),
    );
    activeBtn = null;
  }

  function itemsFor(btn) {
    if (btn === logo) return systemItems;
    const group = groups[Number(btn.dataset.index)];
    return group ? group.items : [];
  }

  function openMenu(btn) {
    const rect = btn.getBoundingClientRect();
    popper.show(rect.left, rect.bottom + 2, itemsFor(btn), {
      ignore: [el],
      onClose: () => {
        btn.classList.remove('is-open');
        if (activeBtn === btn) activeBtn = null;
      },
    });
    activeBtn = btn;
    btn.classList.add('is-open');
  }

  el.addEventListener('click', (event) => {
    const btn = event.target.closest('.menubar-btn');
    if (!btn) {
      popper.close();
      return;
    }
    if (btn === searchBtn) {
      toggleLauncher();
      return;
    }
    if (popper.isOpen() && btn === activeBtn) {
      popper.close();
      return;
    }
    openMenu(btn);
  });

  // Once one menu is open, moving across the menubar switches menus, like macOS.
  el.addEventListener('pointerover', (event) => {
    const btn = event.target.closest('.menubar-btn');
    if (!btn || btn === searchBtn || !popper.isOpen() || btn === activeBtn) return;
    openMenu(btn);
  });

  for (const name of TRACKED) events.on(name, render);
  render();
}
