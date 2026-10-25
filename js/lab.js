'use strict';
/* Detector lab: generate an orchard frame, run the simulated detector, and
   see precision / recall change as you move the confidence threshold. */
(function () {
  const cv = $('#labCanvas');
  if (!cv) return;

  const W = 960, H = 600;
  const ctx = VF.setupCanvas(cv, W, H);
  const base = VF.offscreen(W, H);
  const frame = $('#labFrame');
  const tip = $('#labTip');

  const S = {
    fruit: 'apple', light: 'sun', count: 42, occ: 35, thr: 0.5,
    labels: true, misses: false, seed: 11,
    scene: null, dets: [], detMap: new Map(),
    scanX: Infinity, scanning: false, hover: null, raf: 0, pending: false,
  };

  const el = {
    gt: $('#labGT'), det: $('#labDet'), prec: $('#labPrec'), rec: $('#labRec'), f1: $('#labF1'), err: $('#labErr'),
    tp: $('#labTP'), fp: $('#labFP'), fn: $('#labFN'),
    bars: $('#labBars'),
    count: $('#labCount'), countO: $('#labCountO'), occ: $('#labOcc'), occO: $('#labOccO'), thr: $('#labThr'), thrO: $('#labThrO'),
  };

  /* ----- maturity bars (built once) ----- */
  const barRows = VF.STAGES.map((st) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<span class="bar-name">${st.name}</span><span class="bar-track"><span class="bar-fill" style="background:${st.color}"></span></span><span class="bar-val">0</span>`;
    el.bars.appendChild(row);
    return { fill: $('.bar-fill', row), val: $('.bar-val', row) };
  });

  /* ----- scene + detections ----- */
  function rebuild() {
    S.scene = VF.makeScene({ w: W, h: H, fruit: S.fruit, count: S.count, occlusion: S.occ, seed: S.seed, light: S.light });
    S.dets = VF.simulateDetections(S.scene);
    S.detMap = new Map(S.dets.filter((d) => !d.fp).map((d) => [d.id, d]));
    VF.renderScene(base, S.scene);
    S.hover = null;
    hideTip();
    draw();
    readouts();
  }

  function draw() {
    ctx.drawImage(base.canvas, 0, 0, W, H);
    if (S.misses && !S.scanning) VF.drawMisses(ctx, S.scene, S.thr, S.detMap);
    VF.drawBoxes(ctx, S.dets, { thr: S.thr, scanX: S.scanX, labels: S.labels, hoverId: S.hover, W });
    if (S.scanning) VF.drawScanLine(ctx, S.scanX, H);
  }

  const pct = (v) => Math.round(v * 100) + '%';

  function readouts() {
    const m = VF.evaluate(S.scene, S.dets, S.thr);
    el.gt.textContent = m.gt;
    el.det.textContent = m.shown;
    el.prec.textContent = pct(m.precision);
    el.rec.textContent = pct(m.recall);
    el.f1.textContent = m.f1.toFixed(2);
    const e = m.countErr * 100;
    el.err.textContent = (e > 0 ? '+' : '') + e.toFixed(0) + '%';
    el.tp.textContent = m.tp;
    el.fp.textContent = m.fp;
    el.fn.textContent = m.fn;
    const max = Math.max(1, ...m.byStage);
    m.byStage.forEach((n, i) => {
      barRows[i].fill.style.width = (n / max) * 100 + '%';
      barRows[i].val.textContent = n;
    });
  }

  function scheduleRebuild() {
    if (S.pending) return;
    S.pending = true;
    requestAnimationFrame(() => { S.pending = false; S.scanX = Infinity; S.scanning = false; rebuild(); });
  }

  /* ----- scan animation ----- */
  function runScan() {
    cancelAnimationFrame(S.raf);
    if (VF.prefersReduced) { S.scanning = false; S.scanX = Infinity; draw(); return; }
    S.scanning = true;
    S.scanX = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      S.scanX += dt * 380;
      if (S.scanX >= W + 60) { S.scanning = false; S.scanX = Infinity; draw(); return; }
      draw();
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }

  /* ----- hover inspector ----- */
  function hideTip() { tip.hidden = true; }
  function hit(x, y) {
    let best = null;
    for (const d of S.dets) {
      if (d.conf < S.thr) continue;
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) {
        if (!best || d.w * d.h < best.w * best.h) best = d;
      }
    }
    return best;
  }
  cv.addEventListener('pointermove', (e) => {
    if (S.scanning) return;
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) * W) / r.width;
    const y = ((e.clientY - r.top) * H) / r.height;
    const d = hit(x, y);
    const id = d ? d.id : null;
    if (id !== S.hover) { S.hover = id; draw(); }
    if (!d) { hideTip(); return; }
    const st = VF.STAGES[d.stage];
    tip.innerHTML = d.fp
      ? `<strong>False alarm</strong><span>The detector fired on a leaf or glint. Confidence ${d.conf.toFixed(2)}. Raise the threshold to remove it.</span>`
      : `<strong>${st.name} ${VF.FRUITS[S.fruit].name.toLowerCase()}</strong><span>Confidence ${d.conf.toFixed(2)}, estimated diameter ${Math.round(d.mm)} mm</span>`;
    tip.hidden = false;
    const f = frame.getBoundingClientRect();
    let left = e.clientX - f.left + 16;
    if (left > f.width - 230) left = e.clientX - f.left - 236;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, e.clientY - f.top + 16) + 'px';
  });
  cv.addEventListener('pointerleave', () => { S.hover = null; hideTip(); if (!S.scanning) draw(); });

  /* ----- controls ----- */
  $$('input[name="labFruit"]').forEach((i) => i.addEventListener('change', () => { S.fruit = i.value; scheduleRebuild(); }));
  $$('input[name="labLight"]').forEach((i) => i.addEventListener('change', () => { S.light = i.value; scheduleRebuild(); }));

  el.count.addEventListener('input', () => { S.count = +el.count.value; el.countO.textContent = S.count; scheduleRebuild(); });
  el.occ.addEventListener('input', () => { S.occ = +el.occ.value; el.occO.textContent = S.occ + '%'; scheduleRebuild(); });
  el.thr.addEventListener('input', () => {
    S.thr = +el.thr.value / 100;
    el.thrO.textContent = S.thr.toFixed(2);
    if (!S.scanning) draw();
    readouts();
  });

  $('#labLabels').addEventListener('change', (e) => { S.labels = e.target.checked; if (!S.scanning) draw(); });
  $('#labMisses').addEventListener('change', (e) => { S.misses = e.target.checked; if (!S.scanning) draw(); });

  $('#labRun').addEventListener('click', () => { runScan(); });
  $('#labNew').addEventListener('click', () => {
    S.seed = Math.floor(Math.random() * 100000) + 1;
    S.scanX = Infinity;
    S.scanning = false;
    cancelAnimationFrame(S.raf);
    rebuild();
    runScan();
  });

  rebuild();
})();
