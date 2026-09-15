'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Pong = require('../js/pong-core.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function match(seed) { return Pong.createMatch({ w: 1000, h: 400, rng: mulberry32(seed || 1) }); }
function run(m, ms, input) { for (let t = 0; t < ms; t += 16) Pong.step(m, 16, input || {}); }
const AI = {};

test('createMatch centres both paddles and the ball, with a serve pending', () => {
  const m = match();
  assert.equal(m.left.y, 200);
  assert.equal(m.right.y, 200);
  assert.deepEqual([m.ball.x, m.ball.y], [500, 200]);
  assert.ok(m.serveTimer > 0);
  assert.deepEqual(m.score, { left: 0, right: 0 });
});

test('the ball launches after the serve delay and moves horizontally', () => {
  const m = match();
  run(m, m.serveTimer + 50, { left: 0, right: 0 });
  assert.ok(Math.abs(m.ball.vx) > 0, 'ball has horizontal speed');
  assert.notEqual(m.ball.x, 500);
});

test('the ball bounces off the top wall', () => {
  const m = match();
  m.serveTimer = 0;
  m.ball.x = 500; m.ball.y = m.ball.r + 2; m.ball.vx = 0.3; m.ball.vy = -0.3;
  Pong.step(m, 16, { left: 0, right: 0 });
  assert.ok(m.ball.vy > 0, 'vertical speed flips');
  assert.ok(m.ball.y >= m.ball.r);
});

test('the ball bounces off a paddle, speeds up and counts the rally', () => {
  const m = match();
  m.serveTimer = 0;
  m.left.y = 200;
  m.ball.x = m.paddleW + m.ball.r + 2; m.ball.y = 200; m.ball.vx = -0.4; m.ball.vy = 0;
  const speed = Math.abs(m.ball.vx);
  Pong.step(m, 16, { left: 0, right: 0 });
  assert.ok(m.ball.vx > 0, 'ball turns around');
  assert.ok(Math.abs(m.ball.vx) > speed, 'ball gets faster');
  assert.equal(m.rally, 1);
});

test('hitting the paddle off-centre sends the ball at an angle', () => {
  const m = match();
  m.serveTimer = 0;
  m.left.y = 200;
  m.ball.x = m.paddleW + m.ball.r + 2; m.ball.y = 200 + m.paddleH * 0.4; m.ball.vx = -0.4; m.ball.vy = 0;
  Pong.step(m, 16, { left: 0, right: 0 });
  assert.ok(m.ball.vy > 0.05, 'ball deflects downwards from the lower half');
});

test('missing the left paddle scores for the right and re-serves from the centre', () => {
  const m = match();
  m.serveTimer = 0;
  m.left.y = 40;
  m.ball.x = 30; m.ball.y = 350; m.ball.vx = -0.5; m.ball.vy = 0;
  run(m, 200, { left: 0, right: 0 });
  assert.equal(m.score.right, 1);
  assert.equal(m.score.left, 0);
  assert.deepEqual([m.ball.x, m.ball.y], [500, 200]);
  assert.ok(m.serveTimer > 0);
});

test('a human paddle moves with the input and stops at the edge', () => {
  const m = match();
  run(m, 200, { left: -1, right: 1 });
  assert.ok(m.left.y < 200);
  assert.ok(m.right.y > 200);
  run(m, 5000, { left: -1, right: 1 });
  assert.equal(m.left.y, m.paddleH / 2);
  assert.equal(m.right.y, 400 - m.paddleH / 2);
});

test('an AI paddle moves toward the ball when the ball comes its way', () => {
  const m = match();
  m.serveTimer = 0;
  m.ball.x = 600; m.ball.y = 60; m.ball.vx = 0.4; m.ball.vy = 0;
  run(m, 300, AI);
  assert.ok(m.right.y < 200, 'right paddle climbs toward the ball');
});

test('two computers keep a match going: points fall and the ball stays in bounds', () => {
  const m = match(7);
  let steps = 0;
  for (let t = 0; t < 90000; t += 16) {
    Pong.step(m, 16, AI);
    steps++;
    assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.y), 'ball position stays finite');
    assert.ok(m.ball.y >= -m.ball.r && m.ball.y <= m.h + m.ball.r, 'ball stays inside vertically');
  }
  assert.ok(m.score.left + m.score.right >= 1, 'computers should not be perfect, score ' + JSON.stringify(m.score));
  assert.ok(m.rally >= 0 && steps > 0);
});
