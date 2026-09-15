/*
 * Pong for the game host. Two computers rally in the free band between the
 * text blocks. Arrow keys take the right paddle, W and S the left one; a
 * paddle nobody touches for a while goes back to the computer.
 */
(function () {
  'use strict';
  var Core = window.PongCore;
  var Host = window.GameHost;
  if (!Core || !Host) return;

  var HUMAN_IDLE_MS = 6000;
  var COLOR = {
    auto: 'rgba(150, 112, 240, 0.45)',
    human: 'rgba(172, 138, 252, 0.85)',
    ball: '#ee3d86'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  Host.register('pong', function () {
    var m = null;
    var court = { left: 0, top: 0, right: 0, bottom: 0 };
    var last = 0;
    var human = { left: false, right: false };
    var dir = { left: 0, right: 0 };
    var lastInput = { left: 0, right: 0 };
    var W = 0;

    function layout(env) {
      W = env.W;
      court = { left: env.pad, top: env.band.top, right: env.W - env.pad, bottom: env.band.bottom };
      var w = court.right - court.left;
      var h = court.bottom - court.top;
      if (!m) {
        m = Core.createMatch({ w: w, h: h });
      } else {
        var sx = w / m.w, sy = h / m.h;
        m.ball.x *= sx; m.ball.y *= sy;
        m.left.y *= sy; m.right.y *= sy;
        m.w = w; m.h = h;
        m.paddleH = clamp(h * 0.2, 44, 110);
        m.left.y = clamp(m.left.y, m.paddleH / 2, h - m.paddleH / 2);
        m.right.y = clamp(m.right.y, m.paddleH / 2, h - m.paddleH / 2);
      }
    }

    function touch(side, now) {
      human[side] = true;
      lastInput[side] = now;
    }

    function frame(now) {
      var dt = last ? Math.min(50, now - last) : 16;
      last = now;
      var sides = ['left', 'right'];
      for (var i = 0; i < 2; i++) {
        var s = sides[i];
        if (human[s] && dir[s] === 0 && now - lastInput[s] > HUMAN_IDLE_MS) human[s] = false;
      }
      Core.step(m, dt, {
        left: human.left ? dir.left : null,
        right: human.right ? dir.right : null
      });
    }

    function paddle(ctx, x, y, on) {
      ctx.strokeStyle = on ? COLOR.human : COLOR.auto;
      ctx.lineWidth = m.paddleW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - m.paddleH / 2 + m.paddleW / 2);
      ctx.lineTo(x, y + m.paddleH / 2 - m.paddleW / 2);
      ctx.stroke();
    }

    function draw(ctx, alpha, now) {
      if (!m || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      paddle(ctx, court.left + m.paddleW / 2, court.top + m.left.y, human.left);
      paddle(ctx, court.right - m.paddleW / 2, court.top + m.right.y, human.right);
      var pulse = 0.9 + 0.1 * Math.sin(now / 420);
      ctx.shadowColor = COLOR.ball;
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = COLOR.ball;
      ctx.beginPath();
      ctx.arc(court.left + m.ball.x, court.top + m.ball.y, m.ball.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    var KEYS = {
      ArrowUp: ['right', -1], ArrowDown: ['right', 1],
      w: ['left', -1], s: ['left', 1], W: ['left', -1], S: ['left', 1]
    };

    return {
      enter: function (env) {
        layout(env);
        last = 0;
      },
      layout: layout,
      frame: frame,
      draw: draw,
      still: function () {
        for (var t = 0; t < 4000; t += 16) Core.step(m, 16, {});
      },
      key: function (e) {
        var k = KEYS[e.key];
        if (!k) return false;
        touch(k[0], performance.now());
        dir[k[0]] = k[1];
        return true;
      },
      keyup: function (e) {
        var k = KEYS[e.key];
        if (!k) return;
        if (dir[k[0]] === k[1]) dir[k[0]] = 0;
        lastInput[k[0]] = performance.now();
      },
      touch: function (type, x, y) {
        if (type === 'end' || !m) return;
        var side = x < W / 2 ? 'left' : 'right';
        touch(side, performance.now());
        dir[side] = 0;
        m[side].y = clamp(y - court.top, m.paddleH / 2, m.h - m.paddleH / 2);
      },
      debug: function () {
        return {
          court: court, paddleH: m ? m.paddleH : 0,
          ball: m ? { x: m.ball.x, y: m.ball.y, vx: m.ball.vx, vy: m.ball.vy } : null,
          left: { y: m ? m.left.y : 0, human: human.left },
          right: { y: m ? m.right.y : 0, human: human.right },
          score: m ? m.score : null
        };
      }
    };
  });
})();
