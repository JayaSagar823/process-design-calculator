import {fields, defaults, calculate} from './calc.js';
import {visibleOutputs, format, initialUnits, initialOutputUnits, readRecords, reportText, reportCSV} from './records.js';

const $ = id => document.getElementById(id);
const storageKey = 'processcalc-co2-history-v1';
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const copyIcon = svg('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>');
const deleteIcon = svg('<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>');
const button = (label, className, action, icon) => {
  const node = el('button', icon ? undefined : label);
  node.type = 'button';
  node.className = className;
  if (icon) { node.innerHTML = icon; node.setAttribute('aria-label', label); node.title = label; }
  node.addEventListener('click', action);
  return node;
};
const makeSelect = (options, label) => {
  const select = el('select');
  select.setAttribute('aria-label', label);
  for (const unit of Object.keys(options)) {
    const option = el('option', unit); option.value = unit; select.append(option);
  }
  return select;
};
let values = Object.fromEntries(fields.map((f, i) => [f[0], i < 8 ? null : f[2]]));
let units = initialUnits(), outUnits = initialOutputUnits(), current = null, records = [];

function invalidate() {
  current = null;
  $('output-panel').hidden = true;
  $('error').hidden = true;
  $('result-status').textContent = '';
  fields.forEach(([id]) => $(id).removeAttribute('aria-invalid'));
}

function showField(id) {
  const f = fields.find(f => f[0] === id);
  $(id).value = values[id] === null ? '' : Number((values[id] * f[3][units[id]]).toPrecision(12));
  $(id + '-unit').value = units[id];
}
const sync = () => fields.forEach(([id]) => showField(id));

fields.forEach(([id, name, , options, note], i) => {
  const row = el('div'); row.className = 'co2-field';
  const label = el('label', name); label.htmlFor = id; label.className = 'field-label';
  const controls = el('div'); controls.className = 'co2-field-controls';
  const input = el('input');
  Object.assign(input, {id, type: 'number', step: 'any', min: '0', inputMode: 'decimal', autocomplete: 'off', placeholder: 'Enter value'});
  input.addEventListener('input', () => {
    values[id] = input.value === '' || input.validity.badInput ? null : Number(input.value) / options[units[id]];
    invalidate();
  });
  const select = makeSelect(options, name + ' unit'); select.id = id + '-unit';
  select.addEventListener('change', () => {
    units[id] = select.value; showField(id);
    if (current) { current.units = {...units}; updateSaved(); }
  });
  controls.append(input, select); row.append(label, controls);
  if (i >= 8) {
    const hint = el('p', note); hint.className = 'hint'; hint.id = id + '-hint';
    input.setAttribute('aria-describedby', hint.id); row.append(hint);
  }
  $(i < 3 ? 'turbine-inputs' : i < 8 ? 'plant-inputs' : 'assumption-fields').append(row);
});

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(records)); }
  catch { $('storage-note').textContent = 'History cannot be saved in this browser.'; }
  renderHistory();
}
function updateSaved() {
  records = records.map(r => r.id === current.id ? structuredClone(current) : r);
  persist();
}

async function copyValue(value) {
  try {
    await navigator.clipboard.writeText(String(value));
    $('result-status').textContent = 'Value copied.';
  } catch { $('result-status').textContent = 'Copy unavailable. Use Share results to select and copy the summary.'; }
}
function render() {
  if (!current) return;
  $('output-panel').hidden = false;
  const rows = visibleOutputs.map(([id, name, options]) => {
    const row = el('div'); row.className = 'result-item'; row.dataset.property = id;
    const label = el('label', name); label.htmlFor = 'result-unit-' + id;
    const cell = el('div'); cell.className = 'output-value-cell';
    const value = current.result[id] * options[outUnits[id]];
    cell.append(el('strong', format(value)), button('Copy ' + name.toLowerCase(), 'copy-value', () => copyValue(value), copyIcon));
    const select = makeSelect(options, name + ' unit'); select.id = label.htmlFor; select.value = outUnits[id];
    select.addEventListener('change', () => {
      outUnits[id] = select.value; current.outUnits = {...outUnits}; updateSaved(); render();
      $('result-unit-' + id).focus({preventScroll: true});
    });
    row.append(label, cell, select); return row;
  });
  $('turbine-results').replaceChildren(rows[0]);
  $('plant-results').replaceChildren(...rows.slice(1));
  $('negative').hidden = current.result.netCO2 >= 0 && current.result.netEnergy >= 0;
}
function showResult() {
  render();
  window.dispatchEvent(new Event('fieldkit:result'));
}

function renderHistory() {
  $('delete-all').disabled = !records.length;
  $('history-count').textContent = `${records.length} of 10 saved calculations`;
  $('history-list').replaceChildren(...records.map(r => {
    const row = el('div'); row.className = 'history-row';
    const view = button('', 'history-card', () => {
      invalidate(); current = structuredClone(r); values = {...r.values}; units = {...r.units}; outUnits = {...r.outUnits};
      $('direction').value = r.direction; sync(); $('history-dialog').close(); showResult();
    });
    view.append(el('strong', `${format(r.result.specificCO2)} tCO₂/t NH₃`));
    view.append(el('span', `Turbine ${format(r.result.turbineCO2)} tCO₂/h · Steam ${r.direction}`));
    const date = el('time', new Date(r.date).toLocaleString()); date.dateTime = r.date; view.append(date);
    const remove = button('Delete calculation from ' + new Date(r.date).toLocaleString(), 'action-icon', () => {
      records = records.filter(x => x.id !== r.id); persist(); $('history-status').textContent = 'Calculation deleted.';
      $('history-close').focus({preventScroll: true});
    }, deleteIcon);
    row.append(view, remove); return row;
  }));
  if (!records.length) $('history-list').append(el('p', 'No saved calculations yet.'));
}

$('form').addEventListener('submit', event => {
  event.preventDefault(); invalidate();
  try {
    const result = calculate(values, $('direction').value);
    current = {id: crypto.randomUUID(), date: new Date().toISOString(), values: {...values}, units: {...units}, outUnits: {...outUnits}, direction: $('direction').value, result};
    records = [structuredClone(current), ...records].slice(0, 10);
    persist(); showResult();
  } catch (error) {
    $('error').textContent = error.message; $('error').hidden = false;
    const invalid = fields.find(([id]) => !Number.isFinite(values[id]) || values[id] < 0 || (['lhv', 'production'].includes(id) && values[id] === 0));
    if (invalid) {
      if (fields.indexOf(invalid) >= 8) $('assumptions').open = true;
      $(invalid[0]).setAttribute('aria-invalid', 'true'); $(invalid[0]).focus();
    }
  }
});
$('direction').addEventListener('change', invalidate);
$('example').addEventListener('click', () => { values = defaults(); $('direction').value = 'export'; sync(); invalidate(); });
$('clear').addEventListener('click', () => {
  fields.slice(0, 8).forEach(([id]) => values[id] = null); sync(); invalidate(); $('heat').focus();
});
$('reset').addEventListener('click', () => { fields.slice(8).forEach(([id, , value]) => values[id] = value); sync(); invalidate(); });
$('history-open').addEventListener('click', () => { $('history-status').textContent = ''; $('history-dialog').showModal(); });
$('history-close').addEventListener('click', () => $('history-dialog').close());
$('delete-all').addEventListener('click', () => { records = []; persist(); $('history-status').textContent = 'History cleared.'; });
$('share').addEventListener('click', () => {
  if (!current) return;
  $('share-text').value = reportText(current); $('share-status').textContent = '';
  $('native-share').hidden = !navigator.share; $('share-dialog').showModal();
});
$('share-close').addEventListener('click', () => $('share-dialog').close());
$('copy-share').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-text').value); $('share-status').textContent = 'Copied.'; }
  catch { $('share-text').focus(); $('share-text').select(); $('share-status').textContent = 'Select the summary and copy it.'; }
});
$('native-share').addEventListener('click', async () => {
  try { await navigator.share({title: 'ProcessCalc · CO₂ Emissions', text: $('share-text').value}); }
  catch (error) { $('share-status').textContent = error.name === 'AbortError' ? 'Sharing cancelled.' : 'Use Copy results.'; }
});
function download(type) {
  if (!current) return;
  const csv = type === 'csv';
  const url = URL.createObjectURL(new Blob([csv ? reportCSV(current) : reportText(current)], {type: csv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'}));
  const link = el('a'); link.href = url; link.download = 'processcalc-co2-' + current.date.replace(/[:.]/g, '-') + '.' + type;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('.download').open = false;
}
$('download-csv').addEventListener('click', () => download('csv'));
$('download-txt').addEventListener('click', () => download('txt'));
try { records = readRecords(localStorage.getItem(storageKey)); }
catch { $('storage-note').textContent = 'Saved history could not be loaded.'; }
sync(); renderHistory();
