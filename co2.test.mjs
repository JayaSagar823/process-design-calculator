import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, fields, outputs} from './dist/co2/calc.js';
import {readRecords, validateRecord, initialUnits, initialOutputUnits, reportRows, reportText, reportCSV} from './dist/co2/records.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const record = () => ({id: 'example', date: '2026-11-15T12:00:00.000Z', values: defaults(), units: initialUnits(), outUnits: initialOutputUnits(), direction: 'export'});

test('CO₂ example retains the original workbook results and steam allocation', () => {
  const values = defaults(), result = calculate(values, 'export');
  near(result.specificGas, 3000 / 8700);
  near(result.turbineCO2, 18.25);
  near(result.specificEnergy, 6.9173913043478255);
  near(result.specificCO2, 1.6257965209782608);
  near(result.netEnergy, 636.4);
  near(result.netCO2, 149.57327993);
  const imported = calculate(values, 'import');
  near(imported.netCO2, 185.57327993);
  near(imported.netEnergy, 787.4);
  near(imported.netCO2 - result.netCO2, 36);
  near(imported.netEnergy - result.netEnergy, 151);
});

test('CO₂ alternate units and editable factors retain physical values', () => {
  const values = defaults();
  for (const f of fields) for (const factor of Object.values(f[3])) near(values[f[0]] * factor / factor, values[f[0]]);
  const converted = {...values, heat: 12561 / fields[0][3]['kJ/kWh'], lhv: 36.4269 / fields[1][3]['MJ/Nm³'], power: 25000 / fields[2][3].kW, steam: 100000 / fields[6][3]['kg/h']};
  near(calculate(converted, 'export').specificCO2, calculate(values, 'export').specificCO2);
  near(calculate({...values, electricity: 1}, 'export').turbineCO2, 25);
  near(calculate({...values, electricity: 1}, 'export').netCO2 - calculate(values, 'export').netCO2, 3.78);
  near(calculate({...values, steamFactor: 0}, 'export').netCO2 - calculate(values, 'export').netCO2, 18);
  near(calculate({...values, steamEnergy: 0}, 'export').netEnergy - calculate(values, 'export').netEnergy, 75.5);
  near(calculate({...values, gasFactor: 0}, 'export').netCO2, -7.78);
  for (const f of outputs) for (const factor of Object.values(f[2])) {
    const result = calculate(values, 'export')[f[0]];
    near(result * factor / factor, result);
  }
});

test('CO₂ rejects invalid readings, but keeps zero flows and negative allocations meaningful', () => {
  const values = defaults();
  for (const [id] of fields) for (const invalid of [null, undefined, NaN, Infinity, -1]) assert.throws(() => calculate({...values, [id]: invalid}, 'export'));
  for (const id of ['lhv', 'production']) assert.throws(() => calculate({...values, [id]: 0}, 'export'));
  assert.throws(() => calculate(values, 'other'));
  assert.throws(() => calculate({...values, feed: Number.MAX_VALUE}, 'export'));
  assert.equal(calculate({...values, feed: 0, fuel: 0, demand: 0, steam: 0, power: 0}, 'export').netCO2, 0);
  assert.ok(calculate({...values, steam: 10000}, 'export').netCO2 < 0);
  near(calculate({heat: 3000, lhv: 8700, power: 25, electricity: .73}, null, 'turbine').turbineCO2, 18.25);
  const plant = {...values}; delete plant.power;
  near(calculate(plant, 'export', 'ammonia').specificCO2, calculate(values, 'export').specificCO2);
});

test('CO₂ history recalculates stored results and discards invalid records', () => {
  const saved = record(); saved.result = {specificCO2: 999};
  near(validateRecord(saved).result.specificCO2, 1.6257965209782608);
  const broken = {...saved, units: {...saved.units, heat: 'invalid'}};
  assert.equal(readRecords(JSON.stringify([broken, saved])).length, 1);
  for (const raw of ['bad JSON', '{}', 'null']) assert.deepEqual(readRecords(raw), []);
  assert.throws(() => validateRecord({...saved, values: {...saved.values, production: 0}}));
  assert.equal(readRecords(JSON.stringify(Array.from({length: 12}, (_, i) => ({...saved, id: String(i)})))).length, 10);
});

test('CO₂ exports include all readings, assumptions, selected units, and matching outputs', () => {
  const saved = record(); saved.units.power = 'kW'; saved.outUnits.turbineCO2 = 'kgCO₂/h';
  const rows = reportRows(saved);
  assert.deepEqual(rows.find(row => row[0] === 'Turbine power output').slice(0, 3), ['Turbine power output', 25000, 'kW']);
  assert.deepEqual(rows.find(row => row[0] === 'Turbine CO₂ emissions').slice(0, 3), ['Turbine CO₂ emissions', 18250, 'kgCO₂/h']);
  for (const field of fields) assert.ok(rows.some(row => row[0] === field[1]));
  assert.match(reportText(saved), /Specific plant CO₂ \| 1\.625797/);
  assert.match(reportText(saved), /Steam direction \| export/);
  const csv = reportCSV(saved);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Turbine CO₂ emissions","18250","kgCO₂\/h"/);
  assert.match(csv, /\r\n/);
});
