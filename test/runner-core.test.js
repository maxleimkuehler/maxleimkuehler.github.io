'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Runner = require('../js/runner-core.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(seed) { return Runner.createRun({ w: 1200, groundY: 300, rng: mulberry32(seed || 1) }); }
function advance(r, ms, jump) { for (let t = 0; t < ms; t += 16) Runner.step(r, 16, !!jump); }
function onGround(r) { return r.runner.y === r.groundY - r.runner.r; }

test('createRun puts the runner on the ground, alive, with a clear track', () => {
  const r = run();
  assert.equal(r.alive, true);
  assert.ok(onGround(r));
  assert.equal(r.runner.vy, 0);
  assert.equal(r.obstacles.length, 0);
  assert.ok(r.runner.x > 0 && r.runner.x < r.w / 2, 'runner sits in the left part of the track');
  assert.ok(r.speed >= 0.44, 'starts brisk, at ' + r.speed);
});

test('a jump lifts the runner and it lands again', () => {
  const r = run();
  Runner.step(r, 16, true);
  assert.ok(r.runner.vy < 0, 'moving up');
  advance(r, 150, false);
  assert.ok(r.runner.y < r.groundY - r.runner.r - 40, 'well above the ground');
  advance(r, 1500, false);
  assert.ok(onGround(r), 'back on the ground');
  assert.equal(r.runner.vy, 0);
});

test('jumping in the air does nothing', () => {
  const r = run();
  Runner.step(r, 16, true);
  advance(r, 100, false);
  const vy = r.runner.vy;
  Runner.step(r, 16, true);
  assert.ok(r.runner.vy > vy, 'gravity keeps acting, no second boost');
});

test('obstacles appear ahead, scroll left and vanish once off screen', () => {
  const r = run();
  advance(r, 3000, false);
  assert.ok(r.obstacles.length > 0, 'something spawned');
  for (const o of r.obstacles) assert.ok(o.x + o.w > 0 && o.h > 0 && o.w > 0);
  const first = r.obstacles[0];
  const x0 = first.x;
  Runner.step(r, 16, false);
  assert.ok(first.x < x0, 'scrolls left');
});

test('running into an obstacle ends the run', () => {
  const r = run();
  r.obstacles.push({ x: r.runner.x + 40, w: 20, h: 40 });
  advance(r, 1000, false);
  assert.equal(r.alive, false);
  const frozen = JSON.stringify(r.obstacles);
  advance(r, 500, true);
  assert.equal(JSON.stringify(r.obstacles), frozen, 'nothing moves after the crash');
});

test('a jumped obstacle is cleared', () => {
  const r = run();
  r.obstacles.push({ x: r.runner.x + 120, w: 20, h: 40 });
  Runner.step(r, 16, true);
  advance(r, 700, false);
  assert.equal(r.alive, true);
  assert.equal(r.obstacles.length, 1);
  assert.ok(r.obstacles[0].x + r.obstacles[0].w < r.runner.x, 'obstacle is behind the runner');
});

test('shouldJump fires only once an obstacle is within jumping distance', () => {
  const r = run();
  assert.equal(Runner.shouldJump(r), false, 'nothing ahead');
  r.obstacles.push({ x: r.runner.x + 600, w: 20, h: 40 });
  assert.equal(Runner.shouldJump(r), false, 'too far');
  r.obstacles[0].x = r.runner.x + 60;
  assert.equal(Runner.shouldJump(r), true, 'close enough');
});

test('the autopilot survives a long run and gets faster', () => {
  const r = run(3);
  const v0 = r.speed;
  let cleared = 0;
  let lastCount = 0;
  for (let t = 0; t < 120000; t += 16) {
    Runner.step(r, 16, Runner.shouldJump(r));
    assert.equal(r.alive, true, 'crashed at ' + t + ' ms');
    if (r.obstacles.length < lastCount) cleared++;
    lastCount = r.obstacles.length;
  }
  assert.ok(r.speed > v0, 'speed increases');
  assert.ok(r.distance > 0);
  assert.ok(cleared > 20, 'should have passed many obstacles, cleared ' + cleared);
});

test('the run gets properly fast: at least 0.7 px/ms within two minutes, a bar group about every second', () => {
  const r = run(5);
  let gaps = [];
  let lastSpawnDist = null;
  let lastCount = 0;
  for (let t = 0; t < 120000; t += 16) {
    Runner.step(r, 16, Runner.shouldJump(r));
    assert.equal(r.alive, true, 'crashed at ' + t + ' ms');
    if (r.obstacles.length > lastCount) {
      if (lastSpawnDist !== null) gaps.push((r.distance - lastSpawnDist) / r.speed);
      lastSpawnDist = r.distance;
    }
    lastCount = r.obstacles.length;
  }
  assert.ok(r.speed >= 0.7, 'speed after two minutes is ' + r.speed.toFixed(2));
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  assert.ok(avgGap < 1000, 'average time between bar groups is ' + Math.round(avgGap) + ' ms');
});
