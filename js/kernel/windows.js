// Window manager. Owns every window's DOM, geometry, focus order and chrome.
// Geometry is in px relative to the windows layer (the strip between menubar and taskbar).
import { events as defaultEvents } from './events.js';

const TITLEBAR_H = 36;
const SNAP_EDGE = 10; // px from a side edge that snaps to half the screen
const SNAP_TOP = 6; // px from the top edge (or above it) that maximizes
const MIN_VISIBLE = 96; // px of a window kept reachable sideways
const NARROW = 700; // layer width below which windows go full-screen and stop moving

export function createWindowManager({ layer, events = defaultEvents, minWidth = 300, minHeight = 180 }) {
  const windows = new Map();
  let order = []; // window ids, back to front
  let focusedId = null;
  let nextId = 1;
  let cascade = 0;

  const preview = document.createElement('div');
  preview.className = 'snap-preview';
  preview.hidden = true;
  layer.append(preview);

  const size = () => ({ w: layer.clientWidth, h: layer.clientHeight });
  const narrow = () => layer.clientWidth < NARROW;

  function localPoint(event) {
    const box = layer.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function snapRect(state) {
    const { w, h } = size();
    const half = Math.round(w / 2);
    if (state === 'max') return { x: 0, y: 0, w, h };
    if (state === 'left') return { x: 0, y: 0, w: half, h };
    return { x: w - half, y: 0, w: half, h };
  }

  function clampRect(r, minW = minWidth, minH = minHeight) {
    const { w: W, h: H } = size();
    const w = Math.min(Math.max(r.w, minW), W);
    const h = Math.min(Math.max(r.h, minH), H);
    const x = Math.min(Math.max(r.x, MIN_VISIBLE - w), W - MIN_VISIBLE);
    const y = Math.min(Math.max(r.y, 0), Math.max(H - TITLEBAR_H, 0));
    return { x, y, w, h };
  }

  function openRect(width, height) {
    const { w: W, h: H } = size();
    const w = Math.min(Math.max(width, minWidth), Math.max(W - 24, minWidth));
    const h = Math.min(Math.max(height, minHeight), Math.max(H - 24, minHeight));
    const offset = (cascade++ % 6) * 28;
    // Cascade from the top-left, but never let a new window start where its right edge is off screen.
    const x = Math.max(0, Math.min(56 + offset, W - w - 16));
    return clampRect({ x, y: 24 + offset, w, h });
  }

  function describe(win) {
    return {
      id: win.id,
      pid: win.pid,
      appId: win.appId,
      appName: win.appName,
      title: win.title,
      menu: win.menu,
    };
  }

  function place(win) {
    const r = narrow() ? snapRect('max') : win.state === 'normal' ? win.rect : snapRect(win.state);
    Object.assign(win.el.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
    });
  }

  function previewSnap(state) {
    if (!state) {
      preview.hidden = true;
      return;
    }
    const r = snapRect(state);
    Object.assign(preview.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
    });
    preview.hidden = false;
  }

  function snapTarget(event) {
    const p = localPoint(event);
    const { w } = size();
    if (p.y <= SNAP_TOP) return 'max';
    if (p.x <= SNAP_EDGE) return 'left';
    if (p.x >= w - SNAP_EDGE) return 'right';
    return null;
  }

  function snap(win, target) {
    if (win.state === 'normal') win.restore = { ...win.rect };
    win.state = target;
    place(win);
  }

  function toggleZoom(id) {
    const win = windows.get(id);
    if (!win || !win.resizable || narrow()) return;
    if (win.state === 'max') {
      win.state = 'normal';
      win.rect = clampRect(win.restore ?? win.rect, win.minWidth, win.minHeight);
      win.restore = null;
    } else {
      if (win.state === 'normal') win.restore = { ...win.rect };
      win.state = 'max';
    }
    place(win);
  }

  function unminimize(win) {
    win.minimized = false;
    win.el.hidden = false;
    win.el.classList.remove('is-minimizing');
    win.el.classList.add('is-restoring');
    win.el.addEventListener('animationend', () => win.el.classList.remove('is-restoring'), { once: true });
    events.emit('win:restore', describe(win));
  }

  function focus(id) {
    const win = windows.get(id);
    if (!win) return;
    if (win.minimized) unminimize(win);
    order = order.filter((wid) => wid !== id);
    order.push(id);
    order.forEach((wid, index) => {
      windows.get(wid).el.style.zIndex = String(10 + index);
    });
    for (const other of windows.values()) other.el.classList.toggle('is-active', other.id === id);
    if (focusedId !== id) {
      focusedId = id;
      events.emit('win:focus', describe(win));
    }
    // Keyboard focus goes to the last control used in this window, or to the window itself.
    if (!win.minimized && !win.el.hidden) {
      const last = win.lastFocused;
      const target = last?.isConnected && win.el.contains(last) ? last : win.el;
      target.focus({ preventScroll: true });
    }
  }

  // After a window closes or minimizes, focus the frontmost window that is still on screen.
  function refocus() {
    const next = [...order].reverse().find((wid) => !windows.get(wid).minimized);
    if (next !== undefined) {
      focus(next);
    } else if (focusedId !== null) {
      focusedId = null;
      events.emit('win:focus', { id: null, pid: null, appId: null, appName: 'Desktop', title: '', menu: [] });
    }
  }

  function minimize(id) {
    const win = windows.get(id);
    if (!win || win.minimized) return;
    win.minimized = true;
    win.el.classList.add('is-minimizing');
    setTimeout(() => {
      if (win.minimized) win.el.hidden = true;
      win.el.classList.remove('is-minimizing');
    }, 200);
    events.emit('win:minimize', describe(win));
    refocus();
  }

  function close(id) {
    const win = windows.get(id);
    if (!win) return false;
    windows.delete(id);
    order = order.filter((wid) => wid !== id);
    for (const fn of win.closeHandlers.splice(0)) {
      try {
        fn();
      } catch (err) {
        console.error('[windows] close handler failed', err);
      }
    }
    win.el.classList.add('is-closing');
    setTimeout(() => win.el.remove(), 170);
    events.emit('win:close', { id, pid: win.pid, appId: win.appId });
    refocus();
    return true;
  }

  function startDrag(win, event) {
    const handle = event.currentTarget;
    let anchor = { px: event.clientX, py: event.clientY, x: win.rect.x, y: win.rect.y };
    let moved = false;
    let target = null;
    handle.setPointerCapture(event.pointerId);
    focus(win.id);

    const onMove = (e) => {
      if (!moved) {
        if (Math.hypot(e.clientX - anchor.px, e.clientY - anchor.py) < 4) return;
        moved = true;
        win.el.classList.add('is-dragging');
        if (win.state !== 'normal') {
          // A zoomed or snapped window comes back to its own size, centered under the cursor.
          const base = win.restore ?? win.rect;
          const p = localPoint(e);
          win.state = 'normal';
          win.restore = null;
          win.rect = clampRect(
            { x: p.x - base.w / 2, y: p.y - TITLEBAR_H / 2, w: base.w, h: base.h },
            win.minWidth,
            win.minHeight,
          );
          anchor = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y };
        }
      }
      win.rect = clampRect(
        {
          x: anchor.x + (e.clientX - anchor.px),
          y: anchor.y + (e.clientY - anchor.py),
          w: win.rect.w,
          h: win.rect.h,
        },
        win.minWidth,
        win.minHeight,
      );
      place(win);
      target = snapTarget(e);
      previewSnap(target);
    };

    const finish = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      win.el.classList.remove('is-dragging');
      previewSnap(null);
      if (moved && target) snap(win, target);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function startResize(win, event) {
    const grip = event.currentTarget;
    event.preventDefault();
    focus(win.id);
    if (win.state !== 'normal') {
      win.rect = snapRect(win.state);
      win.state = 'normal';
      win.restore = null;
    }
    const start = { px: event.clientX, py: event.clientY, w: win.rect.w, h: win.rect.h };
    win.el.classList.add('is-resizing');
    grip.setPointerCapture(event.pointerId);

    const onMove = (e) => {
      const { w: W, h: H } = size();
      win.rect.w = Math.min(Math.max(start.w + (e.clientX - start.px), win.minWidth), W - win.rect.x);
      win.rect.h = Math.min(Math.max(start.h + (e.clientY - start.py), win.minHeight), H - win.rect.y);
      place(win);
    };

    const finish = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', finish);
      grip.removeEventListener('pointercancel', finish);
      win.el.classList.remove('is-resizing');
    };

    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
  }

  function open(opts = {}) {
    const id = nextId++;
    const title = String(opts.title ?? '');
    const resizable = opts.resizable !== false;

    const el = document.createElement('section');
    el.className = 'window is-opening';
    el.dataset.windowId = String(id);
    el.setAttribute('aria-label', title);
    el.setAttribute('tabindex', '-1');
    el.innerHTML = `
      <header class="window-titlebar">
        <div class="traffic">
          <button type="button" class="traffic-btn traffic-close" aria-label="Close window"></button>
          <button type="button" class="traffic-btn traffic-min" aria-label="Minimize window"></button>
          <button type="button" class="traffic-btn traffic-zoom" aria-label="Zoom window"></button>
        </div>
        <h2 class="window-title"></h2>
        <span aria-hidden="true"></span>
      </header>
      <div class="window-body"></div>
      <div class="window-grip" aria-hidden="true"></div>`;
    el.querySelector('.window-title').textContent = title;
    el.querySelector('.traffic-zoom').disabled = !resizable;

    const win = {
      id,
      pid: opts.pid ?? null,
      appId: opts.appId ?? null,
      appName: opts.appName ?? title,
      title,
      el,
      body: el.querySelector('.window-body'),
      state: 'normal',
      rect: openRect(opts.width ?? 640, opts.height ?? 440),
      restore: null,
      lastFocused: null,
      minimized: false,
      resizable,
      minWidth: opts.minWidth ?? minWidth,
      minHeight: opts.minHeight ?? minHeight,
      menu: [],
      closeHandlers: [],
      setTitle(text) {
        win.title = String(text);
        el.querySelector('.window-title').textContent = win.title;
        el.setAttribute('aria-label', win.title);
        events.emit('win:title', describe(win));
      },
      setMenu(groups) {
        win.menu = Array.isArray(groups) ? groups : [];
        if (focusedId === win.id) events.emit('win:menu', describe(win));
      },
      onClose(fn) {
        win.closeHandlers.push(fn);
        return () => {
          win.closeHandlers = win.closeHandlers.filter((handler) => handler !== fn);
        };
      },
      focus: () => focus(id),
      minimize: () => minimize(id),
      close: () => close(id),
      zoom: () => toggleZoom(id),
    };

    windows.set(id, win);
    layer.insertBefore(el, preview);
    place(win);

    el.addEventListener('animationend', (event) => {
      if (event.target === el) el.classList.remove('is-opening');
    });
    el.addEventListener('pointerdown', () => focus(id), true);
    // Remember the control the user last used in this window, so focus() can return to it.
    // Titlebar buttons are skipped, so a restored focus never lands on Minimize or Close.
    el.addEventListener('focusin', (event) => {
      if (event.target !== el && !event.target.closest('.window-titlebar')) win.lastFocused = event.target;
    });

    const bar = el.querySelector('.window-titlebar');
    bar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.traffic-btn') || narrow()) return;
      startDrag(win, event);
    });
    bar.addEventListener('dblclick', (event) => {
      if (event.target.closest('.traffic-btn')) return;
      toggleZoom(id);
    });

    el.querySelector('.traffic-close').addEventListener('click', () => close(id));
    el.querySelector('.traffic-min').addEventListener('click', () => minimize(id));
    el.querySelector('.traffic-zoom').addEventListener('click', () => toggleZoom(id));

    const grip = el.querySelector('.window-grip');
    grip.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !resizable || narrow()) return;
      event.stopPropagation();
      startResize(win, event);
    });

    events.emit('win:open', describe(win));
    focus(id);
    return win;
  }

  function reflow() {
    for (const win of windows.values()) {
      if (win.state === 'normal') win.rect = clampRect(win.rect, win.minWidth, win.minHeight);
      place(win);
    }
  }

  new ResizeObserver(reflow).observe(layer);

  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'F4' && focusedId !== null) {
      event.preventDefault();
      close(focusedId);
    }
  });

  return {
    open,
    close,
    focus,
    minimize,
    restore: focus,
    toggleZoom,
    get: (id) => windows.get(id) ?? null,
    list: () => [...windows.values()],
    stacking: () => order.map((id) => windows.get(id)).filter(Boolean),
    focused: () => windows.get(focusedId) ?? null,
    reflow,
  };
}
