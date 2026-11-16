// Shared feedback for every calculator: a short message (with an optional action such as Undo)
// and a confirmation that a destructive action must pass first (Raven: red confirm, Cancel, Escape = no).
let toastTimer;
let resume = () => {};

function toastElement() {
  let node = document.getElementById('toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'toast';
    node.hidden = true;
    document.body.append(node);
  }
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  if (!node.dataset.paused) {
    // The message waits while the pointer or keyboard focus is on it, so Undo stays reachable.
    node.dataset.paused = 'true';
    const pause = () => clearTimeout(toastTimer);
    node.addEventListener('mouseenter', pause);
    node.addEventListener('focusin', pause);
    node.addEventListener('mouseleave', () => resume());
    node.addEventListener('focusout', () => resume());
  }
  return node;
}

export function toast(text, {action, onAction, duration} = {}) {
  const node = toastElement();
  clearTimeout(toastTimer);
  node.replaceChildren(document.createTextNode(text));
  if (action && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action;
    button.addEventListener('click', () => { node.hidden = true; onAction(); });
    node.append(button);
  }
  node.hidden = false;
  const wait = duration ?? (action ? 6000 : 2500);
  const hide = ms => { clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (!node.contains(document.activeElement) && !node.matches(':hover')) node.hidden = true; else hide(1500); }, ms); };
  resume = () => hide(2500);
  hide(wait);
}

let confirmDialog;

export function confirmAction({title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel'}) {
  if (!confirmDialog) {
    confirmDialog = document.createElement('dialog');
    confirmDialog.className = 'confirm-dialog';
    confirmDialog.setAttribute('aria-labelledby', 'confirm-title');
    confirmDialog.setAttribute('aria-describedby', 'confirm-message');
    confirmDialog.innerHTML = '<h2 id="confirm-title"></h2><p id="confirm-message"></p>'
      + '<div class="confirm-actions"><button type="button" class="secondary" data-answer="no"></button>'
      + '<button type="button" class="danger-contained" data-answer="yes"></button></div>';
    document.body.append(confirmDialog);
  }
  confirmDialog.querySelector('#confirm-title').textContent = title;
  confirmDialog.querySelector('#confirm-message').textContent = message;
  const no = confirmDialog.querySelector('[data-answer="no"]');
  const yes = confirmDialog.querySelector('[data-answer="yes"]');
  no.textContent = cancelLabel;
  yes.textContent = confirmLabel;
  const opener = document.activeElement;
  return new Promise(resolve => {
    const finish = answer => {
      no.onclick = yes.onclick = null;
      confirmDialog.oncancel = null;
      confirmDialog.close();
      opener?.focus?.({preventScroll: true});
      resolve(answer);
    };
    no.onclick = () => finish(false);
    yes.onclick = () => finish(true);
    confirmDialog.oncancel = event => { event.preventDefault(); finish(false); };
    confirmDialog.showModal();
    no.focus();
  });
}
