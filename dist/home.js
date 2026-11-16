// Home: the calculators as tiles, then the three newest saved results from every calculator.
// With no saved results yet it reads as a first visit: a welcome, what the app does, and an empty Latest Readings.
import {recentCalculations} from './recent.mjs';
import {recentReading} from './recent-view.mjs';

const SHOWN = 3;
const main = document.getElementById('main');
const list = document.getElementById('recent-list');
const empty = document.getElementById('recent-empty');
const seeAll = document.getElementById('recent-all');
function show() {
  let items = [];
  try { items = recentCalculations(localStorage, SHOWN); } catch {}
  list.replaceChildren(...items.map(item => recentReading(item)));
  list.hidden = items.length === 0;
  empty.hidden = items.length > 0;
  seeAll.hidden = items.length === 0;
  if (items.length) delete main.dataset.firstVisit; else main.dataset.firstVisit = '';
}
show();
// Saves and deletions in another tab show here without a reload.
addEventListener('storage', show);
