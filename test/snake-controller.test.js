'use strict';
// Snake running inside the host, driven frame by frame in the fake browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv, key, stepOnce } = require('./harness');

// Walk the player's snake to a column, avoiding a direct reversal.
function goToColumn(env, col) {
  for (let i = 0; i < 80; i++) {
    const h = env.debug().head;
    if (h.x === col) return;
    stepOnce(env, h.x < col ? 'ArrowRight' : 'ArrowLeft');
    if (env.debug().head.x === h.x) stepOnce(env, 'ArrowDown');
  }
}

function crash(env) {
  for (let i = 0; i < 60 && env.debug().phase === 'live'; i++) stepOnce(env, 'ArrowUp');
}

test('snake is the first game and the autopilot moves on animation frames', () => {
  const env = makeEnv();
  assert.equal(env.debug().game, 'snake');
  assert.equal(env.debug().moved, false);
  env.advance(3000);
  const d = env.debug();
  assert.equal(d.mode, 'auto');
  assert.equal(d.moved, true);
  assert.ok(d.length >= 4);
});

test('arrow key takes over into player mode and the key is consumed', () => {
  const env = makeEnv();
  env.advance(500);
  const ev = key('ArrowUp');
  env.fire('keydown', ev);
  env.advance(200);
  assert.equal(env.debug().mode, 'player');
  assert.ok(ev.defaultPrevented, 'arrow keys must not scroll the page');
});

test('after a player crash the snake fades out and respawns in autopilot', () => {
  const env = makeEnv();
  env.advance(500);
  crash(env);
  assert.equal(env.debug().phase, 'dying');
  env.advance(2000);
  const d = env.debug();
  assert.equal(d.mode, 'auto');
  assert.equal(d.phase, 'live');
  assert.equal(env.band.classList.contains('is-dimmed'), false);
  assert.equal(env.brand.classList.contains('is-dimmed'), false);
});

test('a text block dims only while the player drives the snake behind it', () => {
  const env = makeEnv();
  env.advance(500);
  assert.equal(env.band.classList.contains('is-dimmed'), false, 'autopilot never dims');
  // Band covers columns 0..45 and rows 22..31 (22px cells). Get to column 20, then cross it vertically.
  stepOnce(env, 'ArrowDown');
  goToColumn(env, 20);
  const head = env.debug().head;
  const vertical = head.y < 22 ? 'ArrowDown' : 'ArrowUp';
  let inside = false;
  for (let i = 0; i < 40 && !inside; i++) {
    stepOnce(env, vertical);
    const h = env.debug().head;
    inside = h.y >= 23 && h.y <= 30;
  }
  assert.ok(inside, 'snake should have reached the band');
  assert.ok(env.band.classList.contains('is-dimmed'), 'band dims while the snake is behind it');
  assert.equal(env.brand.classList.contains('is-dimmed'), false, 'untouched block stays opaque');
});

test('reduced motion shows a still winding and never animates', () => {
  const env = makeEnv({ reduced: true });
  const before = env.debug();
  assert.ok(before.length > 4, 'pre-wound snake should have eaten');
  env.advance(3000);
  const after = env.debug();
  assert.equal(after.moved, false);
  assert.equal(after.length, before.length);
});

test('a hidden tab pauses the game and a visible tab resumes it', () => {
  const env = makeEnv();
  env.advance(1000);
  const len = env.debug().length;
  env.document.hidden = true;
  env.fire('visibilitychange');
  env.advance(3000);
  assert.equal(env.debug().length, len, 'nothing should happen while hidden');
  env.document.hidden = false;
  env.fire('visibilitychange');
  env.advance(1000);
  assert.equal(env.debug().phase, 'live');
});
