// Browser window: tabs, back/forward, an address bar, bookmarks and history. URL logic lives in browser-engine.js.
// Real sites load in a sandboxed iframe; fakeos:// pages are drawn by this module.
import { storage } from '../kernel/storage.js';
import { glyph } from '../ui/icons.js';
import {
  HOME_URL,
  resolveInput,
  isInternal,
  internalPage,
  displayTitle,
  addressText,
  createHistory,
} from './browser-engine.js';

const BOOKMARKS_KEY = 'browser:bookmarks';
const HISTORY_KEY = 'browser:history';
const HISTORY_LIMIT = 200;
const SLOW_LOAD_MS = 6000; // after this a page that never fired "load" probably refuses to be embedded

const SHORTCUTS = [
  { title: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/Main_Page' },
  { title: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/Wiktionary:Main_Page' },
  { title: 'Example', url: 'https://example.com' },
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html?bbox=-0.2,51.47,0.0,51.54&layer=mapnik' },
  { title: 'History', url: 'fakeos://history' },
  { title: 'About', url: 'fakeos://about' },
];

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const faviconUrl = (url) => {
  try {
    return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`;
  } catch {
    return '';
  }
};

const loadBookmarks = () => storage.get(BOOKMARKS_KEY, null) ?? SHORTCUTS.slice(0, 3);
const loadHistory = () => storage.get(HISTORY_KEY, []);

export default {
  id: 'browser',
  name: 'Browser',
  glyph: 'globe',
  tile: 'linear-gradient(#5ac8fa, #0a5bd8)',
  width: 960,
  height: 640,
  minWidth: 420,
  minHeight: 320,
  resizable: true,
  open(ctx) {
    const body = ctx.window.body;
    const tabs = [];
    let active = null;
    let tabSeq = 0;

    body.classList.add('browser-body');
    body.tabIndex = -1;
    body.innerHTML = `
      <div class="browser-app">
        <div class="browser-tabs" role="tablist" aria-label="Tabs">
          <div class="browser-tablist" data-tablist></div>
          <button type="button" class="browser-icon-btn browser-newtab" data-action="newtab" title="New tab (Ctrl+T)" aria-label="New tab">${glyph('plus')}</button>
        </div>
        <div class="browser-toolbar">
          <button type="button" class="browser-icon-btn" data-action="back" title="Back (Alt+Left)" aria-label="Back">${glyph('chevron-left')}</button>
          <button type="button" class="browser-icon-btn" data-action="forward" title="Forward (Alt+Right)" aria-label="Forward">${glyph('chevron-right')}</button>
          <button type="button" class="browser-icon-btn" data-action="reload" title="Reload (Ctrl+R)" aria-label="Reload">${glyph('refresh')}</button>
          <button type="button" class="browser-icon-btn" data-action="home" title="Home" aria-label="Home">${glyph('home')}</button>
          <form class="browser-address" data-address-form>
            <span class="browser-lock" data-lock>${glyph('search')}</span>
            <input type="text" class="browser-url" data-url spellcheck="false" autocomplete="off" placeholder="Search Wikipedia or enter a web address" aria-label="Address">
            <button type="button" class="browser-icon-btn browser-star" data-action="bookmark" title="Bookmark this page (Ctrl+D)" aria-label="Bookmark this page">${glyph('star')}</button>
          </form>
          <button type="button" class="browser-icon-btn" data-action="external" title="Open in a real browser tab" aria-label="Open in a real browser tab">${glyph('external')}</button>
        </div>
        <div class="browser-bookmarks" data-bookmarks></div>
        <div class="browser-progress" data-progress></div>
        <div class="browser-view" data-view></div>
      </div>
    `;

    const $ = (sel) => body.querySelector(sel);
    const tablistEl = $('[data-tablist]');
    const urlInput = $('[data-url]');
    const viewEl = $('[data-view]');
    const bookmarksEl = $('[data-bookmarks]');
    const progressEl = $('[data-progress]');
    const starBtn = $('[data-action="bookmark"]');
    const lockEl = $('[data-lock]');

    let bookmarks = loadBookmarks();

    function saveBookmarks() {
      storage.set(BOOKMARKS_KEY, bookmarks);
      ctx.events.emit('browser:bookmarks');
    }

    function recordVisit(url, title) {
      if (url === HOME_URL) return;
      const list = loadHistory().filter((item) => item.url !== url);
      list.unshift({ url, title, at: Date.now() });
      storage.set(HISTORY_KEY, list.slice(0, HISTORY_LIMIT));
    }

    // ---- tabs ----

    function createTab(url = HOME_URL, { focus = true } = {}) {
      const tab = {
        id: ++tabSeq,
        history: createHistory(HOME_URL),
        title: 'New Tab',
        loading: false,
        blocked: false,
        frame: null,
        page: document.createElement('div'),
        slowTimer: 0,
      };
      tab.page.className = 'browser-page';
      tab.page.hidden = true;
      viewEl.append(tab.page);
      tabs.push(tab);
      if (focus) activate(tab);
      if (url !== HOME_URL) navigate(tab, url);
      else render(tab);
      if (focus && url === HOME_URL) setTimeout(() => urlInput.focus(), 0);
      return tab;
    }

    function closeTab(tab) {
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      clearTimeout(tab.slowTimer);
      tab.page.remove();
      tabs.splice(index, 1);
      if (!tabs.length) {
        ctx.window.close();
        return;
      }
      if (active === tab) activate(tabs[Math.min(index, tabs.length - 1)]);
      else renderTabs();
    }

    function activate(tab) {
      active = tab;
      for (const t of tabs) t.page.hidden = t !== tab;
      renderTabs();
      renderChrome();
    }

    function renderTabs() {
      tablistEl.innerHTML = tabs
        .map((tab) => {
          const url = tab.history.current;
          const icon = tab.loading
            ? '<span class="browser-spinner" aria-hidden="true"></span>'
            : isInternal(url)
              ? glyph(url === HOME_URL ? 'grid' : 'globe', 'browser-tab-icon')
              : `<img class="browser-favicon" src="${escapeHtml(faviconUrl(url))}" alt="" onerror="this.style.visibility='hidden'">`;
          return `
            <div class="browser-tab${tab === active ? ' is-active' : ''}" role="tab" aria-selected="${tab === active}" data-tab="${tab.id}" title="${escapeHtml(tab.title)}">
              ${icon}
              <span class="browser-tab-title">${escapeHtml(tab.title)}</span>
              <button type="button" class="browser-tab-close" data-close="${tab.id}" aria-label="Close tab">${glyph('close')}</button>
            </div>`;
        })
        .join('');
    }

    // Toolbar, address bar, star and window title for the active tab.
    function renderChrome() {
      if (!active) return;
      const url = active.history.current;
      if (document.activeElement !== urlInput) urlInput.value = addressText(url);
      $('[data-action="back"]').disabled = !active.history.canBack;
      $('[data-action="forward"]').disabled = !active.history.canForward;
      $('[data-action="external"]').disabled = isInternal(url);
      const marked = bookmarks.some((b) => b.url === url);
      starBtn.classList.toggle('is-on', marked);
      starBtn.setAttribute('aria-pressed', String(marked));
      lockEl.innerHTML = url.startsWith('https://') ? glyph('lock') : isInternal(url) ? glyph('search') : glyph('info');
      lockEl.title = url.startsWith('https://') ? 'Secure connection' : url.startsWith('http://') ? 'Not secure' : '';
      progressEl.classList.toggle('is-loading', active.loading);
      ctx.window.setTitle(active.title === 'New Tab' ? 'Browser' : `${active.title} — Browser`);
    }

    function renderBookmarksBar() {
      bookmarksEl.innerHTML = bookmarks.length
        ? bookmarks
            .map(
              (b, i) =>
                `<button type="button" class="browser-bookmark" data-bookmark="${i}" title="${escapeHtml(b.url)}">${escapeHtml(b.title)}</button>`,
            )
            .join('')
        : '<span class="browser-bookmarks-empty">Press the star to bookmark a page</span>';
    }

    // ---- navigation ----

    function navigate(tab, url, { push = true } = {}) {
      if (push) tab.history.visit(url);
      render(tab);
    }

    function render(tab) {
      const url = tab.history.current;
      clearTimeout(tab.slowTimer);
      tab.blocked = false;
      tab.title = displayTitle(url);
      if (isInternal(url)) {
        if (tab.frame) {
          tab.frame.remove();
          tab.frame = null;
        }
        tab.loading = false;
        tab.page.classList.add('is-internal');
        tab.page.innerHTML = internalHtml(internalPage(url));
        wireInternal(tab);
      } else {
        tab.page.classList.remove('is-internal');
        tab.page.innerHTML = '';
        loadFrame(tab, url);
      }
      recordVisit(url, tab.title);
      if (tab === active) {
        renderTabs();
        renderChrome();
      } else {
        renderTabs();
      }
    }

    function loadFrame(tab, url) {
      tab.loading = true;
      const frame = document.createElement('iframe');
      frame.className = 'browser-frame';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('allow', 'fullscreen');
      frame.title = displayTitle(url);
      frame.addEventListener('load', () => {
        if (tab.frame !== frame) return;
        clearTimeout(tab.slowTimer);
        tab.loading = false;
        renderTabs();
        if (tab === active) renderChrome();
      });
      tab.page.append(frame, blockedNotice(url));
      tab.frame = frame;
      frame.src = url;
      tab.slowTimer = setTimeout(() => {
        if (tab.frame !== frame || !tab.loading) return;
        tab.loading = false;
        tab.blocked = true;
        tab.page.classList.add('is-slow');
        renderTabs();
        if (tab === active) renderChrome();
      }, SLOW_LOAD_MS);
    }

    // A strip under every real page: many sites refuse to load inside other pages and show a blank frame.
    function blockedNotice(url) {
      const note = document.createElement('div');
      note.className = 'browser-notice';
      note.innerHTML = `
        <span>Blank page? Some sites, like Google and YouTube, refuse to open inside other pages.</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open in a real tab</a>
        <button type="button" class="browser-notice-close" aria-label="Dismiss">${glyph('close')}</button>`;
      note.querySelector('.browser-notice-close').addEventListener('click', () => note.remove());
      return note;
    }

    function go(input) {
      if (!active) return;
      navigate(active, resolveInput(input));
      urlInput.blur();
      active.frame?.focus();
    }

    // ---- internal pages ----

    function tileHtml(item) {
      const icon = isInternal(item.url)
        ? glyph(internalPage(item.url) === 'history' ? 'clock' : 'info')
        : `<img src="${escapeHtml(faviconUrl(item.url))}" alt="" onerror="this.style.visibility='hidden'">`;
      return `<button type="button" class="browser-tile" data-go="${escapeHtml(item.url)}"><span class="browser-tile-icon">${icon}</span><span class="browser-tile-label">${escapeHtml(item.title)}</span></button>`;
    }

    function internalHtml(page) {
      if (page === 'newtab') {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        return `
          <div class="browser-home">
            <div class="browser-home-logo">${glyph('globe')}</div>
            <h1 class="browser-home-greeting">${greeting}</h1>
            <form class="browser-home-search" data-home-search>
              ${glyph('search')}
              <input type="text" name="q" placeholder="Search Wikipedia or type a URL" autocomplete="off" spellcheck="false" aria-label="Search">
            </form>
            <div class="browser-tiles">${SHORTCUTS.map(tileHtml).join('')}</div>
          </div>`;
      }
      if (page === 'history') {
        const list = loadHistory();
        const rows = list.length
          ? list
              .map(
                (item) => `
              <li class="browser-row">
                <span class="browser-row-time">${new Date(item.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <a class="browser-row-link" href="#" data-go="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>
                <span class="browser-row-url">${escapeHtml(item.url)}</span>
              </li>`,
              )
              .join('')
          : '<li class="browser-empty">No history yet. Pages you visit show up here.</li>';
        return `
          <div class="browser-doc">
            <header class="browser-doc-head"><h1>History</h1>${list.length ? '<button type="button" class="browser-button" data-clear-history>Clear history</button>' : ''}</header>
            <ul class="browser-rows">${rows}</ul>
          </div>`;
      }
      if (page === 'bookmarks') {
        const rows = bookmarks.length
          ? bookmarks
              .map(
                (b, i) => `
              <li class="browser-row">
                <a class="browser-row-link" href="#" data-go="${escapeHtml(b.url)}">${escapeHtml(b.title)}</a>
                <span class="browser-row-url">${escapeHtml(b.url)}</span>
                <button type="button" class="browser-icon-btn" data-remove-bookmark="${i}" aria-label="Remove bookmark">${glyph('trash')}</button>
              </li>`,
              )
              .join('')
          : '<li class="browser-empty">No bookmarks yet.</li>';
        return `<div class="browser-doc"><header class="browser-doc-head"><h1>Bookmarks</h1></header><ul class="browser-rows">${rows}</ul></div>`;
      }
      if (page === 'about') {
        return `
          <div class="browser-doc browser-about">
            <div class="browser-home-logo">${glyph('globe')}</div>
            <h1>Browser</h1>
            <p>Version 1.0 for FakeOS</p>
            <p>Type a web address or search words into the address bar. Searches go to Wikipedia.</p>
            <h2>Keyboard shortcuts</h2>
            <dl class="browser-keys">
              <dt>Ctrl+T</dt><dd>New tab</dd>
              <dt>Ctrl+W</dt><dd>Close tab</dd>
              <dt>Ctrl+L</dt><dd>Focus address bar</dd>
              <dt>Ctrl+R</dt><dd>Reload</dd>
              <dt>Ctrl+D</dt><dd>Bookmark page</dd>
              <dt>Ctrl+Tab</dt><dd>Next tab</dd>
              <dt>Alt+Left / Right</dt><dd>Back / Forward</dd>
            </dl>
            <p class="browser-muted">Internal pages: fakeos://newtab, fakeos://history, fakeos://bookmarks, fakeos://about</p>
          </div>`;
      }
      return `
        <div class="browser-doc browser-about">
          <h1>Page not found</h1>
          <p>There is no internal page called “${escapeHtml(page)}”.</p>
          <button type="button" class="browser-button" data-go="${HOME_URL}">Go to New Tab</button>
        </div>`;
    }

    function wireInternal(tab) {
      const form = tab.page.querySelector('[data-home-search]');
      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const q = form.elements.q.value;
        if (q.trim()) navigate(tab, resolveInput(q));
      });
      if (form && tab === active) setTimeout(() => form.elements.q.focus(), 0);
    }

    // ---- events ----

    viewEl.addEventListener('click', (event) => {
      const goEl = event.target.closest('[data-go]');
      if (goEl) {
        event.preventDefault();
        if (event.metaKey || event.ctrlKey || event.button === 1) createTab(goEl.dataset.go, { focus: false });
        else navigate(active, goEl.dataset.go);
        return;
      }
      if (event.target.closest('[data-clear-history]')) {
        storage.set(HISTORY_KEY, []);
        render(active);
        return;
      }
      const remove = event.target.closest('[data-remove-bookmark]');
      if (remove) {
        bookmarks.splice(Number(remove.dataset.removeBookmark), 1);
        saveBookmarks();
      }
    });

    tablistEl.addEventListener('click', (event) => {
      const close = event.target.closest('[data-close]');
      const tabEl = event.target.closest('[data-tab]');
      if (close) closeTab(tabs.find((t) => t.id === Number(close.dataset.close)));
      else if (tabEl) activate(tabs.find((t) => t.id === Number(tabEl.dataset.tab)));
    });
    tablistEl.addEventListener('auxclick', (event) => {
      const tabEl = event.target.closest('[data-tab]');
      if (event.button === 1 && tabEl) closeTab(tabs.find((t) => t.id === Number(tabEl.dataset.tab)));
    });
    tablistEl.addEventListener('dblclick', (event) => {
      if (!event.target.closest('[data-tab]')) createTab();
    });

    bookmarksEl.addEventListener('click', (event) => {
      const b = event.target.closest('[data-bookmark]');
      if (b) navigate(active, bookmarks[Number(b.dataset.bookmark)].url);
    });
    bookmarksEl.addEventListener('contextmenu', (event) => {
      const b = event.target.closest('[data-bookmark]');
      if (!b) return;
      event.preventDefault();
      bookmarks.splice(Number(b.dataset.bookmark), 1);
      saveBookmarks();
    });

    $('[data-address-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      go(urlInput.value);
    });
    urlInput.addEventListener('focus', () => urlInput.select());
    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        urlInput.value = addressText(active.history.current);
        urlInput.blur();
      }
    });

    function toggleBookmark() {
      const url = active.history.current;
      if (url === HOME_URL) return;
      const index = bookmarks.findIndex((b) => b.url === url);
      if (index >= 0) bookmarks.splice(index, 1);
      else bookmarks.push({ title: active.title, url });
      saveBookmarks();
    }

    const actions = {
      newtab: () => createTab(),
      back: () => active.history.canBack && navigate(active, active.history.back(), { push: false }),
      forward: () => active.history.canForward && navigate(active, active.history.forward(), { push: false }),
      reload: () => render(active),
      home: () => navigate(active, HOME_URL),
      bookmark: toggleBookmark,
      external: () => {
        const url = active.history.current;
        if (!isInternal(url)) window.open(url, '_blank', 'noopener,noreferrer');
      },
    };
    body.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (btn && !btn.disabled) actions[btn.dataset.action]();
    });

    body.addEventListener('keydown', (event) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      let handled = true;
      if (mod && key === 't') createTab();
      else if (mod && key === 'w') closeTab(active);
      else if (mod && key === 'l') urlInput.focus();
      else if (mod && key === 'r') actions.reload();
      else if (mod && key === 'd') toggleBookmark();
      else if (mod && key === 'tab') {
        const step = event.shiftKey ? -1 : 1;
        activate(tabs[(tabs.indexOf(active) + step + tabs.length) % tabs.length]);
      } else if (event.altKey && event.key === 'ArrowLeft') actions.back();
      else if (event.altKey && event.key === 'ArrowRight') actions.forward();
      else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // Bookmarks are shared across browser windows.
    ctx.on('browser:bookmarks', () => {
      bookmarks = loadBookmarks();
      renderBookmarksBar();
      renderChrome();
      for (const tab of tabs) {
        if (internalPage(tab.history.current) === 'bookmarks' && isInternal(tab.history.current)) render(tab);
      }
    });
    ctx.window.onClose(() => {
      for (const tab of tabs) clearTimeout(tab.slowTimer);
    });

    renderBookmarksBar();
    createTab(ctx.args.url ? resolveInput(ctx.args.url) : HOME_URL);
  },
};
