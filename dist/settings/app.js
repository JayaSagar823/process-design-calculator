// Settings: every change saves at once and says so; deleting a calculator's history asks first.
import {readSettings, saveSettings, applyTheme, HISTORIES} from '../prefs.mjs';
import {confirmAction, toast} from '../feedback.mjs';
import {APP_VERSION, APP_RELEASE} from '../updates.mjs';

const $ = id => document.getElementById(id);
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
let settings = readSettings();

function saved(result, message) {
  settings = result.settings;
  toast(result.saved ? message : 'This browser can’t keep settings. They apply until you close the page.');
}

// Appearance
for (const input of document.querySelectorAll('input[name="theme"]')) {
  input.checked = input.value === settings.theme;
  input.addEventListener('change', () => {
    applyTheme(input.value);
    saved(saveSettings({theme: input.value}), input.value === 'system' ? 'Appearance follows your device' : `Appearance set to ${input.value}`);
  });
}

// Default units
$('pressure-unit').value = settings.pressure;
$('temperature-unit').value = settings.temperature;
const unitMessage = value => value === 'default' ? "New calculations start in each calculator's own units" : `New calculations start in ${value}`;
$('pressure-unit').addEventListener('change', event => saved(saveSettings({pressure: event.target.value}), unitMessage(event.target.value)));
$('temperature-unit').addEventListener('change', event => saved(saveSettings({temperature: event.target.value}), unitMessage(event.target.value)));

// Saved history
const count = key => {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.length : 0; }
  catch { return 0; }
};
const showLimit = () => { for (const input of document.querySelectorAll('input[name="limit"]')) input.checked = Number(input.value) === settings.historyLimit; };

// A lower limit removes the oldest saved runs, so it says how many and asks first.
for (const input of document.querySelectorAll('input[name="limit"]')) {
  input.addEventListener('change', async () => {
    const limit = Number(input.value);
    const over = HISTORIES.map(history => ({history, extra: count(history.key) - limit})).filter(item => item.extra > 0);
    if (over.length) {
      const total = over.reduce((sum, item) => sum + item.extra, 0);
      const ok = await confirmAction({
        title: `Keep Only ${limit} per Calculator?`,
        message: `This removes the ${total === 1 ? 'oldest saved calculation' : `${total} oldest saved calculations`} (${over.map(item => `${item.extra} from ${item.history.name}`).join(', ')}). This can't be undone.`,
        confirmLabel: 'Remove Older',
      });
      if (!ok) { showLimit(); return; }
      try {
        // Every history is stored newest first.
        for (const {history} of over) localStorage.setItem(history.key, JSON.stringify(JSON.parse(localStorage.getItem(history.key)).slice(0, limit)));
      } catch { toast('History could not be changed in this browser.'); showLimit(); return; }
    }
    saved(saveSettings({historyLimit: limit}), `Each calculator keeps its last ${limit} calculations`);
    renderHistories();
  });
}
showLimit();

function renderHistories() {
  $('history-tools').replaceChildren(...HISTORIES.map(history => {
    const n = count(history.key);
    const row = document.createElement('div');
    row.className = 'settings-row';
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = history.name;
    const meta = document.createElement('p');
    meta.className = 'hint';
    meta.textContent = n === 1 ? '1 saved calculation' : `${n} saved calculations`;
    text.append(name, meta);
    // A trash button like the History rows': three red pills read as the card's main job, and squeezed the names.
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'action-icon';
    remove.innerHTML = TRASH;
    remove.disabled = n === 0;
    const label = `Delete all saved ${history.name} calculations`;
    remove.setAttribute('aria-label', label);
    remove.title = label;
    remove.addEventListener('click', async () => {
      // Count at click time: another tab may have saved or deleted since this row was drawn.
      const now = count(history.key);
      if (now === 0) { renderHistories(); return; }
      const ok = await confirmAction({
        title: `Delete ${history.name} History?`,
        message: now === 1
          ? `This removes 1 saved calculation from this device. This can't be undone.`
          : `This removes all ${now} saved calculations from this device. This can't be undone.`,
        confirmLabel: 'Delete All',
      });
      if (!ok) return;
      try { localStorage.setItem(history.key, '[]'); toast(`${history.name} history deleted`); }
      catch { toast('History could not be changed in this browser.'); }
      renderHistories();
    });
    row.append(text, remove);
    return row;
  }));
}
renderHistories();
// Another tab saved, deleted or changed a setting: show the current state.
addEventListener('storage', () => {
  settings = readSettings();
  for (const input of document.querySelectorAll('input[name="theme"]')) input.checked = input.value === settings.theme;
  showLimit();
  $('pressure-unit').value = settings.pressure;
  $('temperature-unit').value = settings.temperature;
  renderHistories();
});

// About
// Both come from the build: the release from package.json, the build from the offline cache's hash.
$('app-version').textContent = APP_RELEASE === 'source' ? 'Development build' : `ProcessCalc ${APP_RELEASE}, build ${APP_VERSION.slice(0, 7)}`;
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
  $('install-row-title').textContent = 'Installed';
  $('install-row-hint').textContent = 'You’re using the installed app.';
}
