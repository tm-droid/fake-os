// Popup menus for right-click and the menubar. Only one popup is open at a time.
// An item is {label, action, shortcut?, disabled?, danger?}; the string '-' draws a separator.
export function createPopper(root) {
  let el = null;
  let onClosed = null;
  let ignored = [];

  function close() {
    if (!el) return;
    el.remove();
    el = null;
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', close);
    const done = onClosed;
    onClosed = null;
    done?.();
  }

  function onPointerDown(event) {
    if (el?.contains(event.target)) return;
    if (ignored.some((node) => node.contains(event.target))) return;
    close();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function show(x, y, items, options = {}) {
    close();
    ignored = options.ignore ?? [];
    onClosed = options.onClose ?? null;

    el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    for (const item of items) {
      el.append(item === '-' ? separator() : menuItem(item, close));
    }
    root.append(el);

    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', close);
    return el;
  }

  return { show, close, isOpen: () => el !== null };
}

function separator() {
  const hr = document.createElement('div');
  hr.className = 'menu-sep';
  hr.setAttribute('role', 'separator');
  return hr;
}

function menuItem(item, close) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `menu-item${item.danger ? ' is-danger' : ''}`;
  btn.setAttribute('role', 'menuitem');
  btn.disabled = Boolean(item.disabled);

  const label = document.createElement('span');
  label.textContent = item.label;
  btn.append(label);

  if (item.shortcut) {
    const key = document.createElement('span');
    key.className = 'menu-shortcut';
    key.textContent = item.shortcut;
    btn.append(key);
  }

  btn.addEventListener('click', () => {
    close();
    item.action?.();
  });
  return btn;
}
