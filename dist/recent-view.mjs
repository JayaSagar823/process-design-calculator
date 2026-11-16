// One row for a saved calculation, shared by Home's recent list and the History page.
import {formatDateTime} from './dates.mjs';

const ICONS = {
  steam: '<path d="M12 2q2 2.5 0 5t0 5 0 5 0 5"/><path d="M19 2q2 2.5 0 5t0 5 0 5 0 5"/><path d="M5 2q2 2.5 0 5t0 5 0 5 0 5"/>',
  ammonia: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  co2: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const text = (tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};

// base: the path from the current page to the app root ('' on Home, '../' one folder down).
export function recentRow(item, base = '') {
  const link = document.createElement('a');
  link.className = 'recent-card';
  link.href = base + item.href;
  const when = formatDateTime(item.date);
  link.title = `${item.headline}\n${item.detail}\n${item.toolName}, ${when}`;
  link.setAttribute('aria-label', `${item.toolName}: ${item.headline}. ${when}. Open in History`);
  const symbol = document.createElement('span');
  symbol.className = `tool-symbol ${item.tool}`;
  symbol.innerHTML = svg(ICONS[item.tool] ?? '');
  const body = document.createElement('span');
  body.className = 'recent-text';
  body.append(text('strong', item.headline, 'recent-headline'), text('span', `${item.toolName}, ${when}`, 'recent-meta'));
  link.append(symbol, body);
  return link;
}

// Home's Latest Readings row: a bar in the tool's colour, what was worked out and when, the value at the end.
// The label names the quantity, so the colour is never the only cue.
export function recentReading(item, base = '') {
  const reading = item.reading ?? {label: item.headline, value: '', unit: ''};
  const link = document.createElement('a');
  link.className = 'reading';
  link.href = base + item.href;
  const when = formatDateTime(item.date);
  link.setAttribute('aria-label', `${item.toolName}: ${reading.label} ${reading.value} ${reading.unit}. ${when}. Open in its calculator`.replace(/\s+/g, ' '));
  const bar = document.createElement('span');
  bar.className = `reading-bar ${item.tool}`;
  bar.setAttribute('aria-hidden', 'true');
  const body = document.createElement('span');
  body.className = 'reading-text';
  body.append(text('strong', reading.label, 'reading-label'), text('span', when, 'reading-meta'));
  const value = document.createElement('span');
  value.className = 'reading-value';
  value.append(text('strong', reading.value));
  if (reading.unit) value.append(text('span', reading.unit, 'reading-unit'));
  link.append(bar, body, value);
  return link;
}
