// Home's recent list: the newest saved runs from every calculator, newest first.
// Each tool keeps its own history in its own shape; this reads them without changing them.
import {HISTORIES} from './prefs.mjs';
import {units, fromSI} from './units.mjs';
import {propertyLabels, formatValue, phaseName} from './report.mjs';
import {format as co2Format} from './co2/records.js';

// Ammonia's unit tables (dist/ammonia/app.js): [key, label, bar per unit, gauge offset in bar].
const AMMONIA_PRESSURE = [['bara', 'bar(a)', 1, 0], ['barg', 'bar(g)', 1, 1.01325], ['kPa', 'kPa(a)', .01, 0], ['MPa', 'MPa(a)', 10, 0], ['psia', 'psia', .06894757293168, 0], ['psig', 'psig', .06894757293168, 1.01325], ['kgfa', 'Kg/cm2(a)', .980665, 0]];
const AMMONIA_TEMPERATURE = [['C', '°C'], ['F', '°F'], ['K', 'K']];
const ammoniaLabel = key => [...AMMONIA_PRESSURE, ...AMMONIA_TEMPERATURE].find(u => u[0] === key)?.[1] ?? key;
const fixed = n => n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const plain = n => n.toLocaleString('en-US', {maximumFractionDigits: 4});

function read(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

const steamUnit = (entry, key) => units[key]?.find(u => u.label === entry.units?.[key]) ?? units[key]?.[0];

function steamRow(entry) {
  if (!entry?.id || !entry.result?.phase || !entry.inputs) return null;
  const facts = Object.entries(entry.inputs).filter(([k, v]) => k in propertyLabels && Number.isFinite(v))
    .map(([k, v]) => `${propertyLabels[k]} ${formatValue(fromSI(v, steamUnit(entry, k)))} ${steamUnit(entry, k).label}`);
  return {id: entry.id, date: entry.createdAt, headline: phaseName(entry.result), detail: facts.join(', ')};
}

function ammoniaRow(r) {
  if (!r?.id || !['pt', 'tp'].includes(r.mode) || !Number.isFinite(r.t) || !Number.isFinite(r.p)) return null;
  let value;
  if (r.mode === 'pt') value = r.outputUnit === 'F' ? r.t * 9 / 5 + 32 : r.outputUnit === 'K' ? r.t + 273.15 : r.t;
  else { const u = AMMONIA_PRESSURE.find(d => d[0] === r.outputUnit) ?? AMMONIA_PRESSURE[0]; value = (r.p - u[3]) / u[2]; }
  const what = r.mode === 'pt' ? 'Saturation temperature' : 'Saturation pressure';
  const given = r.mode === 'pt' ? 'pressure' : 'temperature';
  return {id: r.id, date: r.date, headline: `${what} ${fixed(value)} ${ammoniaLabel(r.outputUnit)}`, detail: `From a ${given} of ${plain(r.input)} ${ammoniaLabel(r.inputUnit)}`};
}

function co2Row(r) {
  if (!r?.id || !Number.isFinite(r.result?.specificCO2)) return null;
  const turbine = Number.isFinite(r.result.turbineCO2) ? `Turbine CO₂ ${co2Format(r.result.turbineCO2)} tCO₂/h, ` : '';
  return {id: r.id, date: r.date, headline: `${co2Format(r.result.specificCO2)} tCO₂/t NH₃`, detail: `${turbine}steam ${r.direction === 'import' ? 'import' : 'export'}`};
}

const ROWS = {steam: steamRow, ammonia: ammoniaRow, co2: co2Row};

export function recentCalculations(storage = globalThis.localStorage, limit = 6) {
  const all = [];
  for (const history of HISTORIES) {
    for (const record of read(storage, history.key)) {
      const row = ROWS[history.tool](record);
      if (row && Number.isFinite(Date.parse(row.date))) all.push({...row, tool: history.tool, toolName: history.name, href: `${history.href}?open=${encodeURIComponent(row.id)}`});
    }
  }
  return all.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit);
}
