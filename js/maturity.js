'use strict';
/* Maturity lab: drag a ripeness index and see the fruit colour, its real
   HSV values (computed from the drawn colour), the stage and a harvest call. */
(function () {
  const cv = $('#matCanvas');
  if (!cv) return;

  const W = 420, H = 420;
  const ctx = VF.setupCanvas(cv, W, H);
  const range = $('#matRange');
  const el = {
    val: $('#matVal'), stage: $('#matStage'), h: $('#matH'), s: $('#matS'), v: $('#matV'),
    plan: $('#matPlan'), note: $('#matNote'), marker: $('#matMarker'), track: $('#matTrack'), play: $('#matPlay'), swatch: $('#matSwatch'),
  };

  const S = { fruit: 'apple', ripe: 0.62, raf: 0, playing: false };

  function drawPlate() {
    ctx.clearRect(0, 0, W, H);
    // soft ground shadow
    const g = ctx.createRadialGradient(W / 2, H * 0.82, 4, W / 2, H * 0.82, 130);
    g.addColorStop(0, 'rgba(36,19,52,0.28)');
    g.addColorStop(1, 'rgba(36,19,52,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.82, 130, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    if (S.fruit !== 'orange') {
      VF.drawLeaf(ctx, W / 2 + 12, H * 0.2, 120, -0.55, '#2f7344');
    }
    VF.drawFruit(ctx, W / 2, H * 0.5, 128, S.ripe, S.fruit);
  }

  function plan(r, F) {
    if (r < 0.55) {
      const d = Math.max(1, Math.round(((0.55 - r) / 0.55) * F.horizon));
      return `About ${d} day${d === 1 ? '' : 's'} until the harvest window opens`;
    }
    if (r < 0.85) return 'Inside the harvest window';
    return 'Past peak: sell fast or send to processing';
  }

  function update() {
    const F = VF.FRUITS[S.fruit];
    const r = S.ripe;
    const si = VF.stageOf(r);
    const st = VF.STAGES[si];
    const col = VF.colorAt(S.fruit, r);
    const hsv = VF.U.rgbToHsv(col);

    el.val.textContent = r.toFixed(2);
    el.stage.textContent = st.name;
    el.stage.style.setProperty('--stage', st.color);
    el.h.textContent = Math.round(hsv[0]) + '°';
    el.s.textContent = Math.round(hsv[1]) + '%';
    el.v.textContent = Math.round(hsv[2]) + '%';
    el.plan.textContent = plan(r, F) + '. ' + st.action + '.';
    el.swatch.style.background = VF.U.rgbStr(col);
    el.marker.style.left = r * 100 + '%';
    range.value = Math.round(r * 100);
    range.setAttribute('aria-valuetext', `${st.name}, ripeness ${r.toFixed(2)}`);

    const edges = [0.25, 0.55, 0.85];
    const nearest = Math.min(...edges.map((e) => Math.abs(r - e)));
    el.note.textContent = nearest < 0.04
      ? 'This fruit sits on a stage boundary. Two human graders (or two models) could reasonably disagree here.'
      : 'Well inside this stage, so a classifier should be confident.';

    drawPlate();
  }

  function buildTrack() {
    const stops = VF.FRUITS[S.fruit].stops;
    el.track.style.background = `linear-gradient(to right, ${stops.map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(',')})`;
  }

  range.addEventListener('input', () => { stopPlay(); S.ripe = +range.value / 100; update(); });
  $$('input[name="matFruit"]').forEach((i) =>
    i.addEventListener('change', () => { S.fruit = i.value; buildTrack(); update(); })
  );

  function stopPlay() {
    cancelAnimationFrame(S.raf);
    S.playing = false;
    el.play.textContent = 'Ripen over time';
  }
  el.play.addEventListener('click', () => {
    if (S.playing) { stopPlay(); return; }
    if (VF.prefersReduced) { S.ripe = S.ripe >= 0.99 ? 0 : 1; update(); return; }
    S.playing = true;
    el.play.textContent = 'Stop';
    if (S.ripe >= 0.99) S.ripe = 0;
    let last = performance.now();
    const step = (now) => {
      S.ripe = Math.min(1, S.ripe + ((now - last) / 1000) * 0.16);
      last = now;
      update();
      if (S.ripe >= 1) { stopPlay(); return; }
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  });

  buildTrack();
  update();
})();
