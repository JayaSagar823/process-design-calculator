// Home: the newest saved calculations from every calculator, as a short list; each opens in its tool's History.
import {recentCalculations} from './recent.mjs';
import {recentRow} from './recent-view.mjs';

const SHOWN = 3, MORE = 9;
let items = [];
const read = () => { try { items = recentCalculations(localStorage, MORE); } catch { items = []; } };
read();
const list = document.getElementById('recent-list');
const more = document.getElementById('recent-toggle');
let expanded = false;
function render() {
  list.replaceChildren(...items.slice(0, expanded ? MORE : SHOWN).map(item => recentRow(item)));
  more.hidden = items.length <= SHOWN;
  more.textContent = expanded ? 'Show Less' : 'Show More';
  more.setAttribute('aria-expanded', String(expanded));
}
more.addEventListener('click', () => { expanded = !expanded; render(); });
function show() {
  render();
  list.hidden = items.length === 0;
  document.getElementById('recent-empty').hidden = items.length > 0;
}
show();
// Saves and deletions in another tab show here without a reload.
addEventListener('storage', () => { read(); show(); });
