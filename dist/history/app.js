// History: every saved calculation from every calculator, newest first, with a filter by tool.
// Each row opens that calculation in its tool's History, ready to load.
import {recentCalculations} from '../recent.mjs';
import {recentRow} from '../recent-view.mjs';
import {HISTORIES} from '../prefs.mjs';

const $ = id => document.getElementById(id);
let items = [], tool = 'all';

function read() {
  try { items = recentCalculations(localStorage, Infinity); } catch { items = []; }
}

function render() {
  const counts = Object.fromEntries(HISTORIES.map(h => [h.tool, items.filter(i => i.tool === h.tool).length]));
  for (const input of document.querySelectorAll('input[name="tool"]')) {
    const n = input.value === 'all' ? items.length : counts[input.value] ?? 0;
    input.closest('label').querySelector('.filter-count').textContent = String(n);
  }
  const shown = tool === 'all' ? items : items.filter(i => i.tool === tool);
  $('history-list').replaceChildren(...shown.map(item => recentRow(item, '../')));
  $('history-list').hidden = shown.length === 0;
  const name = HISTORIES.find(h => h.tool === tool)?.name;
  $('history-empty').hidden = shown.length > 0;
  $('history-empty-text').textContent = tool === 'all'
    ? 'Calculations you save in any calculator appear here.'
    : `No saved ${name} calculations yet.`;
  $('history-summary').textContent = items.length === 1 ? '1 saved calculation on this device.' : `${items.length} saved calculations on this device.`;
}

for (const input of document.querySelectorAll('input[name="tool"]')) {
  input.checked = input.value === tool;
  input.addEventListener('change', () => { tool = input.value; render(); });
}
read();
render();
// Saves and deletions in another tab show here without a reload.
addEventListener('storage', () => { read(); render(); });
