/*
 * Runner for the game host. A dot runs along the floor of the free band and
 * jumps over bars. Space, arrow up or a tap take over; after a crash the run
 * fades out and the autopilot starts again.
 */
(function () {
  'use strict';
  var Core = window.RunnerCore;
  var Host = window.GameHost;
  if (!Core || !Host) return;

  var FADE_OUT_MS = 700;
  var FADE_IN_MS = 500;
  var BAR_W = 10;
  var BAR_GAP = 6;
  var COLOR = {
    auto: 'rgba(150, 112, 240, 0.45)',
    human: 'rgba(172, 138, 252, 0.85)',
    ground: 'rgba(150, 112, 240, 0.28)',
    runner: '#ee3d86'
  };
  var JUMP_KEYS = { ' ': 1, Spacebar: 1, ArrowUp: 1, w: 1, W: 1 };

  Host.register('runner', function () {
    var run = null;
    var envRef = null;
    var last = 0;
    var human = false;
    var jumpQueued = false;
    var phase = 'live';     // 'live' | 'dying' | 'spawning'
    var phaseStart = 0;
    var innerAlpha = 1;

    function newRun() {
      run = Core.createRun({ w: envRef.W, groundY: envRef.band.bottom });
    }

    function layout(env) {
      envRef = env;
      if (!run) {
        newRun();
      } else {
        var lift = run.groundY - run.runner.y;
        run.w = env.W;
        run.groundY = env.band.bottom;
        run.runner.x = env.W * 0.18;
        run.runner.y = run.groundY - lift;
      }
    }

    function restart() {
      human = false;
      jumpQueued = false;
      newRun();
    }

    function frame(now) {
      var dt = last ? Math.min(50, now - last) : 16;
      last = now;
      if (phase === 'live') {
        var jump = human ? jumpQueued : Core.shouldJump(run);
        jumpQueued = false;
        Core.step(run, dt, jump);
        innerAlpha = 1;
        if (!run.alive) {
          phase = 'dying';
          phaseStart = now;
        }
      } else if (phase === 'dying') {
        var k = (now - phaseStart) / FADE_OUT_MS;
        if (k >= 1) {
          restart();
          phase = 'spawning';
          phaseStart = now;
          innerAlpha = 0;
        } else {
          innerAlpha = 1 - k;
        }
      } else {
        var j = (now - phaseStart) / FADE_IN_MS;
        if (j >= 1) {
          phase = 'live';
          innerAlpha = 1;
        } else {
          innerAlpha = j;
        }
      }
    }

    function draw(ctx, hostAlpha, now) {
      var alpha = hostAlpha * innerAlpha;
      if (!run || alpha <= 0) return;
      var g = run.groundY;
      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = COLOR.ground;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(envRef.pad, g + 0.5);
      ctx.lineTo(run.w - envRef.pad, g + 0.5);
      ctx.stroke();

      ctx.strokeStyle = human ? COLOR.human : COLOR.auto;
      ctx.lineWidth = BAR_W;
      ctx.lineCap = 'round';
      for (var i = 0; i < run.obstacles.length; i++) {
        var o = run.obstacles[i];
        var bars = Math.round((o.w + BAR_GAP) / (BAR_W + BAR_GAP));
        for (var b = 0; b < bars; b++) {
          var x = o.x + BAR_W / 2 + b * (BAR_W + BAR_GAP);
          ctx.beginPath();
          ctx.moveTo(x, g - BAR_W / 2);
          ctx.lineTo(x, g - o.h + BAR_W / 2);
          ctx.stroke();
        }
      }

      var pulse = 0.9 + 0.1 * Math.sin(now / 420);
      ctx.shadowColor = COLOR.runner;
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = COLOR.runner;
      ctx.beginPath();
      ctx.arc(run.runner.x, run.runner.y, run.runner.r * 0.8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function takeOver() {
      if (phase !== 'live') return;
      human = true;
      jumpQueued = true;
    }

    return {
      enter: function (env) {
        layout(env);
        last = 0;
      },
      layout: layout,
      frame: frame,
      draw: draw,
      still: function () {
        // Long enough for bars to be on screen on wide displays.
        for (var t = 0; t < 6000; t += 16) Core.step(run, 16, Core.shouldJump(run));
      },
      key: function (e) {
        if (!JUMP_KEYS[e.key]) return false;
        if (!e.repeat) takeOver();
        return true;
      },
      touch: function (type) {
        if (type === 'start') takeOver();
      },
      debug: function () {
        return {
          alive: run ? run.alive : false, human: human, phase: phase,
          distance: run ? run.distance : 0, vy: run ? run.runner.vy : 0,
          groundY: run ? run.groundY : 0, obstacles: run ? run.obstacles.length : 0,
          firstBarX: run && run.obstacles.length ? run.obstacles[0].x : null
        };
      }
    };
  });
})();
