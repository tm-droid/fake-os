// Notification toasts: short messages that stack top-right and fade away on their own.
// Anything announces one by emitting `notify` on the bus with { icon?, title, body? }.
import { glyph } from './icons.js';

const MAX_VISIBLE = 4;
const FADE_MS = 250;

export function createToaster({ el, events, timeout = 3800 }) {
  function dismiss(toast) {
    if (toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), FADE_MS);
  }

  function show({ icon = 'info', title, body = '' }) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `<span class="toast-icon">${glyph(icon)}</span><div class="toast-text"><p class="toast-title"></p><p class="toast-body"></p></div>`;
    toast.querySelector('.toast-title').textContent = title;
    const bodyEl = toast.querySelector('.toast-body');
    bodyEl.textContent = body;
    bodyEl.hidden = !body;

    // Keep the stack short: the oldest live toasts leave first.
    const live = [...el.children].filter((node) => !node.classList.contains('is-leaving'));
    for (const old of live.slice(0, Math.max(0, live.length - MAX_VISIBLE + 1))) dismiss(old);

    el.append(toast);
    toast.addEventListener('click', () => dismiss(toast));
    setTimeout(() => dismiss(toast), timeout);
  }

  events.on('notify', show);
  return { show };
}
