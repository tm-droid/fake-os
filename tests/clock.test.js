// Clock engine tests. A fake clock stands in for Date.now(), so no real time passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStopwatch, createTimer, formatClock, formatHMS } from '../js/apps/clock-engine.js';

// A clock the test moves by hand.
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}

test('formatHMS pads hours, minutes and seconds to two digits', () => {
  assert.equal(formatHMS(0), '00:00:00');
  assert.equal(formatHMS(5000), '00:00:05');
  assert.equal(formatHMS(61000), '00:01:01');
  assert.equal(formatHMS(3661000), '01:01:01');
  assert.equal(formatHMS(36000000), '10:00:00');
});

test('formatHMS drops partial seconds', () => {
  assert.equal(formatHMS(999), '00:00:00');
  assert.equal(formatHMS(1999), '00:00:01');
});

test('formatHMS clamps negative values to zero', () => {
  assert.equal(formatHMS(-1), '00:00:00');
  assert.equal(formatHMS(-60000), '00:00:00');
});

test('formatClock shows midnight as 12 AM', () => {
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 0, 0, 0)), { time: '12:00:00', period: 'AM' });
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 0, 30, 5)), { time: '12:30:05', period: 'AM' });
});

test('formatClock shows noon as 12 PM', () => {
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 12, 0, 0)), { time: '12:00:00', period: 'PM' });
});

test('formatClock uses 12-hour time with AM and PM', () => {
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 9, 5, 7)), { time: '9:05:07', period: 'AM' });
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 13, 5, 9)), { time: '1:05:09', period: 'PM' });
  assert.deepEqual(formatClock(new Date(2026, 0, 1, 23, 59, 59)), { time: '11:59:59', period: 'PM' });
});

test('stopwatch counts only while running', () => {
  const clock = fakeClock(1000);
  const sw = createStopwatch({ now: clock.now });
  assert.equal(sw.running, false);
  assert.equal(sw.elapsed(), 0);

  clock.advance(5000); // not started yet, so nothing counts
  assert.equal(sw.elapsed(), 0);

  sw.start();
  assert.equal(sw.running, true);
  clock.advance(2000);
  assert.equal(sw.elapsed(), 2000);

  sw.pause();
  assert.equal(sw.running, false);
  clock.advance(10000); // paused time does not count
  assert.equal(sw.elapsed(), 2000);

  sw.start();
  clock.advance(500);
  assert.equal(sw.elapsed(), 2500);
});

test('stopwatch ignores repeated start and pause calls', () => {
  const clock = fakeClock();
  const sw = createStopwatch({ now: clock.now });
  sw.start();
  clock.advance(1000);
  sw.start(); // must not restart the run
  clock.advance(1000);
  assert.equal(sw.elapsed(), 2000);
  sw.pause();
  sw.pause();
  clock.advance(1000);
  assert.equal(sw.elapsed(), 2000);
});

test('stopwatch reset zeroes the time and stops the run', () => {
  const clock = fakeClock();
  const sw = createStopwatch({ now: clock.now });
  sw.start();
  clock.advance(3000);
  sw.reset();
  assert.equal(sw.running, false);
  assert.equal(sw.elapsed(), 0);
  clock.advance(1000);
  assert.equal(sw.elapsed(), 0);
});

test('timer counts down while running and holds still when paused', () => {
  const clock = fakeClock();
  const timer = createTimer({ durationMs: 10000, now: clock.now });
  assert.equal(timer.remaining(), 10000);
  assert.equal(timer.done, false);

  timer.start();
  clock.advance(4000);
  assert.equal(timer.remaining(), 6000);

  timer.pause();
  clock.advance(5000); // paused time does not count down
  assert.equal(timer.remaining(), 6000);

  timer.start();
  clock.advance(1000);
  assert.equal(timer.remaining(), 5000);
  assert.equal(timer.done, false);
});

test('timer clamps remaining at zero and sets done when time runs out', () => {
  const clock = fakeClock();
  const timer = createTimer({ durationMs: 3000, now: clock.now });
  timer.start();
  clock.advance(2999);
  assert.equal(timer.done, false);
  clock.advance(1);
  assert.equal(timer.remaining(), 0);
  assert.equal(timer.done, true);
  assert.equal(timer.running, false);

  clock.advance(60000); // stays at zero, never negative
  assert.equal(timer.remaining(), 0);
  assert.equal(timer.done, true);
});

test('timer reset restores the full duration and stops', () => {
  const clock = fakeClock();
  const timer = createTimer({ durationMs: 5000, now: clock.now });
  timer.start();
  clock.advance(2000);
  timer.reset();
  assert.equal(timer.running, false);
  assert.equal(timer.remaining(), 5000);
  assert.equal(timer.done, false);
});

test('timer set changes the duration and clears progress', () => {
  const clock = fakeClock();
  const timer = createTimer({ durationMs: 60000, now: clock.now });
  timer.start();
  clock.advance(20000);
  timer.set(120000);
  assert.equal(timer.running, false);
  assert.equal(timer.remaining(), 120000);
});

test('timer started after it finished runs the full duration again', () => {
  const clock = fakeClock();
  const timer = createTimer({ durationMs: 2000, now: clock.now });
  timer.start();
  clock.advance(2000);
  assert.equal(timer.done, true);

  timer.start();
  assert.equal(timer.done, false);
  assert.equal(timer.remaining(), 2000);
  clock.advance(500);
  assert.equal(timer.remaining(), 1500);
});
