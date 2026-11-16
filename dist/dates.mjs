// One way to write a date in every calculator: Raven's "05 Mar 2018", with a 24-hour time.
// Month names are spelled out here because locales disagree on short forms ("Sep" / "Sept").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');

export function formatDate(value) {
  const d = new Date(value);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(value) {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatDateTime = value => `${formatDate(value)}, ${formatTime(value)}`;
