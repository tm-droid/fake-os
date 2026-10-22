// Clock logic with no DOM. Stopwatch and timer read time through an injected now(), so tests can drive a fake clock.

// Milliseconds as a usable number: negatives and NaN become 0.
const clampMs = (ms) => (Number.isFinite(ms) && ms > 0 ? ms : 0);

const pad2 = (n) => String(n).padStart(2, '0');

// Formats milliseconds as hh:mm:ss. Partial seconds are dropped and negative values show as zero.
export function formatHMS(ms) {
  const total = Math.floor(clampMs(ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

// Formats a Date on a 12-hour clock: { time: 'h:mm:ss', period: 'AM' | 'PM' }.
export function formatClock(date) {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12; // midnight and noon both show as 12
  return {
    time: `${hours12}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
    period: hours24 < 12 ? 'AM' : 'PM',
  };
}

// Counts up from zero. Pause keeps the total so far, and reset clears it.
export function createStopwatch({ now = () => Date.now() } = {}) {
  let accumulated = 0; // ms counted in earlier runs
  let startedAt = null; // now() when the current run began, or null while paused

  return {
    start() {
      if (startedAt === null) startedAt = now();
    },
    pause() {
      if (startedAt === null) return;
      accumulated += now() - startedAt;
      startedAt = null;
    },
    reset() {
      accumulated = 0;
      startedAt = null;
    },
    elapsed() {
      return accumulated + (startedAt === null ? 0 : now() - startedAt);
    },
    get running() {
      return startedAt !== null;
    },
  };
}

// Counts down from a duration. Pause keeps the time left, and reset restores the full duration.
// A run stops by itself when time runs out, so remaining() never goes below zero.
export function createTimer({ durationMs = 0, now = () => Date.now() } = {}) {
  let duration = clampMs(durationMs);
  let accumulated = 0; // ms counted in earlier runs
  let startedAt = null; // now() when the current run began, or null while paused

  // Time counted so far, never more than the duration. A run that reaches the end stops there.
  function counted() {
    if (startedAt !== null && accumulated + (now() - startedAt) >= duration) {
      accumulated = duration;
      startedAt = null;
    }
    return accumulated + (startedAt === null ? 0 : now() - startedAt);
  }

  return {
    // Sets a new duration. Progress clears, so the timer is stopped at full time.
    set(ms) {
      duration = clampMs(ms);
      accumulated = 0;
      startedAt = null;
    },
    start() {
      counted();
      if (startedAt !== null) return;
      if (accumulated >= duration) accumulated = 0; // a finished timer starts over
      startedAt = now();
    },
    pause() {
      counted();
      if (startedAt === null) return;
      accumulated += now() - startedAt;
      startedAt = null;
    },
    reset() {
      accumulated = 0;
      startedAt = null;
    },
    remaining() {
      return Math.max(0, duration - counted());
    },
    get running() {
      counted();
      return startedAt !== null;
    },
    get done() {
      return counted() >= duration;
    },
  };
}
