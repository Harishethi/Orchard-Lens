'use strict';
/* Counting demo: a camera pans along a row, so fruit slides across the frame.
   Adding up detections frame by frame over-counts. Giving each fruit an ID and
   counting it once as it crosses a line gives the right answer, unless the
   tracker loses the ID while the fruit is hidden behind a leaf. */
(function () {
  const cv = $('#trackCanvas');
  if (!cv) return;

  const W = 960, H = 340;
  const LINE = W * 0.5;
  const SPEED = 150;      // px per second
  const SAMPLE = 1.6;     // seconds between "naive" frame samples
  const N = 30;
  const ctx = VF.setupCanvas(cv, W, H);
  const bg = VF.offscreen(W, H);

  const el = {
    play: $('#tkPlay'), restart: $('#tkRestart'), smart: $('#tkSmart'), drop: $('#tkDrop'),
    truth: $('#tkTruth'), naive: $('#tkNaive'), tracked: $('#tkTracked'), err: $('#tkErr'), status: $('#tkStatus'),
  };

  let items = [], running = false, raf = 0, last = 0, clock = 0, nextSample = SAMPLE, naive = 0, counted = 0, finished = false;

  /* static backdrop: foliage + bokeh */
  (function paintBackdrop() {
    const R = VF.U.rng(404);
    const g = bg.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a4658');
    g.addColorStop(1, '#14282a');
    bg.fillStyle = g;
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) VF.drawLeaf(bg, R() * W, R() * H, 40 + R() * 50, R() * 6.28, ['#1f4d33', '#27613c', '#1b3f2e', '#2a5a38'][i % 4]);
    bg.fillStyle = 'rgba(10,6,25,0.35)';
    bg.fillRect(0, 0, W, H);
  })();

  function init() {
    const R = VF.U.rng(Math.floor(Math.random() * 1e9));
    items = [];
    let x = W * 0.58;
    for (let i = 0; i < N; i++) {
      x += 30 + R() * 30;
      const it = { id: i + 1, x, y: 60 + R() * 220, r: 15 + R() * 8, ripe: VF.pickRipe(R), counted: false, missed: false, dropA: null, dropB: null };
      if (R() < 0.4) {
        it.dropA = LINE + 10 + R() * 100;           // hidden from here...
        it.dropB = it.dropA - (40 + R() * 80);      // ...until here
      }
      items.push(it);
    }
    clock = 0; nextSample = SAMPLE; naive = 0; counted = 0; finished = false;
    el.status.textContent = 'Press play to start the pass.';
    readouts();
    draw();
  }

  const visibleToDetector = (it) => !(el.drop.checked && it.dropA !== null && it.x < it.dropA && it.x > it.dropB);

  function update(dt) {
    clock += dt;
    items.forEach((it) => {
      const prev = it.x;
      it.x -= SPEED * dt;
      if (prev > LINE && it.x <= LINE && !it.counted && !it.missed) {
        if (el.smart.checked || visibleToDetector(it)) { it.counted = true; counted++; }
        else it.missed = true;
      }
    });
    if (clock >= nextSample) {
      nextSample += SAMPLE;
      naive += items.filter((it) => it.x > 0 && it.x < W && visibleToDetector(it)).length;
    }
    if (items.every((it) => it.x < -40)) {
      finished = true;
      running = false;
      el.play.textContent = 'Replay';
      el.status.textContent = 'Pass complete. Compare the three numbers.';
    }
    readouts();
  }

  function readouts() {
    el.truth.textContent = N;
    el.naive.textContent = naive;
    el.tracked.textContent = counted;
    if (!finished) { el.err.textContent = '—'; return; }
    const e = ((counted - N) / N) * 100;
    el.err.textContent = (e > 0 ? '+' : '') + e.toFixed(0) + '%';
  }

  function draw() {
    ctx.drawImage(bg.canvas, 0, 0, W, H);

    // count line
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = '#4de3e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LINE, 0);
    ctx.lineTo(LINE, H);
    ctx.stroke();
    ctx.restore();

    ctx.font = '600 11px "DM Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';

    items.forEach((it) => {
      if (it.x < -40 || it.x > W + 40) return;
      VF.drawFruit(ctx, it.x, it.y, it.r, it.ripe, 'apple');
      if (!visibleToDetector(it)) {
        // a leaf is in the way: the detector sees nothing
        VF.drawLeaf(ctx, it.x - it.r * 0.9, it.y + it.r * 0.4, it.r * 2.3, -0.5, '#27613c');
        return;
      }
      const st = VF.STAGES[VF.stageOf(it.ripe)];
      const bx = it.x - it.r - 2, by = it.y - it.r - 2, bs = it.r * 2 + 4;
      ctx.strokeStyle = it.counted ? '#ffffff' : st.color;
      ctx.lineWidth = it.counted ? 2.5 : 1.8;
      ctx.strokeRect(bx, by, bs, bs);
      const label = it.missed ? `#${it.id} missed` : it.counted ? `#${it.id} counted` : `#${it.id}`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = it.missed ? '#ff5c7a' : it.counted ? '#ffffff' : st.color;
      ctx.fillRect(bx, by - 15, tw, 14);
      ctx.fillStyle = '#1b0f26';
      ctx.fillText(label, bx + 4, by - 7.5);
    });
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function play() {
    if (finished) init();
    running = true;
    el.play.textContent = 'Pause';
    el.status.textContent = 'Counting. Fruit is counted when its centre crosses the dashed line.';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    el.play.textContent = 'Resume';
    el.status.textContent = 'Paused.';
  }

  el.play.addEventListener('click', () => (running ? pause() : play()));
  el.restart.addEventListener('click', () => {
    running = false;
    cancelAnimationFrame(raf);
    el.play.textContent = 'Play';
    init();
  });
  [el.smart, el.drop].forEach((c) =>
    c.addEventListener('change', () => {
      running = false;
      cancelAnimationFrame(raf);
      el.play.textContent = 'Play';
      init();
    })
  );

  init();
})();
