// Calculator logic with no DOM. Operators apply as you type, left to right, so 2 + 3 * 4 = is 20.
const MAX_DIGITS = 12;

const OPS = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
};

// Keeps 12 significant digits, which also strips float noise (0.1 + 0.2 shows 0.3).
const clean = (n) => Number(n.toPrecision(MAX_DIGITS));

function format(n) {
  const v = clean(n);
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1e12 || abs < 1e-6) {
    const [mantissa, exponent] = v.toExponential(MAX_DIGITS - 1).split('e');
    return `${mantissa.replace(/\.?0+$/, '')}e${exponent}`;
  }
  return String(v);
}

// Leading zeros do not count toward the digit limit.
const significant = (text) => text.replace(/\D/g, '').replace(/^0+/, '').length;

export function createCalculator() {
  let entry = '0'; // text on the display, also the number being typed
  let fresh = true; // the next digit or point starts a new number
  let settled = false; // entry is a finished result, so +/- negates it in place
  let acc = null; // left operand waiting for the pending operator
  let op = null;
  let repeat = null; // last operator and operand, for repeated =
  let error = false;

  const value = () => Number(entry);

  // Returns null for division by zero or overflow.
  function compute(a, operator, b) {
    if (operator === '/' && b === 0) return null;
    const r = OPS[operator](a, b);
    return Number.isFinite(r) ? clean(r) : null;
  }

  function settle(r) {
    if (r === null) {
      error = true;
      return;
    }
    entry = format(r);
    fresh = true;
    settled = true;
  }

  function digit(d) {
    if (fresh) entry = d;
    else if (entry === '0') entry = d;
    else if (entry === '-0') entry = `-${d}`;
    else if (significant(entry) < MAX_DIGITS) entry += d;
    fresh = false;
    settled = false;
  }

  function point() {
    if (fresh) entry = '0.';
    else if (!entry.includes('.')) entry += '.';
    fresh = false;
    settled = false;
  }

  function sign() {
    if (fresh && !settled) {
      // Right after an operator: start a negative operand.
      entry = '-0';
      fresh = false;
    } else {
      entry = entry.startsWith('-') ? entry.slice(1) : `-${entry}`;
    }
  }

  function percent() {
    settle(value() / 100);
  }

  function backspace() {
    if (fresh) return;
    entry = entry.slice(0, -1);
    if (entry === '' || entry === '-') entry = '0';
  }

  function operator(next) {
    if (op && !fresh) {
      const r = compute(acc, op, value());
      if (r === null) {
        error = true;
        return;
      }
      acc = r;
      entry = format(r);
    } else if (!op) {
      acc = value();
    }
    op = next;
    fresh = true;
    settled = false;
    repeat = null;
  }

  function equals() {
    if (op) {
      const arg = value();
      repeat = { op, arg };
      const r = compute(acc, op, arg);
      acc = null;
      op = null;
      settle(r);
    } else if (repeat) {
      settle(compute(value(), repeat.op, repeat.arg));
    }
  }

  function clear() {
    entry = '0';
    fresh = true;
    settled = false;
    acc = null;
    op = null;
    repeat = null;
    error = false;
  }

  return {
    press(key) {
      if (key === 'AC') return clear();
      if (error) return;
      if (/^\d$/.test(key)) digit(key);
      else if (key === '.') point();
      else if (key === '+' || key === '-' || key === '*' || key === '/') operator(key);
      else if (key === '=') equals();
      else if (key === 'sign') sign();
      else if (key === 'percent') percent();
      else if (key === 'backspace') backspace();
    },
    get display() {
      return error ? 'Error' : entry;
    },
  };
}
