'use strict';
// Pong inside the host: switching, computer play, taking over a paddle.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv, key } = require('./harness');

function pong() {
  const env = makeEnv();
  env.tab('pong').click();
  env.advance(900);
  assert.equal(env.debug().game, 'pong');
  return env;
}

test('pong plays computer against computer inside the free band', () => {
  const env = pong();
  const d0 = env.debug();
  assert.equal(d0.court.top, d0.band.top);
  assert.equal(d0.court.bottom, d0.band.bottom);
  assert.equal(d0.left.human, false);
  assert.equal(d0.right.human, false);
  env.advance(3000);
  const d1 = env.debug();
  assert.notDeepEqual([d1.ball.x, d1.ball.y], [d0.ball.x, d0.ball.y], 'ball is in play');
  assert.ok(d1.ball.x >= 0 && d1.ball.x <= d1.court.right - d1.court.left + 20);
});

test('arrow keys take the right paddle, W and S the left, and the keys are consumed', () => {
  const env = pong();
  const y0 = env.debug().right.y;
  const up = key('ArrowUp');
  env.fire('keydown', up);
  env.advance(300);
  assert.ok(up.defaultPrevented);
  assert.equal(env.debug().right.human, true);
  assert.equal(env.debug().left.human, false);
  assert.ok(env.debug().right.y < y0, 'right paddle moved up while held');
  env.fire('keyup', key('ArrowUp'));
  const y1 = env.debug().right.y;
  env.advance(300);
  assert.equal(env.debug().right.y, y1, 'released key stops the paddle');

  const l0 = env.debug().left.y;
  env.fire('keydown', key('s'));
  env.advance(300);
  assert.equal(env.debug().left.human, true);
  assert.ok(env.debug().left.y > l0, 'left paddle moved down');
  env.fire('keyup', key('s'));
});

test('a paddle goes back to the computer after six idle seconds', () => {
  const env = pong();
  env.fire('keydown', key('ArrowDown'));
  env.fire('keyup', key('ArrowDown'));
  env.advance(1000);
  assert.equal(env.debug().right.human, true);
  env.advance(6000);
  assert.equal(env.debug().right.human, false);
});

test('dragging on the left half moves the left paddle to the finger', () => {
  const env = pong();
  const d = env.debug();
  const targetY = d.court.top + 40;
  env.fire('touchstart', { target: null, changedTouches: [{ clientX: 100, clientY: targetY }] });
  env.fire('touchmove', { target: null, changedTouches: [{ clientX: 100, clientY: targetY }] });
  env.advance(50);
  assert.equal(env.debug().left.human, true);
  assert.ok(Math.abs(env.debug().left.y - 40) <= d.paddleH / 2 + 1, 'paddle centred near the finger, clamped to the court');
  assert.equal(env.debug().right.human, false);
});

test('with reduced motion pong shows a rally in progress', () => {
  const env = makeEnv({ reduced: true });
  env.tab('pong').click();
  const d = env.debug();
  assert.equal(d.game, 'pong');
  assert.ok(Math.abs(d.ball.vx) > 0, 'ball is mid-flight in the still frame');
});
