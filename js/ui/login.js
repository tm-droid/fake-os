// Boot splash, then a lock screen that waits for the user to log in as Guest.
import { LOGO } from './icons.js';

const BOOT_MS = 1700;

export function runBoot({ bootEl, lockEl }) {
  return new Promise((resolve) => {
    bootEl.innerHTML = `
      <div class="boot-inner">
        <div class="boot-logo">${LOGO}</div>
        <div class="boot-name">FakeOS</div>
        <div class="boot-bar"><span></span></div>
      </div>`;

    setTimeout(showLock, BOOT_MS);

    function showLock() {
      bootEl.classList.add('is-done');
      setTimeout(() => {
        bootEl.hidden = true;
      }, 500);

      lockEl.innerHTML = `
        <div class="lock-time"></div>
        <div class="lock-date"></div>
        <button type="button" class="lock-user" aria-label="Log in as Guest">
          <span class="lock-avatar">G</span>
          <span class="lock-name">Guest</span>
        </button>
        <p class="lock-hint">Click or press Return to log in</p>`;
      lockEl.hidden = false;

      const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      const timeEl = lockEl.querySelector('.lock-time');
      const dateEl = lockEl.querySelector('.lock-date');
      const tick = () => {
        const now = new Date();
        timeEl.textContent = timeFmt.format(now);
        dateEl.textContent = dateFmt.format(now);
      };
      tick();
      const timer = setInterval(tick, 1000);

      let unlocking = false;

      function unlock() {
        if (unlocking) return;
        unlocking = true;
        clearInterval(timer);
        document.removeEventListener('keydown', onKey);
        lockEl.classList.add('is-unlocking');
        setTimeout(() => {
          lockEl.hidden = true;
          lockEl.classList.remove('is-unlocking');
          resolve();
        }, 450);
      }

      function onKey(event) {
        if (event.key === 'Enter') unlock();
      }

      lockEl.querySelector('.lock-user').addEventListener('click', unlock);
      document.addEventListener('keydown', onKey);
    }
  });
}
