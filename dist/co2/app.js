import {fields, defaults, calculate} from './calc.js';
import {visibleOutputs, format, initialUnits, initialOutputUnits, readRecords, reportText, reportCSV, sameInputs} from './records.js';
import {historyLimit} from '../prefs.mjs';
const keep = historyLimit();
import {formatDate, formatTime, formatDateTime} from '../dates.mjs';
import {toast, confirmAction} from '../feedback.mjs';

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
const mainFields = fields.slice(0, 8);
// Readings grouped as the plant reads them; the steam direction sits right after steam flow.
const groups = {'turbine-inputs': ['power', 'heat'], 'gas-inputs': ['lhv', 'feed', 'fuel'], 'plant-inputs': ['demand', 'steam', 'direction', 'production']};
// On screen the turbine row is short; reports keep each output's full name.
const screenNames = {turbineCO2: 'Turbine CO₂'};
const screenName = ([id, name]) => screenNames[id] ?? name;
const sentence = text => text[0].toLowerCase() + text.slice(1);
let values = Object.fromEntries(fields.map((f, i) => [f[0], i < 8 ? null : f[2]]));
let units = initialUnits(), outUnits = initialOutputUnits(), current = null, records = [], storageOK = true, selected = null;

const directionInputs = () => [...document.getElementsByName('direction')];
const direction = () => directionInputs().find(input => input.checked)?.value ?? 'export';
const setDirection = value => { const input = directionInputs().find(input => input.value === value); if (input) input.checked = true; };

// The message bar sits in the open dialog, if any: a modal leaves the page behind it inert, so Undo would be out of reach.
function notify(text, options) {
  toast(text, options);
  const host = [...document.querySelectorAll('dialog[open]')].pop() ?? document.body;
  const node = $('toast');
  if (node && node.parentElement !== host) host.append(node);
}

function showEmpty(empty) {
  $('result-empty').hidden = !empty;
  ['result-actions', 'turbine-output', 'plant-output'].forEach(id => $(id).hidden = empty);
  if (empty) {
    $('negative').hidden = true;
    $('turbine-results').replaceChildren(); $('plant-results').replaceChildren();
    document.querySelector('.download').open = false;
  }
  savedNote();
}
function invalidate() {
  current = null;
  $('error').hidden = true;
  $('result-status').textContent = '';
  fields.forEach(([id]) => { $(id).removeAttribute('aria-invalid'); $(id).setAttribute('aria-describedby', id + '-hint'); });
  showEmpty(true);
}

function showField(id) {
  const f = fields.find(f => f[0] === id);
  $(id).value = values[id] === null ? '' : Number((values[id] * f[3][units[id]]).toPrecision(12));
  $(id + '-unit').value = units[id];
}
const sync = () => fields.forEach(([id]) => showField(id));

const fieldRows = {};
fields.forEach(([id, name, , options, note]) => {
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
  const hint = el('p', note); hint.className = 'hint'; hint.id = id + '-hint';
  input.setAttribute('aria-describedby', hint.id);
  controls.append(input, select); row.append(label, controls, hint);
  fieldRows[id] = row;
});
for (const [container, ids] of Object.entries(groups)) $(container).append(...ids.map(id => id === 'direction' ? $('direction-field') : fieldRows[id]));
$('assumption-fields').append(...fields.slice(8).map(([id]) => fieldRows[id]));

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(records)); storageOK = true; }
  catch { storageOK = false; }
  renderHistory();
}
function updateSaved() {
  records = records.map(r => r.id === current.id ? structuredClone(current) : r);
  persist();
}
const savedAt = date => formatDate(date) === formatDate(Date.now()) ? formatTime(date) : formatDateTime(date);
function savedNote() {
  const note = $('saved-note');
  const saved = current && records.some(r => r.id === current.id);
  const text = !saved ? '' : storageOK ? `Saved to History at ${savedAt(current.date)}.` : "Kept for this session only. This browser can't save history.";
  if (note.textContent !== text) note.textContent = text;
  note.hidden = !text;
}

async function copyValue(value) {
  try {
    await navigator.clipboard.writeText(String(value));
    $('result-status').textContent = 'Value copied.';
  } catch { $('result-status').textContent = 'Copy unavailable. Use Share to select and copy the summary.'; }
}
function render() {
  if (!current) return;
  const rows = visibleOutputs.map(output => {
    const [id, , options] = output, name = screenName(output);
    const row = el('div'); row.className = 'result-item'; row.dataset.property = id;
    const label = el('label', name); label.htmlFor = 'result-unit-' + id;
    const cell = el('div'); cell.className = 'output-value-cell';
    const value = current.result[id] * options[outUnits[id]];
    cell.append(el('strong', format(value)));
    const select = makeSelect(options, name + ' unit'); select.id = label.htmlFor; select.value = outUnits[id];
    select.addEventListener('change', () => {
      outUnits[id] = select.value; current.outUnits = {...outUnits}; updateSaved(); render();
      $('result-unit-' + id).focus({preventScroll: true});
    });
    row.append(label, cell, select, button('Copy ' + sentence(name), 'copy-value', () => copyValue(value), copyIcon));
    return row;
  });
  $('turbine-results').replaceChildren(rows[0]);
  $('plant-results').replaceChildren(...rows.slice(1));
  showEmpty(false);
  $('negative').hidden = current.result.netCO2 >= 0 && current.result.netEnergy >= 0;
}
function showResult() {
  render();
  window.dispatchEvent(new Event('fieldkit:result'));
}

const deleteLabel = r => 'Delete calculation from ' + formatDateTime(r.date);
const resultText = (r, id) => {
  const options = visibleOutputs.find(f => f[0] === id)[2];
  return `${format(r.result[id] * options[r.outUnits[id]])} ${r.outUnits[id]}`;
};
const historyCards = () => [...$('history-list').querySelectorAll('.history-card')];

function renderHistory() {
  $('delete-all').disabled = !records.length;
  $('history-meta').textContent = storageOK ? `${records.length} saved on this device. The last ${keep} are kept.` : "Saved for this session only. This browser can't keep history.";
  $('history-list').replaceChildren(...records.map(r => {
    const row = el('div'); row.className = 'history-row';
    const view = button('', 'history-card', () => showDetail(r.id));
    const date = el('time', formatDateTime(r.date)); date.dateTime = r.date;
    view.append(el('strong', resultText(r, 'specificCO2')), date, el('span', [`Turbine CO₂ ${resultText(r, 'turbineCO2')}`, `steam ${r.direction}`].join(', ')));
    row.append(view, button(deleteLabel(r), 'action-icon', () => remove(r.id), deleteIcon));
    return row;
  }));
  if (!records.length) $('history-list').append(el('p', 'No saved calculations yet.'));
  if (selected && !records.some(r => r.id === selected)) showList();
  savedNote();
}
function showList() {
  selected = null;
  $('history-detail').hidden = true; $('history-detail').replaceChildren();
  $('history-list').hidden = false;
}
function showDetail(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  selected = id; $('history-status').textContent = '';
  const actions = el('div'); actions.className = 'history-detail-actions';
  const back = button('Back to History', 'secondary', () => {
    const index = records.findIndex(x => x.id === id);
    showList(); historyCards()[index]?.focus({preventScroll: true});
  });
  actions.append(button(deleteLabel(r), 'action-icon', () => remove(r.id), deleteIcon), back, button('Load Calculation', 'primary', () => load(r)));
  const section = (title, rows) => {
    const heading = el('h3', title); heading.className = 'history-section-title';
    return [heading, ...rows.map(([label, value]) => {
      const row = el('div'); row.className = 'detail-row';
      row.append(el('span', label), el('strong', value)); return row;
    })];
  };
  const reading = f => [f[1], `${format(r.values[f[0]] * f[3][r.units[f[0]]])} ${r.units[f[0]]}`];
  const readings = Object.values(groups).flat().map(fid => fid === 'direction'
    ? ['Steam direction', r.direction === 'import' ? 'Import' : 'Export']
    : reading(fields.find(f => f[0] === fid)));
  const date = el('p', formatDateTime(r.date)); date.className = 'hint';
  $('history-detail').replaceChildren(actions, date,
    ...section('Readings', readings),
    ...section('Assumptions', fields.slice(8).map(reading)),
    ...section('Results', visibleOutputs.map(output => [screenName(output), resultText(r, output[0])])));
  $('history-list').hidden = true; $('history-detail').hidden = false;
  back.focus({preventScroll: true});
}
function load(r) {
  invalidate();
  current = structuredClone(r); values = {...r.values}; units = {...r.units}; outUnits = {...r.outUnits};
  setDirection(r.direction); sync(); render();
  $('history-dialog').close();
  notify('Saved calculation loaded');
  window.dispatchEvent(new Event('fieldkit:result'));
}
function remove(id) {
  const index = records.findIndex(r => r.id === id);
  if (index < 0) return;
  const [removed] = records.splice(index, 1);
  if (selected === id) showList();
  persist();
  $('history-status').textContent = '';
  notify('Calculation deleted', {action: 'Undo', onAction: () => {
    records.splice(Math.min(index, records.length), 0, removed);
    records = records.slice(0, keep);
    persist();
    if ($('history-dialog').open) historyCards()[records.indexOf(removed)]?.focus({preventScroll: true});
  }});
  if (!$('history-dialog').open) return;
  const cards = historyCards();
  (cards[Math.min(index, cards.length - 1)] ?? $('history-close')).focus({preventScroll: true});
}

$('form').addEventListener('submit', event => {
  event.preventDefault(); invalidate();
  try {
    const steam = direction();
    const result = calculate(values, steam);
    current = {id: crypto.randomUUID(), date: new Date().toISOString(), values: {...values}, units: {...units}, outUnits: {...outUnits}, direction: steam, result};
    // The same inputs again refresh that saved record (moved to the top) instead of saving a copy of it.
    records = [structuredClone(current), ...records.filter(r => !sameInputs(r, current))].slice(0, keep);
    persist(); showResult();
  } catch (error) {
    $('error').textContent = error.message; $('error').hidden = false;
    const invalid = fields.find(([id]) => !Number.isFinite(values[id]) || values[id] < 0 || (['lhv', 'production'].includes(id) && values[id] === 0));
    if (invalid) {
      if (fields.indexOf(invalid) >= 8) $('assumptions').open = true;
      $(invalid[0]).setAttribute('aria-invalid', 'true');
      $(invalid[0]).setAttribute('aria-describedby', invalid[0] + '-hint error');
      $(invalid[0]).focus();
    }
  }
});
directionInputs().forEach(input => input.addEventListener('change', invalidate));
$('example').addEventListener('click', async () => {
  const typed = mainFields.some(([id]) => values[id] !== null || $(id).validity.badInput);
  const edited = fields.slice(8).some(([id, , value]) => values[id] !== value);
  if ((typed || edited) && !(await confirmAction({title: 'Replace Your Readings?', message: edited ? 'Load Example replaces your readings and resets the assumptions you edited.' : 'Load Example replaces the readings you have entered.', confirmLabel: 'Replace'}))) return;
  values = defaults(); setDirection('export'); sync(); invalidate();
});
$('clear').addEventListener('click', () => {
  mainFields.forEach(([id]) => values[id] = null); setDirection('export'); sync(); invalidate(); $('power').focus();
});
$('reset').addEventListener('click', () => { fields.slice(8).forEach(([id, , value]) => values[id] = value); sync(); invalidate(); });
$('history-open').addEventListener('click', () => {
  showList(); $('history-status').textContent = ''; renderHistory(); $('history-dialog').showModal();
});
$('history-close').addEventListener('click', () => $('history-dialog').close());
$('history-dialog').addEventListener('close', () => {
  const node = $('toast');
  if (node && node.parentElement !== document.body) document.body.append(node);
});
$('delete-all').addEventListener('click', async () => {
  const n = records.length;
  if (!n) return;
  if (!(await confirmAction({title: 'Delete All Saved Calculations?', message: `This removes all ${n} saved CO₂ calculations from this device. This can't be undone.`, confirmLabel: 'Delete All'}))) return;
  records = []; showList(); persist();
  $('history-status').textContent = 'All saved calculations deleted.';
  $('history-close').focus({preventScroll: true});
});
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
  try { await navigator.share({title: 'ProcessCalc CO₂ Emissions', text: $('share-text').value}); }
  catch (error) { $('share-status').textContent = error.name === 'AbortError' ? 'Sharing cancelled.' : 'Use Copy Results.'; }
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
try { records = readRecords(localStorage.getItem(storageKey), keep); }
catch { storageOK = false; }
sync(); invalidate(); renderHistory();

// Home links a saved calculation as ?open=<id>: show it in History, where Load Calculation is.
{const openId=new URLSearchParams(location.search).get('open');if(openId&&records.some(r => r.id === openId)){renderHistory();$('history-dialog').showModal();showDetail(openId);window.history.replaceState(null,'',location.pathname);}}
