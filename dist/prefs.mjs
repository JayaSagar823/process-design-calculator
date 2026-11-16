// ProcessCalc settings, kept in this browser: appearance, the units calculators start in, and how much history to keep.
// Every page applies the appearance before it paints (an inline script in <head> reads the same key);
// calculators read the units and history limit when they start.
export const SETTINGS_KEY = 'processcalc-settings-v1';
export const THEMES = ['system', 'light', 'dark'];
export const PRESSURE_UNITS = ['default', 'bar(a)', 'MPa(a)', 'kPa(a)', 'psia'];
export const TEMPERATURE_UNITS = ['default', '°C', '°F', 'K'];
export const HISTORY_LIMITS = [10, 25, 50];
export const DEFAULTS = {theme: 'system', pressure: 'default', temperature: 'default', historyLimit: 10};

// The three calculators' saved histories, for Home's recent list and Settings.
export const HISTORIES = [
  {tool: 'steam', name: 'Steam Properties', key: 'steam-operator.history.v1', href: 'steam/'},
  {tool: 'ammonia', name: 'Ammonia Saturation Condition', key: 'ammonia-saturation-history-v1', href: 'ammonia/'},
  {tool: 'co2', name: 'CO₂ Emissions', key: 'processcalc-co2-history-v1', href: 'co2/'},
];

function clean(raw) {
  const value = {...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {})};
  if (!THEMES.includes(value.theme)) value.theme = DEFAULTS.theme;
  if (!PRESSURE_UNITS.includes(value.pressure)) value.pressure = DEFAULTS.pressure;
  if (!TEMPERATURE_UNITS.includes(value.temperature)) value.temperature = DEFAULTS.temperature;
  if (!HISTORY_LIMITS.includes(value.historyLimit)) value.historyLimit = DEFAULTS.historyLimit;
  return value;
}

export function readSettings(storage = globalThis.localStorage) {
  try { return clean(JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null')); }
  catch { return {...DEFAULTS}; }
}

export function saveSettings(patch, storage = globalThis.localStorage) {
  const next = clean({...readSettings(storage), ...patch});
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { return {settings: next, saved: false}; }
  return {settings: next, saved: true};
}

export const historyLimit = (storage) => readSettings(storage).historyLimit;

// "system" follows the device; light or dark pins the tokens' explicit [data-theme] block.
export function applyTheme(theme = readSettings().theme, doc = globalThis.document) {
  if (!doc) return;
  if (theme === 'light' || theme === 'dark') doc.documentElement.dataset.theme = theme;
  else delete doc.documentElement.dataset.theme;
  // The browser's own bar: each page lists a light and a dark colour by device scheme. A pinned theme uses its
  // own colour whatever the device says; Device restores both.
  const metas = [...doc.querySelectorAll('meta[name="theme-color"]')];
  for (const meta of metas) if (!('media' in meta.dataset)) { meta.dataset.media = meta.getAttribute('media') ?? ''; meta.dataset.color = meta.content; }
  const pinned = THEMES.includes(theme) && theme !== 'system' && metas.find(meta => meta.dataset.media.includes(theme));
  for (const meta of metas) {
    if (pinned) { meta.removeAttribute('media'); meta.content = pinned.dataset.color; }
    else { if (meta.dataset.media) meta.setAttribute('media', meta.dataset.media); meta.content = meta.dataset.color; }
  }
  paintCaret(doc);
}

// Lucide chevron-down (ISC) for every dropdown. A <select> can't hold an icon and a background image can't read
// CSS variables, so the glyph is drawn here in the theme's own --action-ink and handed to CSS as --caret; CSS keeps
// its drawn caret until this runs. Called on every theme change.
const CARET_PATH = 'm6 9 6 6 6-6';
function toRgba(value) {
  const srgb = value.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
  if (srgb) return `rgba(${[1, 2, 3].map(i => Math.round(srgb[i] * 255)).join(',')},${srgb[4] ?? 1})`;
  return value;
}
export function paintCaret(doc = globalThis.document) {
  const view = doc?.defaultView;
  if (!view?.getComputedStyle || !doc.body) return;
  const probe = doc.createElement('span');
  probe.style.color = 'var(--action-ink)';
  doc.body.append(probe);
  const ink = toRgba(view.getComputedStyle(probe).color);
  probe.remove();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="${CARET_PATH}"/></svg>`;
  doc.documentElement.style.setProperty('--caret', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  doc.documentElement.dataset.caret = '';
}
