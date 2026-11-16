// Home: the newest saved calculations from every calculator; each opens in its tool's History.
import {recentCalculations} from './recent.mjs';
import {formatDateTime} from './dates.mjs';

const ICONS = {
  steam: '<path d="M6 15c-4-4 4-5 0-10m6 10c-4-4 4-5 0-10m6 10c-4-4 4-5 0-10M4 20h16"/>',
  ammonia: '<path d="M9 3h6m-5 0v6L4 19a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3M7 15h10"/><path d="M11 18h2"/>',
  co2: '<path d="M7 18a4 4 0 0 1-.7-7.94 6 6 0 0 1 11.6-1.5A4.8 4.8 0 0 1 18 18H7Z"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const text = (tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};

let rows = [];
try { rows = recentCalculations(localStorage); } catch { rows = []; }
const list = document.getElementById('recent-list');
list.replaceChildren(...rows.map(row => {
  const link = document.createElement('a');
  link.className = 'recent-card';
  link.href = row.href;
  const symbol = document.createElement('span');
  symbol.className = 'tool-symbol';
  symbol.innerHTML = svg(ICONS[row.tool] ?? '');
  const body = document.createElement('span');
  body.className = 'recent-text';
  body.append(text('span', row.toolName, 'recent-tool'), text('strong', row.headline, 'recent-headline'),
    text('span', row.detail, 'recent-detail'));
  const when = text('time', formatDateTime(row.date), 'recent-date');
  when.dateTime = row.date;
  body.append(when);
  link.append(symbol, body);
  link.setAttribute('aria-label', `${row.toolName}: ${row.headline}. ${formatDateTime(row.date)}. Open in History`);
  return link;
}));
document.getElementById('recent-empty').hidden = rows.length > 0;
document.querySelector('.recent-more').hidden = rows.length === 0;
