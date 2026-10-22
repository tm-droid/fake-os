// Clock window: a wall clock, a stopwatch with laps, and a countdown timer. The timing lives in clock-engine.js.
import { createStopwatch, createTimer, formatClock, formatHMS } from './clock-engine.js';

const TICK_MS = 250; // one interval drives every redraw
const LAP_LIMIT = 5;
const DEFAULT_MINUTES = 5;
const MAX_MINUTES = 999;

let windowCount = 0; // gives each open window its own element ids

// Whole minutes from 1 to MAX_MINUTES. Empty or invalid input counts as 1.
const clampMinutes = (value) => Math.min(MAX_MINUTES, Math.max(1, Math.round(Number(value)) || 1));

export default {
  id: 'clock',
  name: 'Clock',
  glyph: 'clock',
  tile: 'linear-gradient(#636366, #1c1c1e)',
  width: 340,
  height: 420,
  minWidth: 280,
  minHeight: 340,
  resizable: true,
  open(ctx) {
    const body = ctx.window.body;
    const uid = `clock-${++windowCount}`;
    const stopwatch = createStopwatch();
    const timer = createTimer({ durationMs: DEFAULT_MINUTES * 60000 });
    let laps = []; // newest first, at most LAP_LIMIT
    let lapCount = 0;
    let lapBase = 0; // stopwatch total at the last lap, so each lap shows its own split
    let alerted = false; // "Time's up" is announced once per run

    body.classList.add('clock-body');
    body.innerHTML = `
      <div class="clock-app">
        <div class="clock-tabs" role="tablist" aria-label="Clock views">
          <button type="button" class="clock-tab" role="tab" data-tab="clock" id="${uid}-tab-clock" aria-controls="${uid}-panel-clock" aria-selected="true">Clock</button>
          <button type="button" class="clock-tab" role="tab" data-tab="stopwatch" id="${uid}-tab-stopwatch" aria-controls="${uid}-panel-stopwatch" aria-selected="false">Stopwatch</button>
          <button type="button" class="clock-tab" role="tab" data-tab="timer" id="${uid}-tab-timer" aria-controls="${uid}-panel-timer" aria-selected="false">Timer</button>
        </div>

        <section class="clock-panel" role="tabpanel" data-panel="clock" id="${uid}-panel-clock" aria-labelledby="${uid}-tab-clock">
          <div class="clock-time" data-clock-time></div>
          <div class="clock-period" data-clock-period></div>
          <div class="clock-date" data-clock-date></div>
        </section>

        <section class="clock-panel" role="tabpanel" data-panel="stopwatch" id="${uid}-panel-stopwatch" aria-labelledby="${uid}-tab-stopwatch" hidden>
          <div class="clock-time" data-stopwatch-time>00:00:00</div>
          <div class="clock-actions">
            <button type="button" class="clock-button is-primary" data-stopwatch-toggle>Start</button>
            <button type="button" class="clock-button" data-lap>Lap</button>
            <button type="button" class="clock-button" data-stopwatch-reset>Reset</button>
          </div>
          <ol class="clock-laps" data-laps aria-label="Laps"></ol>
        </section>

        <section class="clock-panel" role="tabpanel" data-panel="timer" id="${uid}-panel-timer" aria-labelledby="${uid}-tab-timer" hidden>
          <label class="clock-field">
            <span>Minutes</span>
            <input class="clock-input" type="number" min="1" max="${MAX_MINUTES}" step="1" value="${DEFAULT_MINUTES}" data-minutes>
          </label>
          <div class="clock-time" data-timer-time></div>
          <div class="clock-status" data-timer-status aria-live="polite"></div>
          <div class="clock-actions">
            <button type="button" class="clock-button is-primary" data-timer-toggle>Start</button>
            <button type="button" class="clock-button" data-timer-reset>Reset</button>
          </div>
        </section>
      </div>`;

    const find = (selector) => body.querySelector(selector);
    const clockTime = find('[data-clock-time]');
    const clockPeriod = find('[data-clock-period]');
    const clockDate = find('[data-clock-date]');
    const stopwatchTime = find('[data-stopwatch-time]');
    const stopwatchToggle = find('[data-stopwatch-toggle]');
    const lapButton = find('[data-lap]');
    const lapList = find('[data-laps]');
    const minutesField = find('[data-minutes]');
    const timerTime = find('[data-timer-time]');
    const timerToggle = find('[data-timer-toggle]');
    const timerStatus = find('[data-timer-status]');

    // Draws the current state. Runs on every tick and after each button press.
    function redraw() {
      const now = new Date();
      const wall = formatClock(now);
      clockTime.textContent = wall.time;
      clockPeriod.textContent = wall.period;
      clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

      stopwatchTime.textContent = formatHMS(stopwatch.elapsed());
      stopwatchToggle.textContent = stopwatch.running ? 'Pause' : 'Start';
      lapButton.disabled = !stopwatch.running;

      // Rounds up, so the countdown shows 00:05:00 at first and 00:00:00 only when it is done.
      timerTime.textContent = formatHMS(Math.ceil(timer.remaining() / 1000) * 1000);
      timerToggle.textContent = timer.running ? 'Pause' : 'Start';
      minutesField.disabled = timer.running;
      timerStatus.textContent = timer.done ? "Time's up" : '';
      if (timer.done && !alerted) {
        alerted = true;
        ctx.dialogs.alert("Time's up", { title: 'Timer' });
      }
    }

    function renderLaps() {
      lapList.replaceChildren(
        ...laps.map((lap) => {
          const item = document.createElement('li');
          item.className = 'clock-lap';
          const name = document.createElement('span');
          name.textContent = `Lap ${lap.number}`;
          const split = document.createElement('span');
          split.textContent = formatHMS(lap.split);
          item.append(name, split);
          return item;
        }),
      );
    }

    // Shows one tab and hides the rest. The selected tab is the one the Tab key reaches.
    function select(name) {
      for (const tab of body.querySelectorAll('.clock-tab')) {
        const selected = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
      for (const panel of body.querySelectorAll('[data-panel]')) {
        panel.hidden = panel.dataset.panel !== name;
      }
      redraw();
    }

    const tabs = [...body.querySelectorAll('.clock-tab')];
    for (const tab of tabs) {
      tab.addEventListener('click', () => select(tab.dataset.tab));
    }

    // Arrow keys wrap between tabs, and Home and End jump to the ends. The tab reached is selected.
    body.querySelector('.clock-tabs').addEventListener('keydown', (event) => {
      const current = tabs.indexOf(event.target);
      if (current === -1) return;
      let next;
      if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
      else if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      select(tabs[next].dataset.tab);
    });

    stopwatchToggle.addEventListener('click', () => {
      if (stopwatch.running) stopwatch.pause();
      else stopwatch.start();
      redraw();
    });

    lapButton.addEventListener('click', () => {
      if (!stopwatch.running) return;
      const total = stopwatch.elapsed();
      lapCount += 1;
      laps = [{ number: lapCount, split: total - lapBase }, ...laps].slice(0, LAP_LIMIT);
      lapBase = total;
      renderLaps();
    });

    find('[data-stopwatch-reset]').addEventListener('click', () => {
      stopwatch.reset();
      laps = [];
      lapCount = 0;
      lapBase = 0;
      renderLaps();
      redraw();
    });

    // The minutes field sets the duration as you type. It is locked while the timer runs.
    minutesField.addEventListener('input', () => {
      timer.set(clampMinutes(minutesField.value) * 60000);
      alerted = false;
      redraw();
    });
    minutesField.addEventListener('change', () => {
      minutesField.value = String(clampMinutes(minutesField.value));
    });

    timerToggle.addEventListener('click', () => {
      if (timer.running) {
        timer.pause();
      } else {
        alerted = false;
        timer.start();
      }
      redraw();
    });

    find('[data-timer-reset]').addEventListener('click', () => {
      timer.reset();
      alerted = false;
      redraw();
    });

    ctx.window.setMenu([
      {
        title: 'View',
        items: [
          { label: 'Clock', action: () => select('clock') },
          { label: 'Stopwatch', action: () => select('stopwatch') },
          { label: 'Timer', action: () => select('timer') },
        ],
      },
    ]);

    select('clock');
    const intervalId = setInterval(redraw, TICK_MS);
    ctx.window.onClose(() => clearInterval(intervalId));
  },
};
