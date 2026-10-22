// Snake window: a square board drawn on a canvas. The rules live in snake-engine.js.
import { createSnake } from './snake-engine.js';

const COLS = 20;
const ROWS = 20;
const TICK_MS = 120;
const PAD = 12; // gap between the board and the window edges
const CORNER = 8; // board corner radius, in CSS pixels
const BEST_KEY = 'fakeos.snake.best';

// Steering keys: arrows and WASD.
const STEER = new Map([
  ['ArrowUp', 'up'],
  ['w', 'up'],
  ['ArrowDown', 'down'],
  ['s', 'down'],
  ['ArrowLeft', 'left'],
  ['a', 'left'],
  ['ArrowRight', 'right'],
  ['d', 'right'],
]);

// Storage can be blocked (private windows, cleared site data), so every access is guarded.
function loadBest() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // The best score is a convenience; losing it is fine.
  }
}

// Rounded rectangle path, built from arcs so every canvas supports it.
function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

export default {
  id: 'snake',
  name: 'Snake',
  glyph: 'snake',
  tile: 'linear-gradient(#34c759, #0a7f2e)',
  width: 420,
  height: 470,
  minWidth: 300,
  minHeight: 360,
  resizable: true,
  open(ctx) {
    const body = ctx.window.body;
    const game = createSnake({ cols: COLS, rows: ROWS });
    let paused = false;
    let best = loadBest();

    body.classList.add('snake-body');
    body.tabIndex = 0;
    body.innerHTML = `
      <div class="snake-app">
        <div class="snake-header">
          <span class="snake-stat">Score <strong class="snake-score" aria-live="polite">0</strong></span>
          <span class="snake-stat">Best <strong class="snake-best">0</strong></span>
        </div>
        <div class="snake-board">
          <canvas class="snake-canvas" role="img" aria-label="Snake game board"></canvas>
          <div class="snake-overlay" role="status" hidden></div>
        </div>
      </div>`;

    const board = body.querySelector('.snake-board');
    const canvas = body.querySelector('.snake-canvas');
    const overlay = body.querySelector('.snake-overlay');
    const scoreEl = body.querySelector('.snake-score');
    const bestEl = body.querySelector('.snake-best');
    const c2d = canvas.getContext('2d');

    // Reads theme tokens, so the board follows light and dark mode.
    function palette() {
      const style = getComputedStyle(body);
      const token = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
      return {
        accent: token('--accent', '#0a84ff'),
        food: token('--danger', '#ff3b30'),
        field: token('--field', '#ffffff'),
        line: token('--line', 'rgba(0, 0, 0, 0.1)'),
      };
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = board.clientWidth;
      const h = board.clientHeight;
      // Match the backing store to the CSS size so the board stays sharp on retina screens.
      const pxW = Math.round(w * dpr);
      const pxH = Math.round(h * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, w, h);

      const colors = palette();
      const side = Math.max(0, Math.min(w, h) - PAD * 2);
      const cell = side / COLS;
      const x0 = (w - side) / 2;
      const y0 = (h - side) / 2;

      c2d.fillStyle = colors.field;
      roundRect(c2d, x0, y0, side, side, CORNER);
      c2d.fill();

      // Subtle grid, clipped to the rounded board.
      c2d.save();
      roundRect(c2d, x0, y0, side, side, CORNER);
      c2d.clip();
      c2d.strokeStyle = colors.line;
      c2d.lineWidth = 1;
      c2d.beginPath();
      for (let i = 1; i < COLS; i += 1) {
        const x = Math.round(x0 + i * cell) + 0.5;
        c2d.moveTo(x, y0);
        c2d.lineTo(x, y0 + side);
      }
      for (let i = 1; i < ROWS; i += 1) {
        const y = Math.round(y0 + i * cell) + 0.5;
        c2d.moveTo(x0, y);
        c2d.lineTo(x0 + side, y);
      }
      c2d.stroke();

      if (game.food) {
        c2d.fillStyle = colors.food;
        c2d.beginPath();
        c2d.arc(x0 + (game.food.x + 0.5) * cell, y0 + (game.food.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
        c2d.fill();
      }

      c2d.fillStyle = colors.accent;
      for (const segment of game.snake) {
        roundRect(c2d, x0 + segment.x * cell + 1, y0 + segment.y * cell + 1, cell - 2, cell - 2, cell * 0.25);
        c2d.fill();
      }
      c2d.restore();
    }

    // Header and overlay follow the game state, then the board redraws.
    function render() {
      // The score is a live region, and rewriting the same text would make screen readers repeat it.
      const score = String(game.score);
      if (scoreEl.textContent !== score) scoreEl.textContent = score;
      bestEl.textContent = String(best);
      if (game.dead) {
        overlay.textContent = 'Game over, press Enter';
      } else if (paused) {
        overlay.textContent = 'Paused, press Space';
      }
      overlay.hidden = !game.dead && !paused;
      draw();
    }

    function tick() {
      if (paused || game.dead) return;
      game.step();
      if (game.score > best) {
        best = game.score;
        // Another Snake window may have raised the stored best since this one opened.
        saveBest(Math.max(loadBest(), best));
      }
      render();
    }

    function restart() {
      game.reset();
      paused = false;
      render();
    }

    function togglePause() {
      if (game.dead) return;
      paused = !paused;
      render();
    }

    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (STEER.has(key)) {
        event.preventDefault();
        game.turn(STEER.get(key));
        return;
      }
      if (key !== ' ' && key !== 'Enter') return;
      event.preventDefault();
      if (event.repeat) return; // holding a key should not flip pause or restart again and again
      if (key === ' ') togglePause();
      else restart();
    }

    body.addEventListener('keydown', onKey);
    const timer = setInterval(tick, TICK_MS);
    const observer = new ResizeObserver(() => draw());
    observer.observe(board);
    // Theme changes move the tokens palette() reads, so a paused or finished board repaints here.
    ctx.on('prefs:change', () => draw());
    // Minimizing pauses the game. Restoring leaves it paused, so the player presses Space to resume.
    ctx.on('win:minimize', ({ pid }) => {
      if (pid !== ctx.pid || paused || game.dead) return;
      togglePause();
    });

    ctx.window.setMenu([
      {
        title: 'Game',
        items: [
          { label: 'New Game', shortcut: 'Enter', action: restart },
          { label: 'Pause', shortcut: 'Space', action: togglePause },
        ],
      },
    ]);

    ctx.window.onClose(() => {
      clearInterval(timer);
      observer.disconnect();
      body.removeEventListener('keydown', onKey);
    });

    render();
    body.focus({ preventScroll: true });
  },
};
