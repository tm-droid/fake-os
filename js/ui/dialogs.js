// OS-style modal dialogs. Each call returns a Promise that settles with the user's answer:
// alert resolves when dismissed, confirm resolves true/false, prompt resolves a string or null.
export function createDialogs(root) {
  function open({ title, message = '', ok = 'OK', cancel = null, destructive = false, input = null }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'dialog-backdrop';
      backdrop.innerHTML = `
        <div class="dialog" role="alertdialog" aria-modal="true">
          <h2 class="dialog-title"></h2>
          <p class="dialog-message"></p>
          <input class="dialog-input" type="text" autocomplete="off" spellcheck="false" hidden>
          <div class="dialog-buttons">
            <button type="button" class="btn" data-action="cancel" hidden></button>
            <button type="button" class="btn primary" data-action="ok"></button>
          </div>
        </div>`;

      const titleEl = backdrop.querySelector('.dialog-title');
      const messageEl = backdrop.querySelector('.dialog-message');
      const field = backdrop.querySelector('.dialog-input');
      const cancelBtn = backdrop.querySelector('[data-action="cancel"]');
      const okBtn = backdrop.querySelector('[data-action="ok"]');

      titleEl.textContent = title;
      messageEl.textContent = message;
      okBtn.textContent = ok;
      okBtn.classList.toggle('destructive', destructive);
      if (cancel) {
        cancelBtn.textContent = cancel;
        cancelBtn.hidden = false;
      }
      if (input) {
        field.hidden = false;
        field.value = input.value ?? '';
        field.placeholder = input.placeholder ?? '';
      }

      const accept = () => finish(input ? field.value : true);
      const reject = () => finish(input ? null : false);
      const dismiss = () => (cancel ? reject() : accept());

      function finish(value) {
        document.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        resolve(value);
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        } else if (event.key === 'Enter' && document.activeElement !== cancelBtn) {
          event.preventDefault();
          accept();
        }
      }

      document.addEventListener('keydown', onKey, true);
      okBtn.addEventListener('click', accept);
      cancelBtn.addEventListener('click', reject);
      root.append(backdrop);

      if (input) {
        field.focus();
        field.select();
      } else {
        okBtn.focus();
      }
    });
  }

  return {
    alert: (message, options = {}) => open({ title: 'FakeOS', ...options, message }).then(() => undefined),
    confirm: (message, options = {}) =>
      open({ title: 'FakeOS', ok: 'OK', cancel: 'Cancel', ...options, message }),
    prompt: (message, options = {}) =>
      open({
        title: 'FakeOS',
        ok: 'OK',
        cancel: 'Cancel',
        ...options,
        message,
        input: options.input ?? { value: '' },
      }),
  };
}
