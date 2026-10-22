// Snake engine tests. Each game gets a scripted or seeded rng, so every run plays out the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnake, DIRS } from '../js/apps/snake-engine.js';

// Park-Miller generator: the same seed always gives the same food and turns.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const onSnake = (game, cell) => game.snake.some((c) => c.x === cell.x && c.y === cell.y);

test('starts as a three cell snake facing right', () => {
  const game = createSnake();
  assert.deepEqual(game.snake, [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  assert.equal(game.dir, 'right');
  assert.equal(game.score, 0);
  assert.equal(game.dead, false);
  assert.ok(game.food && !onSnake(game, game.food));
});

test('moves one cell per step in the heading', () => {
  const game = createSnake({ rng: () => 0 });
  game.step();
  assert.deepEqual(game.snake, [{ x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }]);
  assert.equal(game.dead, false);
});

test('applies a queued turn on the next step', () => {
  const game = createSnake({ rng: () => 0 });
  assert.equal(game.turn('up'), true);
  game.step();
  assert.equal(game.dir, 'up');
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
});

test('grows and scores when the head reaches food', () => {
  const game = createSnake({ rng: () => 0 });
  game.food = { x: 11, y: 10 };
  game.step();
  assert.equal(game.snake.length, 4);
  assert.deepEqual(game.snake[0], { x: 11, y: 10 });
  assert.equal(game.score, 1);
  assert.deepEqual(game.food, { x: 0, y: 0 }); // rng returns 0, so the first free cell
});

test('keeps its length when no food is reached', () => {
  const game = createSnake({ rng: () => 0 });
  game.food = { x: 19, y: 19 };
  game.step();
  assert.equal(game.snake.length, 3);
  assert.equal(game.score, 0);
});

test('dies on a wall and stops moving', () => {
  const game = createSnake({ cols: 5, rows: 5, rng: () => 0 });
  game.step();
  game.step();
  assert.equal(game.dead, false);
  assert.deepEqual(game.snake[0], { x: 4, y: 2 });
  game.step();
  assert.equal(game.dead, true);
  const frozen = JSON.stringify(game.snake);
  game.step();
  assert.equal(JSON.stringify(game.snake), frozen);
});

test('dies when the head runs into its own body', () => {
  // Down, left, then up walks the head into the body it just left behind.
  const game = createSnake({ initialLength: 6, rng: () => 0 });
  game.turn('down');
  game.step();
  game.turn('left');
  game.step();
  game.turn('up');
  game.step();
  assert.equal(game.dead, true);
});

test('can move into the tail cell it vacates', () => {
  const game = createSnake({ rng: () => 0 });
  game.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }];
  game.dir = 'left';
  game.food = { x: 19, y: 19 };
  game.step();
  assert.equal(game.dead, false);
  assert.deepEqual(game.snake[0], { x: 4, y: 5 });
});

test('ignores a 180 degree reversal', () => {
  const game = createSnake({ rng: () => 0 });
  assert.equal(game.turn('left'), false);
  game.step();
  assert.deepEqual(game.snake[0], { x: 11, y: 10 });
  assert.equal(game.dead, false);
});

test('checks reversal against the heading after a turn', () => {
  const game = createSnake({ rng: () => 0 });
  game.turn('up');
  game.step(); // now heading up
  assert.equal(game.turn('down'), false);
  game.step();
  assert.equal(game.dir, 'up');
  assert.deepEqual(game.snake[0], { x: 10, y: 8 });
});

test('queues at most two turns per step', () => {
  const game = createSnake({ rng: () => 0 });
  assert.equal(game.turn('up'), true);
  assert.equal(game.turn('left'), true);
  assert.equal(game.turn('down'), false);
  game.step();
  assert.equal(game.dir, 'up');
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
});

test('applies two quick turns queued before one step across two steps', () => {
  const game = createSnake({ rng: () => 0 });
  assert.equal(game.turn('up'), true);
  // Left reverses the current heading, but the queued up is the last heading, so it is a legal turn.
  assert.equal(game.turn('left'), true);
  game.step();
  assert.equal(game.dir, 'up');
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
  game.step();
  assert.equal(game.dir, 'left');
  assert.deepEqual(game.snake[0], { x: 9, y: 9 });
});

test('rejects a reversal of a queued turn', () => {
  const game = createSnake({ rng: () => 0 });
  assert.equal(game.turn('up'), true);
  assert.equal(game.turn('down'), false);
  game.step();
  assert.equal(game.dir, 'up');
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
});

test('food is never placed on the snake', () => {
  const names = Object.keys(DIRS);
  const pick = seeded(11);
  const game = createSnake({ cols: 8, rows: 8, rng: seeded(7) });
  let eaten = 0;
  for (let i = 0; i < 2000; i += 1) {
    game.turn(names[Math.floor(pick() * names.length)]);
    game.step();
    if (game.dead) {
      eaten += game.score;
      game.reset();
    }
    assert.ok(game.food && !onSnake(game, game.food), `food on snake at step ${i}`);
  }
  assert.ok(eaten > 0, 'the random games should eat at least once');
});

test('reset starts a fresh game and drops a queued turn', () => {
  const game = createSnake({ rng: () => 0 });
  game.food = { x: 11, y: 10 };
  game.step();
  game.turn('up');
  game.reset();
  assert.deepEqual(game.snake, [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  assert.equal(game.dir, 'right');
  assert.equal(game.score, 0);
  assert.equal(game.dead, false);
  game.step();
  assert.deepEqual(game.snake[0], { x: 11, y: 10 });
});
