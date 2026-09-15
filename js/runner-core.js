/*
 * Runner core: an endless runner in pixels and milliseconds, no DOM.
 * A dot runs along a ground line and jumps over bars that scroll in from the right.
 * Works as a classic browser script (window.RunnerCore) and as a Node module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RunnerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GRAVITY = 0.0024;      // px/ms^2
  var JUMP_V = -0.78;        // px/ms; apex about 127 px, airborne about 650 ms
  var START_SPEED = 0.44;    // px/ms
  var MAX_SPEED = 0.8;
  var ACCEL = 0.000004;      // px/ms^2 (about +0.24 px/ms per minute)
  var RUNNER_R = 7;
  var BAR_W = 10;
  var BAR_GAP = 6;
  var LEAD_MS = 180;         // autopilot jumps this long before reaching a bar

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function createRun(opts) {
    return {
      w: opts.w,
      groundY: opts.groundY,
      runner: { x: opts.w * 0.18, y: opts.groundY - RUNNER_R, vy: 0, r: RUNNER_R },
      obstacles: [],
      speed: START_SPEED,
      distance: 0,
      alive: true,
      nextIn: opts.w * 0.6,    // px of travel until the next bar group
      rng: opts.rng || Math.random
    };
  }

  function spawn(s) {
    var units = 1 + Math.floor(s.rng() * 3);
    s.obstacles.push({
      x: s.w + 10,
      w: units * BAR_W + (units - 1) * BAR_GAP,
      h: 30 + Math.floor(s.rng() * 3) * 12
    });
    // Enough room to land and jump again (needs about speed * 470 px), scaled with the speed.
    s.nextIn = s.speed * 560 + 30 + s.rng() * 300;
  }

  function hits(s, o) {
    var r = s.runner;
    var cx = clamp(r.x, o.x, o.x + o.w);
    var cy = clamp(r.y, s.groundY - o.h, s.groundY);
    var dx = r.x - cx;
    var dy = r.y - cy;
    return dx * dx + dy * dy < r.r * r.r;
  }

  function step(s, dt, jump) {
    if (!s.alive) return;
    var r = s.runner;
    var groundLine = s.groundY - r.r;
    if (jump && r.y >= groundLine) r.vy = JUMP_V;
    r.vy += GRAVITY * dt;
    r.y += r.vy * dt;
    if (r.y >= groundLine) { r.y = groundLine; r.vy = 0; }

    s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt);
    var dx = s.speed * dt;
    s.distance += dx;

    for (var i = s.obstacles.length - 1; i >= 0; i--) {
      var o = s.obstacles[i];
      o.x -= dx;
      if (o.x + o.w < -10) s.obstacles.splice(i, 1);
    }
    s.nextIn -= dx;
    if (s.nextIn <= 0) spawn(s);

    for (var k = 0; k < s.obstacles.length; k++) {
      if (hits(s, s.obstacles[k])) { s.alive = false; return; }
    }
  }

  // Autopilot: jump once the next bar is within reach.
  function shouldJump(s) {
    var r = s.runner;
    var next = null;
    for (var i = 0; i < s.obstacles.length; i++) {
      var o = s.obstacles[i];
      if (o.x + o.w >= r.x && (!next || o.x < next.x)) next = o;
    }
    if (!next) return false;
    var d = next.x - (r.x + r.r);
    return d <= s.speed * LEAD_MS;
  }

  return { createRun: createRun, step: step, shouldJump: shouldJump };
});
