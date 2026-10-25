'use strict';
/* Hero: a new orchard frame is generated, a scan line sweeps across it and
   the "detector" draws a box around every fruit it finds. */
(function () {
  const cv = $('#heroCanvas');
  if (!cv) return;

  const W = 880, H = 660;
  const ctx = VF.setupCanvas(cv, W, H);
  const base = VF.offscreen(W, H);
  const THR = 0.45;
  const SWEEP = 3.4;   // seconds for the scan line to cross the frame
  const HOLD = 5.5;    // seconds to hold the finished frame
  const order = ['apple', 'tomato', 'orange', 'apple'];

  const el = {
    found: $('#heroFound'),
    ripe: $('#heroRipe'),
    turning: $('#heroTurning'),
    hud: $('#heroHud'),
  };

  let scene, dets, round = 0, t0 = 0, raf = 0, visible = true, lastShown = '';

  function newFrame() {
    const fruit = order[round % order.length];
    scene = VF.makeScene({ w: W, h: H, fruit, count: 16 + (round % 3) * 3, scale: 1.55, occlusion: 30, seed: 101 + round * 17, light: 'sun' });
    dets = VF.simulateDetections(scene);
    VF.renderScene(base, scene);
    el.hud.textContent = `${VF.FRUITS[fruit].name.toLowerCase()}, confidence of ${THR.toFixed(2)} or higher`;
    t0 = performance.now();
    round++;
  }

  function counts(scanX) {
    const c = { found: 0, ripe: 0, turning: 0 };
    dets.forEach((d) => {
      if (d.conf < THR || d.x + d.w / 2 > scanX) return;
      c.found++;
      if (d.stage === 2) c.ripe++;
      if (d.stage === 1) c.turning++;
    });
    return c;
  }

  function paint(scanX) {
    ctx.drawImage(base.canvas, 0, 0, W, H);
    VF.drawBoxes(ctx, dets, { thr: THR, scanX, labels: true, W });
    if (scanX < W + 10) VF.drawScanLine(ctx, scanX, H);
    const c = counts(scanX);
    const key = c.found + '-' + c.ripe + '-' + c.turning;
    if (key !== lastShown) {
      lastShown = key;
      el.found.textContent = c.found;
      el.ripe.textContent = c.ripe;
      el.turning.textContent = c.turning;
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    if (t > SWEEP + HOLD) { newFrame(); return; }
    const p = Math.min(1, t / SWEEP);
    paint(p < 1 ? p * (W + 60) : Infinity);
  }

  newFrame();
  if (VF.prefersReduced) {
    paint(Infinity);
    return;
  }
  raf = requestAnimationFrame(frame);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.05 }).observe(cv);
  }
})();
