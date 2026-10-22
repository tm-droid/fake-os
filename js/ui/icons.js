// Inline SVG icons. Every glyph is a 24x24 stroke drawing that inherits currentColor.
const GLYPHS = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  wifi: '<path d="M2.6 9.2a13.5 13.5 0 0 1 18.8 0"/><path d="M5.8 12.6a9 9 0 0 1 12.4 0"/><path d="M9.1 16a4.4 4.4 0 0 1 5.8 0"/><circle cx="12" cy="19.2" r=".9" fill="currentColor"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.6"/><path d="M21.5 10.5v3"/><rect x="5" y="9.5" width="10" height="5" rx="1" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4.1l2 2.3h7.5a2.2 2.2 0 0 1 2.2 2.2v8.3a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M7 9.5l2.8 2.5L7 14.5M12.5 15H17"/>',
  doc: '<path d="M6.5 3.5h7.6L19 8.4v11.1a1.2 1.2 0 0 1-1.2 1.2H6.5a1.2 1.2 0 0 1-1.2-1.2V4.7a1.2 1.2 0 0 1 1.2-1.2z"/><path d="M14 3.7v4.8h4.8M8.5 12.5h7M8.5 16h7"/>',
  note: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  calc: '<rect x="4.5" y="3" width="15" height="18" rx="2.6"/><path d="M8 7.2h8v3H8z"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.6h.01M12 17.6h.01M15.5 17.6h.01" stroke-width="2.8"/>',
  paint: '<path d="M12 3.5c-4.8 0-8.5 3.5-8.5 7.9 0 2.6 2.1 4.6 4.7 4.6h1.7c1 0 1.5 1.1 1 1.9-.5.9.1 2.1 1.5 2.1 4.8 0 8.6-3.8 8.6-8.7 0-4.7-3.6-7.8-8-7.8z"/><circle cx="7.8" cy="10.2" r="1.1"/><circle cx="11.2" cy="7.2" r="1.1"/><circle cx="15.6" cy="8.4" r="1.1"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.2 6.5l1 13h9.6l1-13"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.8" r="1.8"/><path d="M4 17.5l5-5 3.5 3.3 2.4-2.2L20 18.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17.5" r=".9" fill="currentColor"/>',
  monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2.2"/><path d="M9 20.5h6M12 16.5v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c1.2-3.6 4-5.2 7.2-5.2s6 1.6 7.2 5.2"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.5V12l3 2"/>',
  undo: '<path d="M9 14L4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-2"/>',
  eraser: '<path d="M7.5 17.5L3.7 13.7a1.6 1.6 0 0 1 0-2.3l8.5-8.5a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3l-7.5 7.5"/><path d="M9.5 9.5l5 5M7 20.5h13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  snake: '<path d="M4.5 17.5c2.5 0 2.6-5 5.2-5h4.6c2.6 0 2.7-5 5.2-5"/><circle cx="19.5" cy="7.5" r="1.1" fill="currentColor"/>',
  activity: '<path d="M3 12h4l2.6-5.5 4.2 11 2.6-5.5H21"/>',
};

export function glyph(name, extraClass = '') {
  const body = GLYPHS[name] ?? '';
  const cls = extraClass ? `glyph ${extraClass}` : 'glyph';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const LOGO = `<svg class="glyph logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="8.2" height="8.2" rx="2.4" fill="currentColor"/><rect x="12.8" y="3" width="8.2" height="8.2" rx="2.4" fill="currentColor" opacity=".7"/><rect x="3" y="12.8" width="8.2" height="8.2" rx="2.4" fill="currentColor" opacity=".7"/><rect x="12.8" y="12.8" width="8.2" height="8.2" rx="2.4" fill="currentColor" opacity=".45"/></svg>`;

// App tile: a colored rounded square with the app's glyph. `app.tile` is a CSS background value.
export function appTile(app, extraClass = '') {
  const cls = extraClass ? `app-tile ${extraClass}` : 'app-tile';
  return `<span class="${cls}" style="--tile:${app.tile}">${glyph(app.glyph)}</span>`;
}

const IMAGE_RE = /\.(png|jpe?g|gif)$/i;

export function fileTile(type, name) {
  if (type === 'dir') return '<span class="file-icon kind-folder">' + glyph('folder') + '</span>';
  if (IMAGE_RE.test(name)) return '<span class="file-icon kind-image">' + glyph('image') + '</span>';
  return '<span class="file-icon kind-doc">' + glyph('doc') + '</span>';
}
