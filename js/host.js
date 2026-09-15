/*
 * Game host: owns the canvas, the frame loop, the free play area, the
 * switcher tabs and input routing. Games register with GameHost.register().
 *
 * A game factory receives the env and returns an instance with:
 *   enter(env), layout(env), frame(now), draw(ctx, alpha, now)
 * and optionally still(env), key(e) -> handled, keyup(e), touch(type, x, y), exit(), debug().
 */
(function () {
  'use strict';
  var canvas = document.getElementById('stage');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var FADE_MS = 350;   // crossfade between games
  var BAND_GAP = 28;   // px between text and the play band

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var factories = {};
  var order = [];
  var active = null;
  var activeName = null;
  var env = { W: 0, H: 0, dpr: 1, pad: 20, blocks: [], band: { top: 0, bottom: 0 }, reduced: reduced, coarse: coarse };
  var fade = null;      // { from, to, start, then }
  var alpha = 1;
  var paused = false;
  var started = false;
  var tabs = [];

  function register(name, factory) {
    if (!factories[name]) order.push(name);
    factories[name] = factory;
  }

  // Measure the viewport, the text blocks and the free horizontal band between them.
  function measure() {
    env.W = window.innerWidth;
    env.H = window.innerHeight;
    env.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(env.W * env.dpr);
    canvas.height = Math.round(env.H * env.dpr);
    ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    env.pad = Math.max(20, Math.min(56, env.W * 0.036));

    env.blocks = [];
    var topLimit = 0;
    var bottomLimit = env.H;
    var els = document.querySelectorAll('[data-obstacle]');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      env.blocks.push({ el: els[i], left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      if ((r.top + r.bottom) / 2 < env.H / 2) topLimit = Math.max(topLimit, r.bottom);
      else bottomLimit = Math.min(bottomLimit, r.top);
    }
    env.band = { top: topLimit + BAND_GAP, bottom: bottomLimit - BAND_GAP };
    if (env.band.bottom - env.band.top < 120) env.band = { top: env.pad, bottom: env.H - env.pad };
  }

  function clear() { ctx.clearRect(0, 0, env.W, env.H); }

  function setTabs(name) {
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-game') === name;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function activate(name) {
    if (active && active.exit) active.exit();
    activeName = name;
    active = factories[name](env);
    active.enter(env);
    setTabs(name);
  }

  function drawStill() {
    clear();
    if (!active) return;
    if (active.still) active.still(env);
    active.draw(ctx, 1, 0);
  }

  function switchTo(name) {
    if (!factories[name] || name === activeName) return;
    if (reduced) {
      activate(name);
      drawStill();
      return;
    }
    fade = {
      from: alpha, to: 0, start: performance.now(),
      then: function () {
        activate(name);
        fade = { from: 0, to: 1, start: performance.now(), then: null };
      }
    };
  }

  function frame(now) {
    if (paused) return;
    if (fade) {
      var k = Math.min(1, (now - fade.start) / FADE_MS);
      alpha = fade.from + (fade.to - fade.from) * k;
      if (k >= 1) {
        var then = fade.then;
        fade = null;
        if (then) then();
      }
    }
    clear();
    if (active && alpha > 0) {
      active.frame(now);
      active.draw(ctx, alpha, now);
    }
    requestAnimationFrame(frame);
  }

  // The switcher is hidden on narrow screens; without it only the first game makes sense.
  function switcherVisible() {
    for (var i = 0; i < tabs.length; i++) {
      var r = tabs[i].getBoundingClientRect();
      if (r.width && r.height) return true;
    }
    return false;
  }

  function layout() {
    measure();
    if (active && active.layout) active.layout(env);
    if (reduced) drawStill();
    if (started && !switcherVisible() && activeName !== order[0]) switchTo(order[0]);
  }

  // ---- input routing ------------------------------------------------------

  function onControl(target) {
    return !!(target && target.closest && target.closest('a, button, input, textarea'));
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!active || !active.key) return;
    if (active.key(e)) e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (active && active.keyup) active.keyup(e);
  });

  function touchHandler(type) {
    return function (e) {
      if (!active || !active.touch || onControl(e.target)) return;
      var t = e.changedTouches[0];
      active.touch(type, t.clientX, t.clientY);
    };
  }
  document.addEventListener('touchstart', touchHandler('start'), { passive: true });
  document.addEventListener('touchmove', touchHandler('move'), { passive: true });
  document.addEventListener('touchend', touchHandler('end'), { passive: true });

  // ---- lifecycle ----------------------------------------------------------

  var relayoutTimer = null;
  function relayout() {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(layout, 120);
  }
  window.addEventListener('resize', relayout);
  window.addEventListener('scroll', relayout, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (reduced) return;
    if (document.hidden) {
      paused = true;
    } else if (paused) {
      paused = false;
      requestAnimationFrame(frame);
    }
  });

  function start() {
    if (started || !order.length) return;
    started = true;
    measure();
    tabs = document.querySelectorAll('[data-game]');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          switchTo(tab.getAttribute('data-game'));
          if (tab.blur) tab.blur();
        });
      })(tabs[i]);
    }
    activate(order[0]);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if (reduced) drawStill();
    else requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);

  window.GameHost = {
    register: register,
    switchTo: switchTo,
    start: start,
    current: function () { return activeName; },
    debug: function () {
      var d = active && active.debug ? active.debug() : {};
      d.game = activeName;
      d.alpha = alpha;
      d.band = { top: env.band.top, bottom: env.band.bottom };
      return d;
    }
  };
})();
