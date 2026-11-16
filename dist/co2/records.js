import {fields, outputs, calculate} from './calc.js';

export const visibleOutputs = outputs.filter(([id]) => ['turbineCO2', 'specificEnergy', 'specificCO2'].includes(id));
// On screen: at most 5 significant digits, never rounding away whole units (149,573 stays 149,573).
export const format = n => n.toLocaleString('en-US', Math.abs(n) >= 1e5 ? {maximumFractionDigits: 0} : {maximumSignificantDigits: 5});
// Reports keep their fuller precision.
const reportNumber = n => n.toLocaleString('en-US', {maximumFractionDigits: 6});
// Two calculations share their inputs when every reading, unit and the steam direction match.
export const sameInputs = (a, b) => a.direction === b.direction && fields.every(([id]) => a.values?.[id] === b.values?.[id] && a.units?.[id] === b.units?.[id]);
export const initialUnits = () => Object.fromEntries(fields.map(f => [f[0], Object.keys(f[3])[0]]));
export const initialOutputUnits = () => Object.fromEntries(outputs.map(f => [f[0], Object.keys(f[2])[0]]));

export function validateRecord(record) {
  if (!record || typeof record.id !== 'string' || !Number.isFinite(Date.parse(record.date))) throw Error('Invalid saved calculation.');
  for (const f of fields) if (!Object.hasOwn(f[3], record.units?.[f[0]])) throw Error('Invalid input unit.');
  for (const f of outputs) if (!Object.hasOwn(f[2], record.outUnits?.[f[0]])) throw Error('Invalid result unit.');
  const values = Object.fromEntries(fields.map(([id]) => [id, record.values?.[id]]));
  return {
    id: record.id, date: record.date, direction: record.direction,
    values, units: {...record.units}, outUnits: {...record.outUnits},
    result: calculate(values, record.direction),
  };
}

export function readRecords(raw, limit = 10) {
  try {
    const data = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).flatMap(record => {
      try { return [validateRecord(record)]; } catch { return []; }
    });
  } catch { return []; }
}

export function reportRows(record) {
  const r = validateRecord(record);
  const inputRows = list => list.map(f => [f[1], r.values[f[0]] * f[3][r.units[f[0]]], r.units[f[0]], f[4]]);
  return [
    ['ProcessCalc · CO₂ Emissions'], ['Basis', 'Based on IPCC guidance; the default natural gas factor is 56.1 tCO₂/TJ on an LHV basis. Electricity and steam allowances are project assumptions.'], ['Date', r.date], ['Steam direction', r.direction], [],
    ['Inputs', 'Value', 'Unit', 'Remark'], ...inputRows(fields.slice(0, 8)), [],
    ['Assumptions', 'Value', 'Unit', 'Remark'], ...inputRows(fields.slice(8)), [],
    ['Emissions from Power Generation', 'Value', 'Unit', 'Remark'],
    ...visibleOutputs.slice(0,1).map(f => [f[1], r.result[f[0]] * f[2][r.outUnits[f[0]]], r.outUnits[f[0]], f[3]]), [],
    ['Emissions from Ammonia Plants', 'Value', 'Unit', 'Remark'],
    ...visibleOutputs.slice(1).map(f => [f[1], r.result[f[0]] * f[2][r.outUnits[f[0]]], r.outUnits[f[0]], f[3]]), [],
    ['Method', 'CO₂ only; no deduction for recovered or stored CO₂. Steam export is an allocation credit. Turbine emissions use the electricity factor.'],
    ['Energy conversion', '4.187 kJ/kcal'],
  ];
}

export const reportText = record => reportRows(record).map(row => row.map(v => typeof v === 'number' ? reportNumber(v) : v).join(' | ')).join('\n');
export const reportCSV = record => '\uFEFF' + reportRows(record).map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
