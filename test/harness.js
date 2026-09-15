'use strict';
// A small fake browser for the game host and its games. Time advances frame by frame.
const fs = require('node:fs');
const path = require('node:path');

function read(name) { return fs.readFileSync(path.join(__dirname, '../js', name), 'utf8'); }

function fakeEl(props) {
  const cls = new Set();
  const attrs = {};
  const handlers = {};
  const el = {
    hidden: false,
    textContent: '',
    rect: null,
    classList: {
      add: c => cls.add(c),
      remove: c => cls.delete(c),
      contains: c => cls.has(c),
      toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); }
    },
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: k => (k in attrs ? attrs[k] : null),
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
    blur: () => {},
    closest: () => null,
    getBoundingClientRect: () => (el.rect
      ? { left: el.rect.left, top: el.rect.top, right: el.rect.right, bottom: el.rect.bottom, width: el.rect.right - el.rect.left, height: el.rect.bottom - el.rect.top }
      : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    click: () => {
      const ev = { target: el, defaultPrevented: false, preventDefault() { ev.defaultPrevented = true; } };
      (handlers.click || []).forEach(fn => fn(ev));
      return ev;
    }
  };
  if (props && props.attrs) Object.keys(props.attrs).forEach(k => el.setAttribute(k, props.attrs[k]));
  return Object.assign(el, props || {}, { attrs: undefined });
}

// opts: { width, height, reduced, coarse, scripts: ['host.js', 'snake.js'], obstacles: [{id, rect}] }
function makeEnv(opts) {
  opts = opts || {};
  let now = 0;
  const listeners = {};
  const rafQueue = [];
  const timers = [];
  const ctxCalls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => { ctxCalls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };

  // Text blocks: brand top-left and a band across most of the width in the
  // lower half (a corridor stays open on the right so the snake reaches all food).
  const brand = fakeEl({ id: 'brand', rect: { left: 40, top: 40, right: 220, bottom: 90 } });
  const band = fakeEl({ id: 'band', rect: { left: 0, top: 500, right: 1000, bottom: 700 } });
  const obstacles = [brand, band];
  const tabs = ['snake', 'pong', 'runner', 'breakout'].map((name, i) => fakeEl({ id: 'tab-' + name, attrs: { 'data-game': name }, rect: { left: 900 + i * 70, top: 760, right: 960 + i * 70, bottom: 776 } }));

  const document = {
    hidden: false,
    readyState: 'loading',
    body: fakeEl(),
    fonts: { ready: Promise.resolve() },
    getElementById: id => (id === 'stage' ? canvas : null),
    querySelectorAll: sel => (sel === '[data-obstacle]' ? obstacles : sel === '[data-game]' ? tabs : []),
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
  };
  const window = {
    innerWidth: opts.width || 1200,
    innerHeight: opts.height || 800,
    devicePixelRatio: 1,
    SnakeCore: Object.assign({}, require('../js/snake-core.js')),
    matchMedia: q => ({ matches: q.indexOf('reduced-motion') !== -1 ? !!opts.reduced : q.indexOf('coarse') !== -1 ? !!opts.coarse : false }),
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
  };
  ['pong-core.js', 'runner-core.js'].forEach(f => {
    if (fs.existsSync(path.join(__dirname, '../js', f))) {
      const key = f === 'pong-core.js' ? 'PongCore' : 'RunnerCore';
      window[key] = Object.assign({}, require('../js/' + f));
    }
  });
  const performance = { now: () => now };
  const requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
  const setTimeout = (fn, ms) => { const t = { fn, at: now + ms, done: false }; timers.push(t); return t; };
  const clearTimeout = t => { if (t) t.done = true; };

  const defaults = ['host.js', 'snake.js', 'pong.js', 'runner.js'].filter(f => fs.existsSync(path.join(__dirname, '../js', f)));
  (opts.scripts || defaults).forEach(name => {
    new Function('window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', read(name))(
      window, document, performance, requestAnimationFrame, setTimeout, clearTimeout
    );
  });
  const env = {
    window, document, brand, band, tabs, ctxCalls,
    core: window.SnakeCore,
    host: window.GameHost,
    tab: name => tabs.find(t => t.getAttribute('data-game') === name),
    debug: () => window.GameHost.debug(),
    fire: (type, ev) => (listeners[type] || []).forEach(fn => fn(ev)),
    advance(ms) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + 16);
        rafQueue.splice(0).forEach(fn => fn(now));
        timers.forEach(t => { if (!t.done && t.at <= now) { t.done = true; t.fn(); } });
      }
    },
    start() { document.readyState = 'complete'; env.fire('DOMContentLoaded'); }
  };
  if (opts.autostart !== false) env.start();
  return env;
}

function key(k) { const ev = { key: k, target: null, defaultPrevented: false, preventDefault() { ev.defaultPrevented = true; } }; return ev; }

// Press a key, then advance until the snake has taken exactly one step (or 400 ms pass).
function stepOnce(env, k) {
  const before = JSON.stringify(env.debug().head);
  env.fire('keydown', key(k));
  for (let i = 0; i < 25; i++) {
    env.advance(16);
    if (JSON.stringify(env.debug().head) !== before) return;
  }
}

module.exports = { makeEnv, fakeEl, key, stepOnce };
