'use strict';
// Runner inside the host: autopilot, taking over with a jump, crash and restart.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv, key } = require('./harness');

function runner() {
  const env = makeEnv();
  env.tab('runner').click();
  env.advance(900);
  assert.equal(env.debug().game, 'runner');
  return env;
}

test('runner runs on the floor of the free band, on autopilot', () => {
  const env = runner();
  const d0 = env.debug();
  assert.equal(d0.groundY, d0.band.bottom);
  assert.equal(d0.human, false);
  env.advance(8000);
  const d1 = env.debug();
  assert.ok(d1.distance > d0.distance);
  assert.equal(d1.alive, true);
  assert.equal(d1.human, false, 'autopilot stays in charge without input');
});

test('space takes over and jumps, and the key is consumed', () => {
  const env = runner();
  const ev = key(' ');
  env.fire('keydown', ev);
  env.advance(32);
  assert.ok(ev.defaultPrevented);
  assert.equal(env.debug().human, true);
  assert.ok(env.debug().vy < 0, 'runner is going up');
});

test('arrow up and a tap also jump', () => {
  const env = runner();
  env.fire('keydown', key('ArrowUp'));
  env.advance(32);
  assert.ok(env.debug().vy < 0);
  env.advance(1500);
  env.fire('touchstart', { target: null, changedTouches: [{ clientX: 300, clientY: 300 }] });
  env.advance(32);
  assert.ok(env.debug().vy < 0, 'tap jumps');
});

test('a held key does not bounce forever', () => {
  const env = runner();
  const ev = key(' ');
  ev.repeat = true;
  env.fire('keydown', ev);
  env.advance(32);
  assert.equal(env.debug().vy, 0, 'auto-repeat is ignored');
});

test('after a human crash the run fades out and restarts on autopilot', () => {
  const env = runner();
  env.fire('keydown', key(' '));
  env.advance(700);
  assert.equal(env.debug().human, true);
  // Never jump again: the next bar ends the run.
  let crashed = false;
  for (let i = 0; i < 400 && !crashed; i++) { env.advance(50); crashed = env.debug().phase !== 'live'; }
  assert.ok(crashed, 'should have hit a bar');
  env.advance(2000);
  const d = env.debug();
  assert.equal(d.phase, 'live');
  assert.equal(d.alive, true);
  assert.equal(d.human, false);
});

test('with reduced motion the still frame already shows a bar on screen', () => {
  const env = makeEnv({ reduced: true, width: 1600, height: 900 });
  env.tab('runner').click();
  const d = env.debug();
  assert.equal(d.game, 'runner');
  assert.ok(d.firstBarX !== null && d.firstBarX < 1600 * 0.85, 'a bar should be well inside the view, first at ' + d.firstBarX);
});
