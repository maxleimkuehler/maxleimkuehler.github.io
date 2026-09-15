/*
 * Snake for the game host. Autopilot keeps clear of the text blocks; a visitor
 * who takes over gets the whole board, and the block the snake is behind dims.
 */
(function () {
  'use strict';
  var Core = window.SnakeCore;
  var Host = window.GameHost;
  if (!Core || !Host) return;

  var CELL = 22;            // grid cell in CSS px
  var MARGIN = 12;          // clearance around text blocks in px
  var AUTO_MS = 1000 / 7;   // autopilot speed
  var PLAYER_MS = 1000 / 9; // player speed
  var FADE_OUT_MS = 700;
  var FADE_IN_MS = 500;
  var SWIPE_PX = 24;

  var COLOR = {
    auto: 'rgba(150, 112, 240, 0.30)',
    player: 'rgba(172, 138, 252, 0.72)',
    food: '#ee3d86'
  };

  var KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  Host.register('snake', function () {
    var state = null;
    var blockedText = null;  // board with text blocks as obstacles (autopilot)
    var blockedOpen = null;  // empty board (player runs behind the text)
    var blocks = [];         // text blocks with exact cell ranges, for dimming
    var cols = 0, rows = 0, ox = 0, oy = 0, W = 0, H = 0;
    var mode = 'auto';       // 'auto' | 'player'
    var pending = null;      // direction queued by the player
    var moved = false;       // true once the snake has stepped since its last reset
    var phase = 'live';      // 'live' | 'dying' | 'spawning'
    var phaseStart = 0;
    var lastTick = 0;
    var tFrac = 1;           // interpolation between ticks
    var innerAlpha = 1;      // fade for dying / spawning
    var touchStart = null;

    // ---- grid and obstacles -----------------------------------------------

    function markObstacles(blocked, rects) {
      blocks = [];
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        blocks.push({
          el: r.el,
          x0: clamp(Math.floor((r.left - ox) / CELL), 0, cols - 1),
          x1: clamp(Math.floor((r.right - ox) / CELL), 0, cols - 1),
          y0: clamp(Math.floor((r.top - oy) / CELL), 0, rows - 1),
          y1: clamp(Math.floor((r.bottom - oy) / CELL), 0, rows - 1)
        });
        var x0 = clamp(Math.floor((r.left - MARGIN - ox) / CELL), 0, cols - 1);
        var x1 = clamp(Math.floor((r.right + MARGIN - ox) / CELL), 0, cols - 1);
        var y0 = clamp(Math.floor((r.top - MARGIN - oy) / CELL), 0, rows - 1);
        var y1 = clamp(Math.floor((r.bottom + MARGIN - oy) / CELL), 0, rows - 1);
        for (var y = y0; y <= y1; y++) {
          for (var x = x0; x <= x1; x++) blocked[y * cols + x] = 1;
        }
      }
    }

    function cellOk(c) {
      return c && c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows && state.blocked[c.y * cols + c.x] === 0;
    }

    function snakeOk() {
      for (var i = 0; i < state.snake.length; i++) if (!cellOk(state.snake[i])) return false;
      return state.snake.length > 0;
    }

    // Dim exactly the text blocks the player's snake is currently behind.
    function updateDim() {
      for (var b = 0; b < blocks.length; b++) {
        var blk = blocks[b];
        var hit = false;
        if (mode === 'player' && state) {
          for (var i = 0; i < state.snake.length; i++) {
            var c = state.snake[i];
            if (c.x >= blk.x0 && c.x <= blk.x1 && c.y >= blk.y0 && c.y <= blk.y1) { hit = true; break; }
          }
        }
        blk.el.classList.toggle('is-dimmed', hit);
      }
    }

    // Fresh snake in autopilot, text blocks back in place.
    function resetGame() {
      mode = 'auto';
      state.blocked = blockedText;
      Core.reset(state);
      moved = false;
      pending = null;
      updateDim();
    }

    function layout(env) {
      W = env.W;
      H = env.H;
      cols = Math.floor(W / CELL);
      rows = Math.floor(H / CELL);
      ox = (W - cols * CELL) / 2;
      oy = (H - rows * CELL) / 2;

      blockedText = new Uint8Array(cols * rows);
      blockedOpen = new Uint8Array(cols * rows);
      markObstacles(blockedText, env.blocks);

      if (!state) {
        state = Core.createGame({ cols: cols, rows: rows, blocked: blockedText });
      } else {
        state.cols = cols;
        state.rows = rows;
        state.blocked = mode === 'player' ? blockedOpen : blockedText;
        if (!snakeOk()) resetGame();
        else if (!cellOk(state.food)) Core.spawnFood(state);
      }
      updateDim();
    }

    // ---- simulation -------------------------------------------------------

    function tick() {
      if (mode === 'auto') {
        state.dir = Core.autoDirection(state);
      } else if (pending) {
        Core.setDirection(state, pending);
        pending = null;
      }
      Core.step(state);
      if (!state.alive) {
        phase = 'dying';
        phaseStart = performance.now();
        return;
      }
      moved = true;
      if (mode === 'player') updateDim();
    }

    function frame(now) {
      if (phase === 'live') {
        var interval = mode === 'player' ? PLAYER_MS : AUTO_MS;
        if (now - lastTick > 1000) lastTick = now - interval;
        var guard = 0;
        while (phase === 'live' && now - lastTick >= interval && guard++ < 3) {
          lastTick += interval;
          tick();
        }
        tFrac = phase === 'live' ? Math.min(1, (now - lastTick) / interval) : 1;
        innerAlpha = 1;
      } else if (phase === 'dying') {
        var k = (now - phaseStart) / FADE_OUT_MS;
        tFrac = 1;
        if (k >= 1) {
          resetGame();
          phase = 'spawning';
          phaseStart = now;
          innerAlpha = 0;
        } else {
          innerAlpha = 1 - k;
        }
      } else {
        var j = (now - phaseStart) / FADE_IN_MS;
        tFrac = 1;
        if (j >= 1) {
          phase = 'live';
          lastTick = now;
          innerAlpha = 1;
        } else {
          innerAlpha = j;
        }
      }
    }

    // Reduced motion: one long, still winding.
    function still() {
      for (var i = 0; i < 500; i++) {
        state.dir = Core.autoDirection(state);
        Core.step(state);
        if (!state.alive) Core.reset(state);
      }
      moved = false;
      tFrac = 1;
      innerAlpha = 1;
    }

    // ---- drawing ----------------------------------------------------------

    function center(c) { return { x: ox + (c.x + 0.5) * CELL, y: oy + (c.y + 0.5) * CELL }; }
    function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

    function draw(ctx, hostAlpha, now) {
      var alpha = hostAlpha * innerAlpha;
      if (!state || alpha <= 0) return;

      if (state.food) {
        var f = center(state.food);
        var pulse = 0.9 + 0.1 * Math.sin(now / 420);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = COLOR.food;
        ctx.shadowBlur = 18 * pulse;
        ctx.fillStyle = COLOR.food;
        ctx.beginPath();
        ctx.arc(f.x, f.y, CELL * 0.17 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      var s = state.snake;
      var n = s.length;
      if (!n) return;
      var pts = [];
      if (n === 1) {
        pts.push(center(s[0]));
      } else {
        var tail = s[n - 1];
        pts.push(moved && state.prevTail ? lerp(center(state.prevTail), center(tail), tFrac) : center(tail));
        for (var i = n - 1; i >= 1; i--) pts.push(center(s[i]));
        pts.push(moved ? lerp(center(s[1]), center(s[0]), tFrac) : center(s[0]));
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = mode === 'player' ? COLOR.player : COLOR.auto;
      ctx.lineWidth = CELL * 0.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
      ctx.stroke();
      ctx.restore();
    }

    // ---- input ------------------------------------------------------------

    function takeOver(dir) {
      if (!state || phase !== 'live') return;
      if (mode !== 'player') {
        mode = 'player';
        state.blocked = blockedOpen;
        state.score = 0;
        lastTick = performance.now() - PLAYER_MS; // respond on the next frame
      }
      pending = dir;
    }

    return {
      enter: function (env) {
        layout(env);
        lastTick = performance.now();
      },
      layout: layout,
      frame: frame,
      draw: draw,
      still: still,
      key: function (e) {
        var k = KEYS[e.key];
        if (!k) return false;
        takeOver({ x: k[0], y: k[1] });
        return true;
      },
      touch: function (type, x, y) {
        if (type === 'start') { touchStart = { x: x, y: y }; return; }
        if (type !== 'end' || !touchStart) return;
        var dx = x - touchStart.x;
        var dy = y - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
        if (Math.abs(dx) > Math.abs(dy)) takeOver({ x: dx > 0 ? 1 : -1, y: 0 });
        else takeOver({ x: 0, y: dy > 0 ? 1 : -1 });
      },
      exit: function () {
        mode = 'auto';
        updateDim();
      },
      debug: function () {
        return {
          mode: mode, phase: phase, moved: moved,
          head: state && state.snake[0] ? { x: state.snake[0].x, y: state.snake[0].y } : null,
          length: state ? state.snake.length : 0, score: state ? state.score : 0, cols: cols, rows: rows
        };
      }
    };
  });
})();
