// Browser engine: turns address-bar input into URLs and keeps a per-tab back/forward stack. No DOM here.
export const HOME_URL = 'fakeos://newtab';
export const SEARCH_URL = 'https://en.m.wikipedia.org/w/index.php?search=';

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const DOMAIN_RE = /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i;
const LOCAL_RE = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i;

// Address-bar text to a URL: keeps schemes, adds https:// to domains, and searches anything else.
export function resolveInput(text) {
  const input = String(text ?? '').trim();
  if (!input) return HOME_URL;
  if (SCHEME_RE.test(input)) return input;
  if (/^(about|fakeos):/i.test(input)) return `fakeos://${input.replace(/^(about|fakeos):\/*/i, '')}`;
  if (LOCAL_RE.test(input)) return `http://${input}`;
  if (DOMAIN_RE.test(input)) return `https://${input}`;
  return SEARCH_URL + encodeURIComponent(input);
}

export const isInternal = (url) => url.startsWith('fakeos://');

// Internal page name for a fakeos:// URL ("newtab", "history", ...).
export const internalPage = (url) => url.slice('fakeos://'.length).split(/[/?#]/)[0].toLowerCase() || 'newtab';

const PAGE_TITLES = { newtab: 'New Tab', history: 'History', bookmarks: 'Bookmarks', about: 'About Browser' };

// A short label for a tab: the internal page name or the site's hostname.
export function displayTitle(url) {
  if (isInternal(url)) return PAGE_TITLES[internalPage(url)] ?? 'Page Not Found';
  try {
    const parsed = new URL(url);
    if (parsed.href.startsWith(SEARCH_URL)) return `${parsed.searchParams.get('search')} - Search`;
    return parsed.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

// What the address bar shows: internal pages read "fakeos://name", the new tab page shows nothing.
export const addressText = (url) => (url === HOME_URL ? '' : url);

// Back/forward stack for one tab. Visiting a new page drops the forward entries.
export function createHistory(start = HOME_URL) {
  const entries = [start];
  let index = 0;
  return {
    get current() {
      return entries[index];
    },
    get canBack() {
      return index > 0;
    },
    get canForward() {
      return index < entries.length - 1;
    },
    visit(url) {
      if (url === entries[index]) return url;
      entries.splice(index + 1);
      entries.push(url);
      index = entries.length - 1;
      return url;
    },
    back() {
      if (index > 0) index--;
      return entries[index];
    },
    forward() {
      if (index < entries.length - 1) index++;
      return entries[index];
    },
  };
}
