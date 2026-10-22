// Calculator window: a readout over a keypad. The arithmetic lives in calc-engine.js.
import { createCalculator } from './calc-engine.js';

const ROWS = [
  [
    { label: 'AC', key: 'AC' },
    { label: '±', key: 'sign' },
    { label: '%', key: 'percent' },
    { label: '÷', key: '/', kind: 'op' },
  ],
  [
    { label: '7', key: '7' },
    { label: '8', key: '8' },
    { label: '9', key: '9' },
    { label: '×', key: '*', kind: 'op' },
  ],
  [
    { label: '4', key: '4' },
    { label: '5', key: '5' },
    { label: '6', key: '6' },
    { label: '−', key: '-', kind: 'op' },
  ],
  [
    { label: '1', key: '1' },
    { label: '2', key: '2' },
    { label: '3', key: '3' },
    { label: '+', key: '+', kind: 'op' },
  ],
  [
    { label: '0', key: '0', kind: 'wide' },
    { label: '.', key: '.' },
    { label: '=', key: '=', kind: 'op' },
  ],
];

// Keyboard names that stand for an engine key.
const ALIASES = new Map([
  ['Enter', '='],
  ['Escape', 'AC'],
  ['Backspace', 'backspace'],
  ['%', 'percent'],
  ['x', '*'],
  ['X', '*'],
]);
const ENGINE_KEYS = new Set([...'0123456789.+-*/=', 'AC', 'sign', 'percent', 'backspace']);

// Long text shrinks so it stays on one line in the 232px readout.
const fontSizeFor = (text) => Math.min(56, Math.floor(232 / (text.length * 0.6)));

export default {
  id: 'calculator',
  name: 'Calculator',
  glyph: 'calc',
  tile: 'linear-gradient(#8e8e93, #3a3a3c)',
  pinned: true,
  width: 264,
  height: 404,
  minWidth: 264,
  minHeight: 404,
  resizable: false,
  open(ctx) {
    const body = ctx.window.body;
    const calc = createCalculator();
    body.classList.add('calculator-body');
    body.tabIndex = -1;
    body.innerHTML = `
      <div class="calculator-app">
        <div class="calculator-screen"><div class="calculator-readout" aria-live="polite"></div></div>
        <div class="calculator-keypad"></div>
      </div>`;

    const readout = body.querySelector('.calculator-readout');
    const keypad = body.querySelector('.calculator-keypad');

    function render() {
      readout.textContent = calc.display;
      readout.style.fontSize = `${fontSizeFor(calc.display)}px`;
    }

    function press(key) {
      calc.press(key);
      render();
      body.focus({ preventScroll: true });
    }

    function copy() {
      try {
        navigator.clipboard?.writeText(calc.display).catch(() => {});
      } catch {
        // Clipboard access can be refused; copying is best effort.
      }
    }

    for (const row of ROWS) {
      for (const spec of row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.tabIndex = -1;
        btn.className = spec.kind ? `calculator-key is-${spec.kind}` : 'calculator-key';
        btn.textContent = spec.label;
        btn.addEventListener('click', () => press(spec.key));
        keypad.append(btn);
      }
    }
    // Keep focus on the body so the keyboard keeps working after a click.
    keypad.addEventListener('mousedown', (event) => event.preventDefault());

    body.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copy();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = ALIASES.get(event.key) ?? event.key;
      if (!ENGINE_KEYS.has(key)) return;
      event.preventDefault();
      press(key);
    });

    ctx.window.setMenu([{ title: 'Edit', items: [{ label: 'Copy', shortcut: 'Cmd+C', action: copy }] }]);

    render();
    body.focus({ preventScroll: true });
  },
};
