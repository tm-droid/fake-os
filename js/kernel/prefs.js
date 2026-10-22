// User preferences: wallpaper, accent color, appearance. Kept apart from the virtual disk.
import { events as defaultEvents } from './events.js';
import { storage as defaultStorage } from './storage.js';

export const PREFS_KEY = 'fakeos.prefs.v1';

// Image wallpapers are inline SVG scenes, encoded so they can sit inside a CSS url().
// Each css value stays a single background layer, so the `center / cover` shorthand still parses.
const svg = (body) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">${body}</svg>`,
)}")`;

export const WALLPAPERS = {
  dusk: { label: 'Dusk', css: 'linear-gradient(160deg, #0f2027 0%, #2c5364 45%, #f2a365 100%)' },
  aurora: { label: 'Aurora', css: 'radial-gradient(circle at 20% 20%, #5ee7df 0%, #b490ca 45%, #1b1f3b 100%)' },
  sand: { label: 'Sand', css: 'linear-gradient(180deg, #fbd3a2 0%, #f7797d 60%, #5e3a6e 100%)' },
  graphite: { label: 'Graphite', css: 'linear-gradient(180deg, #3a3d52 0%, #14151f 100%)' },
  mountains: {
    label: 'Mountains',
    css: svg(`<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b1d4f"/><stop offset=".6" stop-color="#e96f5a"/><stop offset="1" stop-color="#ffc27a"/>
      </linearGradient></defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <circle cx="1180" cy="520" r="90" fill="#fff3d6" opacity=".85"/>
      <path d="M0 620 L180 430 L320 560 L520 360 L740 600 L900 470 L1120 640 L1320 420 L1600 600 V1000 H0Z" fill="#7b4a86"/>
      <path d="M0 720 L220 560 L420 700 L640 540 L860 720 L1060 580 L1280 730 L1480 600 L1600 680 V1000 H0Z" fill="#4a2f6b"/>
      <path d="M0 840 L260 740 L520 830 L800 730 L1080 840 L1360 760 L1600 830 V1000 H0Z" fill="#20163d"/>`),
  },
  synthwave: {
    label: 'Synthwave',
    css: svg(`<defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140035"/><stop offset=".56" stop-color="#5b1a6e"/></linearGradient>
      <linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ff4f9a"/></linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <circle cx="800" cy="540" r="230" fill="url(#u)"/>
      <g fill="#5b1a6e"><rect x="560" y="450" width="480" height="10"/><rect x="560" y="490" width="480" height="14"/><rect x="560" y="528" width="480" height="18"/></g>
      <rect y="560" width="1600" height="440" fill="#2a0a4a"/>
      <g fill="none" stroke="#ff4f9a" stroke-width="3">
      <path d="M800 560 L-600 1000 M800 560 L-200 1000 M800 560 L200 1000 M800 560 L800 1000 M800 560 L1400 1000 M800 560 L1800 1000 M800 560 L2200 1000"/>
      <path d="M0 600 H1600 M0 660 H1600 M0 740 H1600 M0 840 H1600 M0 960 H1600"/>
      </g>`),
  },
  starfield: {
    label: 'Starfield',
    css: svg(`<defs>
      <radialGradient id="s" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1c2a5a"/><stop offset="1" stop-color="#05071a"/></radialGradient>
      <pattern id="p" width="260" height="210" patternUnits="userSpaceOnUse">
      <circle cx="30" cy="40" r="1.6" fill="#fff"/><circle cx="170" cy="25" r="1" fill="#fff" opacity=".7"/>
      <circle cx="110" cy="130" r="2.2" fill="#cfe3ff"/><circle cx="230" cy="150" r="1.2" fill="#fff" opacity=".8"/>
      <circle cx="60" cy="185" r="1" fill="#fff" opacity=".6"/><circle cx="200" cy="90" r="1.5" fill="#ffe9b0"/>
      </pattern></defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <ellipse cx="800" cy="500" rx="1000" ry="180" fill="#8fb3ff" opacity=".08" transform="rotate(-18 800 500)"/>
      <rect width="1600" height="1000" fill="url(#p)"/>`),
  },
  waves: {
    label: 'Waves',
    css: svg(`<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d3b66"/><stop offset="1" stop-color="#00c2c7"/></linearGradient></defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <path d="M0 380 C200 300 400 460 600 380 S1000 300 1200 380 S1500 440 1600 380 V1000 H0Z" fill="#1a6f9c" opacity=".75"/>
      <path d="M0 520 C220 440 420 600 640 520 S1040 440 1240 520 S1520 580 1600 520 V1000 H0Z" fill="#1a8fb0" opacity=".8"/>
      <path d="M0 660 C260 580 460 740 700 660 S1100 580 1300 660 S1540 720 1600 660 V1000 H0Z" fill="#17b3b8" opacity=".85"/>
      <path d="M0 800 C240 730 480 870 720 800 S1120 730 1320 800 S1560 850 1600 800 V1000 H0Z" fill="#0b7d86"/>`),
  },
  topo: {
    label: 'Topo',
    css: svg(`<rect width="1600" height="1000" fill="#2f4a3a"/>
      <g fill="none" stroke="#bfe3c8" stroke-opacity=".28" stroke-width="2">
      <ellipse cx="420" cy="360" rx="80" ry="56"/><ellipse cx="420" cy="360" rx="160" ry="112"/>
      <ellipse cx="420" cy="360" rx="240" ry="168"/><ellipse cx="420" cy="360" rx="320" ry="224"/>
      <ellipse cx="420" cy="360" rx="400" ry="280"/>
      <ellipse cx="1180" cy="640" rx="60" ry="42"/><ellipse cx="1180" cy="640" rx="130" ry="91"/>
      <ellipse cx="1180" cy="640" rx="200" ry="140"/><ellipse cx="1180" cy="640" rx="270" ry="189"/>
      <ellipse cx="1180" cy="640" rx="340" ry="238"/>
      </g>`),
  },
  halftone: {
    label: 'Halftone',
    css: svg(`<defs>
      <radialGradient id="s" cx="30%" cy="30%" r="90%"><stop offset="0" stop-color="#ffd166"/><stop offset=".5" stop-color="#ef476f"/><stop offset="1" stop-color="#5a189a"/></radialGradient>
      <pattern id="p" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="5" fill="#2b0a3d" opacity=".35"/></pattern>
      </defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <rect width="1600" height="1000" fill="url(#p)"/>`),
  },
  sunburst: {
    label: 'Sunburst',
    css: 'repeating-conic-gradient(from 0deg at 50% 50%, #ffb703 0deg 9deg, #fb8500 9deg 18deg)',
  },
  triangles: {
    label: 'Triangles',
    css: svg(`<defs><pattern id="p" width="120" height="104" patternUnits="userSpaceOnUse">
      <polygon points="0,0 60,0 30,52" fill="#2b2d42"/>
      <polygon points="60,0 120,0 90,52" fill="#3d405b"/>
      <polygon points="30,52 90,52 60,104" fill="#8d99ae"/>
      <polygon points="0,52 30,52 0,104" fill="#22233a"/>
      <polygon points="90,52 120,52 120,104 90,104" fill="#50567a"/>
      </pattern></defs>
      <rect width="1600" height="1000" fill="#2b2d42"/>
      <rect width="1600" height="1000" fill="url(#p)"/>`),
  },
  stripes: {
    label: 'Stripes',
    css: 'repeating-linear-gradient(-45deg, #1d1f3d 0 40px, #f4a261 40px 80px)',
  },
  moon: {
    label: 'Moon',
    css: svg(`<rect width="1600" height="1000" fill="#151a40"/>
      <circle cx="1180" cy="260" r="120" fill="#f4eee0"/>
      <circle cx="1230" cy="230" r="112" fill="#151a40"/>
      <g fill="#fff"><circle cx="300" cy="160" r="2"/><circle cx="520" cy="90" r="1.5"/><circle cx="760" cy="200" r="2.5"/><circle cx="960" cy="110" r="1.5"/><circle cx="1420" cy="90" r="2"/></g>
      <path d="M0 640 Q400 520 800 640 T1600 620 V1000 H0Z" fill="#2a2f66"/>
      <path d="M0 760 Q500 660 900 770 T1600 740 V1000 H0Z" fill="#1a1d45"/>
      <path d="M0 880 Q600 800 1000 890 T1600 870 V1000 H0Z" fill="#0d0f29"/>`),
  },
  bokeh: {
    label: 'Bokeh',
    css: svg(`<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b0b33"/><stop offset="1" stop-color="#0b2a3a"/></linearGradient></defs>
      <rect width="1600" height="1000" fill="url(#s)"/>
      <g>
      <circle cx="220" cy="180" r="90" fill="#ff7eb6" opacity=".45"/><circle cx="560" cy="420" r="140" fill="#7ee0ff" opacity=".3"/>
      <circle cx="980" cy="160" r="70" fill="#ffd166" opacity=".5"/><circle cx="1300" cy="520" r="160" fill="#b388ff" opacity=".35"/>
      <circle cx="760" cy="760" r="110" fill="#7ee0ff" opacity=".4"/><circle cx="1450" cy="160" r="60" fill="#ff7eb6" opacity=".5"/>
      <circle cx="120" cy="700" r="130" fill="#ffd166" opacity=".3"/><circle cx="430" cy="880" r="80" fill="#b388ff" opacity=".5"/>
      <circle cx="1100" cy="880" r="120" fill="#ff7eb6" opacity=".3"/>
      </g>`),
  },
  ripples: {
    label: 'Ripples',
    css: 'repeating-radial-gradient(circle at 50% 110%, #0b3d91 0 36px, #2a7de1 36px 72px)',
  },
};

export const ACCENTS = {
  blue: { label: 'Blue', value: '#0a84ff' },
  purple: { label: 'Purple', value: '#bf5af2' },
  pink: { label: 'Pink', value: '#ff375f' },
  orange: { label: 'Orange', value: '#ff9f0a' },
  green: { label: 'Green', value: '#30d158' },
  graphite: { label: 'Graphite', value: '#8e8e93' },
};

export const DEFAULTS = Object.freeze({ wallpaper: 'dusk', accent: 'blue', appearance: 'light' });

function sanitize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    wallpaper: WALLPAPERS[src.wallpaper] ? src.wallpaper : DEFAULTS.wallpaper,
    accent: ACCENTS[src.accent] ? src.accent : DEFAULTS.accent,
    appearance: src.appearance === 'dark' ? 'dark' : 'light',
  };
}

export function createPrefs({ storage = defaultStorage, events = defaultEvents, key = PREFS_KEY } = {}) {
  let current = sanitize(storage.get(key));

  function get() {
    return { ...current };
  }

  function set(patch) {
    current = sanitize({ ...current, ...patch });
    const result = storage.set(key, current);
    if (!result.ok) events.emit('prefs:error', { reason: result.reason });
    events.emit('prefs:change', get());
    return get();
  }

  function reset() {
    storage.remove(key);
    current = sanitize(DEFAULTS);
    events.emit('prefs:change', get());
  }

  return { get, set, reset };
}
