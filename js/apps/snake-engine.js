// Snake logic with no DOM. Each step moves the snake one cell; growth, food and death all resolve in step().

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Builds one game. rng picks food cells, so a seeded rng replays a game exactly.
export function createSnake({ cols = 20, rows = 20, rng = Math.random, initialLength = 3 } = {}) {
  let queue = []; // turns queued for the coming steps, at most two

  const game = {
    snake: [], // cells, head first
    dir: 'right', // current heading, a key of DIRS
    food: null,
    score: 0,
    dead: false,

    // Moves one cell along the queued or current heading.
    step() {
      if (game.dead) return;
      if (queue.length > 0) game.dir = queue.shift();
      const { x: dx, y: dy } = DIRS[game.dir];
      const head = game.snake[0];
      const next = { x: head.x + dx, y: head.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) {
        game.dead = true;
        return;
      }
      const eats = game.food !== null && next.x === game.food.x && next.y === game.food.y;
      // The tail leaves on this step unless the snake grows, so moving into it is safe.
      const body = eats ? game.snake : game.snake.slice(0, -1);
      if (body.some((cell) => cell.x === next.x && cell.y === next.y)) {
        game.dead = true;
        return;
      }
      game.snake.unshift(next);
      if (eats) {
        game.score += 1;
        game.food = placeFood();
      } else {
        game.snake.pop();
      }
    },

    // Queues a turn for a later step. Returns false when the turn is ignored.
    turn(name) {
      if (!Object.hasOwn(DIRS, name)) return false;
      if (queue.length >= 2) return false; // at most two turns wait
      // Reversal is checked against the last queued heading, not the current one.
      const heading = queue.at(-1) ?? game.dir;
      if (name === heading || name === OPPOSITE[heading]) return false; // no 180 reversal
      queue.push(name);
      return true;
    },

    reset() {
      const x0 = Math.floor(cols / 2);
      const y0 = Math.floor(rows / 2);
      const length = Math.max(1, Math.min(initialLength, x0 + 1));
      game.snake = Array.from({ length }, (_, i) => ({ x: x0 - i, y: y0 }));
      game.dir = 'right';
      game.score = 0;
      game.dead = false;
      queue = [];
      game.food = placeFood();
    },
  };

  // Picks a random free cell. A full board has no room for food, so the round ends.
  function placeFood() {
    const taken = new Set(game.snake.map((cell) => cell.y * cols + cell.x));
    const free = [];
    for (let i = 0; i < cols * rows; i += 1) {
      if (!taken.has(i)) free.push(i);
    }
    if (free.length === 0) {
      game.dead = true;
      return null;
    }
    const index = free[Math.min(free.length - 1, Math.floor(rng() * free.length))];
    return { x: index % cols, y: Math.floor(index / cols) };
  }

  game.reset();
  return game;
}
