/*
 * Pong core: pure match logic in pixels and milliseconds, no DOM.
 * Paddles sit on the left and right edge of a w x h court.
 * Works as a classic browser script (window.PongCore) and as a Node module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PongCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_SPEED = 0.42;    // px/ms at serve
  var MAX_SPEED = 0.9;
  var SPEEDUP = 1.05;       // per paddle hit
  var PADDLE_SPEED = 0.55;  // px/ms, human
  var AI_SPEED = 0.42;      // px/ms, computer
  var SERVE_MS = 900;
  var MAX_ANGLE = Math.PI / 3;
  var AIM_SPREAD = 1.25;    // computer aims off by up to this * paddleH / 2

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function createMatch(opts) {
    var s = {
      w: opts.w,
      h: opts.h,
      paddleH: clamp(opts.h * 0.2, 44, 110),
      paddleW: 8,
      ball: { x: opts.w / 2, y: opts.h / 2, r: 5, vx: 0, vy: 0 },
      left: { y: opts.h / 2 },
      right: { y: opts.h / 2 },
      score: { left: 0, right: 0 },
      rally: 0,
      serveTimer: SERVE_MS,
      serveDir: 1,
      rng: opts.rng || Math.random,
      aim: { left: 0, right: 0 }
    };
    return s;
  }

  // The computer's guess of where the ball will arrive is a little off,
  // re-rolled every time the ball turns around, so rallies end eventually.
  function rerollAim(s, side) {
    s.aim[side] = (s.rng() - 0.5) * s.paddleH * AIM_SPREAD;
  }

  function serve(s) {
    var angle = (s.rng() - 0.5) * (Math.PI / 3);
    s.ball.vx = Math.cos(angle) * BASE_SPEED * s.serveDir;
    s.ball.vy = Math.sin(angle) * BASE_SPEED;
    s.rally = 0;
    rerollAim(s, s.serveDir > 0 ? 'right' : 'left');
  }

  function aiMove(s, side) {
    var p = s[side];
    var b = s.ball;
    var incoming = side === 'left' ? b.vx < 0 : b.vx > 0;
    var target = incoming ? b.y + s.aim[side] : s.h / 2;
    var d = target - p.y;
    if (Math.abs(d) < 4) return 0;
    return d > 0 ? 1 : -1;
  }

  function movePaddle(s, side, dir, speed, dt) {
    var p = s[side];
    p.y = clamp(p.y + dir * speed * dt, s.paddleH / 2, s.h - s.paddleH / 2);
  }

  function bounce(s, side) {
    var b = s.ball;
    var p = s[side];
    var offset = clamp((b.y - p.y) / (s.paddleH / 2), -1, 1);
    var speed = Math.min(MAX_SPEED, Math.sqrt(b.vx * b.vx + b.vy * b.vy) * SPEEDUP);
    var angle = offset * MAX_ANGLE;
    var dir = side === 'left' ? 1 : -1;
    b.vx = Math.cos(angle) * speed * dir;
    b.vy = Math.sin(angle) * speed;
    b.x = side === 'left' ? s.paddleW + b.r : s.w - s.paddleW - b.r;
    s.rally += 1;
    rerollAim(s, side === 'left' ? 'right' : 'left');
  }

  function point(s, winner) {
    s.score[winner] += 1;
    s.serveDir = winner === 'left' ? -1 : 1; // the loser receives the serve
    s.ball.x = s.w / 2;
    s.ball.y = s.h / 2;
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.serveTimer = SERVE_MS;
  }

  // input.left / input.right: -1, 0, 1 for a human; null or undefined for the computer.
  function step(s, dt, input) {
    input = input || {};
    var sides = ['left', 'right'];
    for (var i = 0; i < 2; i++) {
      var side = sides[i];
      var v = input[side];
      if (v === undefined || v === null) movePaddle(s, side, aiMove(s, side), AI_SPEED, dt);
      else movePaddle(s, side, v, PADDLE_SPEED, dt);
    }

    if (s.serveTimer > 0) {
      s.serveTimer -= dt;
      s.ball.x = s.w / 2;
      s.ball.y = s.h / 2;
      if (s.serveTimer <= 0) {
        s.serveTimer = 0;
        serve(s);
      }
      return;
    }

    var b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
    else if (b.y + b.r > s.h) { b.y = s.h - b.r; b.vy = -Math.abs(b.vy); }

    var reach = s.paddleH / 2 + b.r;
    if (b.vx < 0 && b.x - b.r <= s.paddleW && b.x + b.r >= 0 && Math.abs(b.y - s.left.y) <= reach) bounce(s, 'left');
    else if (b.vx > 0 && b.x + b.r >= s.w - s.paddleW && b.x - b.r <= s.w && Math.abs(b.y - s.right.y) <= reach) bounce(s, 'right');

    if (b.x + b.r < 0) point(s, 'right');
    else if (b.x - b.r > s.w) point(s, 'left');
  }

  return { createMatch: createMatch, step: step, aiMove: aiMove, SERVE_MS: SERVE_MS };
});
