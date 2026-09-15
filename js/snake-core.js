/*
 * Snake core: pure game logic, no DOM.
 * Works as a classic browser script (window.SnakeCore) and as a Node module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnakeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  var START_LENGTH = 4;

  function inBounds(s, x, y) {
    return x >= 0 && y >= 0 && x < s.cols && y < s.rows;
  }

  function isBlocked(s, x, y) {
    return s.blocked[y * s.cols + x] === 1;
  }

  function bodyIndex(snake, x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return i;
    }
    return -1;
  }

  // A cell is free when it is inside the grid, not an obstacle and not on the
  // body. The tail counts as free because it moves away on the same tick.
  function isFree(s, x, y) {
    if (!inBounds(s, x, y) || isBlocked(s, x, y)) return false;
    var i = bodyIndex(s.snake, x, y);
    return i === -1 || i === s.snake.length - 1;
  }

  function occupancy(s, body) {
    var occ = new Uint8Array(s.cols * s.rows);
    for (var i = 0; i < body.length - 1; i++) occ[body[i].y * s.cols + body[i].x] = 1; // tail stays free
    return occ;
  }

  // Breadth-first search from `from` to `to`. Returns the list of cells to
  // walk (excluding `from`, ending with `to`) or null when unreachable.
  function findPath(s, from, to, opts) {
    var body = (opts && opts.body) || s.snake;
    if (from.x === to.x && from.y === to.y) return [];
    var n = s.cols * s.rows;
    var occ = occupancy(s, body);
    var parent = new Int32Array(n).fill(-1);
    var queue = new Int32Array(n);
    var qh = 0, qt = 0;
    var start = from.y * s.cols + from.x;
    var goal = to.y * s.cols + to.x;
    parent[start] = start;
    queue[qt++] = start;
    while (qh < qt) {
      var cur = queue[qh++];
      var cx = cur % s.cols, cy = (cur - cx) / s.cols;
      for (var d = 0; d < 4; d++) {
        var nx = cx + DIRS[d].x, ny = cy + DIRS[d].y;
        if (!inBounds(s, nx, ny)) continue;
        var ni = ny * s.cols + nx;
        if (parent[ni] !== -1) continue;
        if (ni !== goal && (s.blocked[ni] === 1 || occ[ni] === 1)) continue;
        parent[ni] = cur;
        if (ni === goal) {
          var path = [];
          for (var p = goal; p !== start; p = parent[p]) {
            var px = p % s.cols;
            path.push({ x: px, y: (p - px) / s.cols });
          }
          return path.reverse();
        }
        queue[qt++] = ni;
      }
    }
    return null;
  }

  // Body after walking `path`; grows by one on the last step when `eats`.
  function simulate(snake, path, eats) {
    var body = snake.slice();
    for (var i = 0; i < path.length; i++) {
      body.unshift(path[i]);
      if (!(eats && i === path.length - 1)) body.pop();
    }
    return body;
  }

  function tailReachable(s, body) {
    return findPath(s, body[0], body[body.length - 1], { body: body }) !== null;
  }

  function dirTo(from, to) {
    return { x: to.x - from.x, y: to.y - from.y };
  }

  function lastMove(s) {
    if (s.snake.length < 2) return s.dir;
    return dirTo(s.snake[1], s.snake[0]);
  }

  // Autopilot: shortest safe path to food, else chase the tail, else any free cell.
  function autoDirection(s) {
    var head = s.snake[0];
    if (s.food) {
      var path = findPath(s, head, s.food);
      if (path && tailReachable(s, simulate(s.snake, path, true))) return dirTo(head, path[0]);
    }
    var tail = s.snake[s.snake.length - 1];
    var toTail = findPath(s, head, tail);
    if (toTail && toTail.length > 0) {
      var next = toTail[0];
      var eatsNext = !!(s.food && next.x === s.food.x && next.y === s.food.y);
      if (tailReachable(s, simulate(s.snake, [next], eatsNext))) return dirTo(head, next);
    }
    var cur = lastMove(s);
    var order = [cur].concat(DIRS);
    for (var i = 0; i < order.length; i++) {
      var d = order[i];
      if (isFree(s, head.x + d.x, head.y + d.y)) return { x: d.x, y: d.y };
    }
    return { x: cur.x, y: cur.y };
  }

  function setDirection(s, d) {
    var m = lastMove(s);
    if (s.snake.length > 1 && d.x === -m.x && d.y === -m.y) return;
    s.dir = { x: d.x, y: d.y };
  }

  function freeCells(s) {
    var cells = [];
    for (var y = 0; y < s.rows; y++) {
      for (var x = 0; x < s.cols; x++) {
        if (!isBlocked(s, x, y) && bodyIndex(s.snake, x, y) === -1) cells.push({ x: x, y: y });
      }
    }
    return cells;
  }

  function spawnFood(s) {
    var cells = freeCells(s);
    s.food = cells.length ? cells[Math.floor(s.rng() * cells.length)] : null;
  }

  // Find a horizontal run of START_LENGTH free cells; head on the right, moving right.
  function placeSnake(s) {
    var candidates = [];
    for (var y = 0; y < s.rows; y++) {
      for (var x = START_LENGTH - 1; x < s.cols; x++) {
        var ok = true;
        for (var k = 0; k < START_LENGTH; k++) {
          if (isBlocked(s, x - k, y)) { ok = false; break; }
        }
        if (ok) candidates.push({ x: x, y: y });
      }
    }
    if (!candidates.length) { s.snake = []; return; }
    var h = candidates[Math.floor(s.rng() * candidates.length)];
    s.snake = [];
    for (var i = 0; i < START_LENGTH; i++) s.snake.push({ x: h.x - i, y: h.y });
  }

  function reset(s) {
    s.dir = { x: 1, y: 0 };
    s.score = 0;
    s.alive = true;
    s.prevTail = null;
    placeSnake(s);
    spawnFood(s);
  }

  function createGame(opts) {
    var s = {
      cols: opts.cols,
      rows: opts.rows,
      blocked: opts.blocked || new Uint8Array(opts.cols * opts.rows),
      rng: opts.rng || Math.random,
      snake: [],
      dir: { x: 1, y: 0 },
      food: null,
      alive: true,
      score: 0,
      prevTail: null
    };
    reset(s);
    return s;
  }

  function step(s) {
    if (!s.alive || !s.snake.length) return;
    var head = s.snake[0];
    var nx = head.x + s.dir.x, ny = head.y + s.dir.y;
    var eats = !!(s.food && nx === s.food.x && ny === s.food.y);
    var bi = bodyIndex(s.snake, nx, ny);
    var hitsBody = bi !== -1 && !(bi === s.snake.length - 1 && !eats);
    if (!inBounds(s, nx, ny) || isBlocked(s, nx, ny) || hitsBody) {
      s.alive = false;
      return;
    }
    s.snake.unshift({ x: nx, y: ny });
    if (eats) {
      s.score += 1;
      s.prevTail = null;
      spawnFood(s);
    } else {
      s.prevTail = s.snake.pop();
    }
  }

  return {
    DIRS: DIRS,
    createGame: createGame,
    reset: reset,
    step: step,
    setDirection: setDirection,
    findPath: findPath,
    autoDirection: autoDirection,
    isFree: isFree,
    spawnFood: spawnFood
  };
});
