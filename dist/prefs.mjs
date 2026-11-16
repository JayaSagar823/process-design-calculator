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
}
