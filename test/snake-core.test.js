'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/snake-core.js');

// Deterministic RNG so tests are repeatable.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGame(opts = {}) {
  const cols = opts.cols || 20;
  const rows = opts.rows || 12;
  const blocked = new Uint8Array(cols * rows);
  (opts.blockedCells || []).forEach(([x, y]) => { blocked[y * cols + x] = 1; });
  return Core.createGame({ cols, rows, blocked, rng: mulberry32(opts.seed || 1) });
}

function occupies(state, x, y) {
  return state.snake.some(c => c.x === x && c.y === y);
}

test('createGame places a 4-cell snake and food on free, distinct cells', () => {
  const g = makeGame({ blockedCells: [[5, 5], [6, 5], [7, 5]] });
  assert.equal(g.snake.length, 4);
  assert.equal(g.alive, true);
  assert.equal(g.score, 0);
  for (const c of g.snake) {
    assert.ok(c.x >= 0 && c.x < g.cols && c.y >= 0 && c.y < g.rows);
    assert.equal(g.blocked[c.y * g.cols + c.x], 0, 'snake on blocked cell');
  }
  assert.equal(g.blocked[g.food.y * g.cols + g.food.x], 0, 'food on blocked cell');
  assert.equal(occupies(g, g.food.x, g.food.y), false, 'food on snake');
});

test('step moves the head one cell and drops the tail', () => {
  const g = makeGame();
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  g.food = { x: 0, y: 0 };
  Core.step(g);
  assert.deepEqual(g.snake[0], { x: 11, y: 6 });
  assert.equal(g.snake.length, 4);
  assert.deepEqual(g.prevTail, { x: 7, y: 6 });
  assert.equal(g.alive, true);
});

test('step onto food grows the snake, scores and respawns food elsewhere', () => {
  const g = makeGame();
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  g.food = { x: 11, y: 6 };
  Core.step(g);
  assert.equal(g.snake.length, 5);
  assert.equal(g.score, 1);
  assert.equal(g.prevTail, null, 'no tail moved when growing');
  assert.notDeepEqual(g.food, { x: 11, y: 6 });
  assert.equal(occupies(g, g.food.x, g.food.y), false);
});

test('step into the wall kills the snake', () => {
  const g = makeGame();
  g.snake = [{ x: 19, y: 6 }, { x: 18, y: 6 }, { x: 17, y: 6 }, { x: 16, y: 6 }];
  g.dir = { x: 1, y: 0 };
  Core.step(g);
  assert.equal(g.alive, false);
});

test('step into a blocked cell kills the snake', () => {
  const g = makeGame({ blockedCells: [[11, 6]] });
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  Core.step(g);
  assert.equal(g.alive, false);
});

test('step into its own body kills the snake', () => {
  const g = makeGame();
  // U-shape: head at (10,7) moving up into (10,6) which is body.
  g.snake = [{ x: 10, y: 7 }, { x: 11, y: 7 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 }];
  g.dir = { x: 0, y: -1 };
  g.food = { x: 0, y: 0 };
  Core.step(g);
  assert.equal(g.alive, false);
});

test('moving into the cell the tail is leaving is allowed', () => {
  const g = makeGame();
  // Square loop: head (10,7), tail at (10,6) directly above head. Moving up is safe.
  g.snake = [{ x: 10, y: 7 }, { x: 11, y: 7 }, { x: 11, y: 6 }, { x: 10, y: 6 }];
  g.dir = { x: 0, y: -1 };
  g.food = { x: 0, y: 0 };
  Core.step(g);
  assert.equal(g.alive, true);
  assert.deepEqual(g.snake[0], { x: 10, y: 6 });
});

test('setDirection ignores a direct reversal', () => {
  const g = makeGame();
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  Core.setDirection(g, { x: -1, y: 0 });
  assert.deepEqual(g.dir, { x: 1, y: 0 });
  Core.setDirection(g, { x: 0, y: 1 });
  assert.deepEqual(g.dir, { x: 0, y: 1 });
});

test('findPath returns the shortest route around a wall', () => {
  // Vertical wall at x=5 from y=0..10 on a 20x12 grid, gap at y=11.
  const wall = [];
  for (let y = 0; y <= 10; y++) wall.push([5, y]);
  const g = makeGame({ blockedCells: wall });
  g.snake = [{ x: 2, y: 2 }];
  const path = Core.findPath(g, { x: 2, y: 2 }, { x: 8, y: 2 });
  assert.ok(path, 'path exists');
  // Must pass through the gap at (5,11): down 9, right 6, up 9 = 24 steps.
  assert.equal(path.length, 24);
  assert.deepEqual(path[path.length - 1], { x: 8, y: 2 });
  assert.ok(path.some(c => c.x === 5 && c.y === 11), 'path uses the gap');
});

test('findPath returns null when the target is unreachable', () => {
  const wall = [];
  for (let y = 0; y < 12; y++) wall.push([5, y]);
  const g = makeGame({ blockedCells: wall });
  g.snake = [{ x: 2, y: 2 }];
  assert.equal(Core.findPath(g, { x: 2, y: 2 }, { x: 8, y: 2 }), null);
});

test('autoDirection heads straight for food on a clear line', () => {
  const g = makeGame();
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  g.food = { x: 14, y: 6 };
  assert.deepEqual(Core.autoDirection(g), { x: 1, y: 0 });
});

test('autoDirection never picks a move into a wall or obstacle', () => {
  const g = makeGame({ blockedCells: [[11, 6]] });
  g.snake = [{ x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }];
  g.dir = { x: 1, y: 0 };
  g.food = { x: 14, y: 6 };
  const d = Core.autoDirection(g);
  assert.notDeepEqual(d, { x: 1, y: 0 });
  assert.ok(Core.isFree(g, 10 + d.x, 6 + d.y));
});

test('autopilot survives 400 steps on a grid with an obstacle block', () => {
  const block = [];
  for (let x = 12; x < 20; x++) for (let y = 8; y < 14; y++) block.push([x, y]);
  const g = makeGame({ cols: 30, rows: 20, blockedCells: block, seed: 7 });
  for (let i = 0; i < 400; i++) {
    g.dir = Core.autoDirection(g);
    Core.step(g);
    assert.equal(g.alive, true, `died at step ${i}`);
  }
  assert.ok(g.score > 5, `expected to eat a few times, score ${g.score}`);
});

test('reset starts a fresh snake with score 0 and alive', () => {
  const g = makeGame();
  g.score = 9; g.alive = false; g.snake = [];
  Core.reset(g);
  assert.equal(g.alive, true);
  assert.equal(g.score, 0);
  assert.equal(g.snake.length, 4);
});
