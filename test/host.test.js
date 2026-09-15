'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv } = require('./harness');

function dummyGame(log) {
  return function () {
    return {
      enter: () => log.push('enter'),
      layout: () => log.push('layout'),
      frame: () => log.push('frame'),
      draw: (ctx, alpha) => log.push('draw@' + alpha.toFixed(1)),
      exit: () => log.push('exit'),
      debug: () => ({ dummy: true })
    };
  };
}

// A one-finger touch event as the browser would deliver it.
function swipe(props) {
  const ev = Object.assign({
    target: null, cancelable: true, touches: [{}],
    changedTouches: [{ clientX: 300, clientY: 300 }],
    defaultPrevented: false, preventDefault() { ev.defaultPrevented = true; }
  }, props);
  return ev;
}

test('the play band sits between the top and bottom text blocks', () => {
  const env = makeEnv();
  const b = env.debug().band;
  assert.equal(b.top, 90 + 28);
  assert.equal(b.bottom, 500 - 28);
});

test('clicking a tab crossfades to that game and marks the tab active', () => {
  const env = makeEnv({ autostart: false });
  const log = [];
  env.host.register('pong', dummyGame(log));
  env.start();
  assert.equal(env.debug().game, 'snake');
  env.tab('pong').click();
  env.advance(100);
  assert.equal(env.debug().game, 'snake', 'old game keeps running while fading out');
  assert.ok(env.debug().alpha < 1);
  env.advance(800);
  assert.equal(env.debug().game, 'pong');
  assert.equal(env.debug().alpha, 1);
  assert.equal(log[0], 'enter');
  assert.ok(log.includes('frame') && log.some(l => l.startsWith('draw@')));
  assert.ok(env.tab('pong').classList.contains('is-active'));
  assert.equal(env.tab('snake').classList.contains('is-active'), false);
  assert.equal(env.tab('pong').getAttribute('aria-pressed'), 'true');
});

test('switching away calls exit on the old game', () => {
  const env = makeEnv({ autostart: false });
  const log = [];
  env.host.register('pong', dummyGame(log));
  env.start();
  env.tab('pong').click();
  env.advance(900);
  env.tab('snake').click();
  env.advance(900);
  assert.equal(env.debug().game, 'snake');
  assert.ok(log.includes('exit'));
});

test('an unregistered tab does nothing', () => {
  const env = makeEnv();
  env.tab('breakout').click();
  env.advance(900);
  assert.equal(env.debug().game, 'snake');
});

test('with reduced motion a switch draws the new game once, without a loop', () => {
  const env = makeEnv({ autostart: false, reduced: true });
  const log = [];
  env.host.register('pong', dummyGame(log));
  env.start();
  env.tab('pong').click();
  assert.equal(env.debug().game, 'pong');
  env.advance(2000);
  assert.equal(log.filter(l => l.startsWith('draw@')).length, 1);
  assert.equal(log.includes('frame'), false);
});

test('when the switcher is hidden (narrow screens) the host falls back to the first game', () => {
  const env = makeEnv();
  env.tab('pong').click();
  env.advance(900);
  assert.equal(env.debug().game, 'pong');
  env.tabs.forEach(t => { t.rect = null; });   // display: none
  env.fire('resize');
  env.advance(1200);
  assert.equal(env.debug().game, 'snake');
});

test('a swipe on the play area is kept from scrolling the page', () => {
  const env = makeEnv();
  env.fire('touchstart', swipe());
  const move = swipe({ changedTouches: [{ clientX: 300, clientY: 360 }] });
  env.fire('touchmove', move);
  assert.equal(move.defaultPrevented, true);
  const opts = env.listenerOpts.touchmove;
  assert.ok(opts.length && opts.every(o => o && o.passive === false), 'a passive touchmove listener cannot cancel the scroll');
});

test('swipes on controls, with two fingers, or without a touch-aware game are left to the browser', () => {
  const env = makeEnv({ autostart: false });
  env.host.register('pong', dummyGame([]));
  env.start();
  const onLink = swipe({ target: { closest: () => ({}) } });
  env.fire('touchmove', onLink);
  assert.equal(onLink.defaultPrevented, false, 'a link or button keeps its own gesture');
  const pinch = swipe({ touches: [{}, {}] });
  env.fire('touchmove', pinch);
  assert.equal(pinch.defaultPrevented, false, 'pinch zoom stays possible');
  env.tab('pong').click();
  env.advance(900);
  const noTouch = swipe();
  env.fire('touchmove', noTouch);
  assert.equal(noTouch.defaultPrevented, false, 'a game without touch input does not block');
});
