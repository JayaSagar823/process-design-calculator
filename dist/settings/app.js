// Settings: every change saves at once and says so; deleting a calculator's history asks first.
import {readSettings, saveSettings, applyTheme, HISTORIES} from '../prefs.mjs';
import {confirmAction, toast} from '../feedback.mjs';
import {APP_VERSION} from '../updates.mjs';

const $ = id => document.getElementById(id);
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
for (const input of document.querySelectorAll('input[name="limit"]')) {
  input.checked = Number(input.value) === settings.historyLimit;
  input.addEventListener('change', () => saved(saveSettings({historyLimit: Number(input.value)}), `Each calculator keeps its last ${input.value} calculations`));
}

const count = key => {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.length : 0; }
  catch { return 0; }
};

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
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Delete All';
    remove.disabled = n === 0;
    remove.setAttribute('aria-label', `Delete all saved ${history.name} calculations`);
    remove.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: 'Delete All Saved Calculations?',
        message: `This removes all ${n} saved ${history.name} calculations from this device. This can't be undone.`,
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

// About
const build = APP_VERSION.startsWith('v') ? 'Development build' : `Build ${APP_VERSION.slice(0, 7)}`;
$('app-version').textContent = `ProcessCalc 17, ${build}`;
