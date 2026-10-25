'use strict';
/* ==========================================================================
   Orchard Lens - shared helpers
   Everything the demos share: fruit colour palettes, a procedural orchard
   scene, a *simulated* detector, and canvas drawing helpers.
   ========================================================================== */

const VF = (() => {
  /* ---------- small utilities ---------- */
  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // Seeded random number generator (mulberry32) so scenes are repeatable.
    rng(seed) {
      let s = seed >>> 0;
      return function () {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hex2rgb(h) {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    mix(a, b, t) {
      return [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
    },
    rgbStr(c, a) {
      const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
      return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
    },
    // Returns [hue 0-360, saturation 0-100, value 0-100]
    rgbToHsv(c) {
      const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
    },
  };

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- fruit definitions ---------- */
  // Colour stops run from ripeness 0 (green) to 1 (overripe).
  const FRUITS = {
    apple: {
      name: 'Apple',
      stops: ['#78b341', '#b9c74a', '#e8a23c', '#e0483a', '#8d1f35'],
      r: [20, 28], diaMm: 72, horizon: 21, weight: 180,
    },
    tomato: {
      name: 'Tomato',
      stops: ['#6aa84f', '#b3c24b', '#f0903c', '#e03a2f', '#8f2a24'],
      r: [17, 25], diaMm: 62, horizon: 14, weight: 110,
    },
    orange: {
      name: 'Orange',
      stops: ['#6faa3e', '#bcc443', '#f4b73a', '#f08a1c', '#b8591a'],
      r: [22, 30], diaMm: 76, horizon: 28, weight: 190,
    },
  };
  Object.values(FRUITS).forEach((f) => (f.rgb = f.stops.map(U.hex2rgb)));

  // Ripeness is a 0..1 index. Stage boundaries sit at 0.25 / 0.55 / 0.85.
  const STAGES = [
    { key: 'unripe', name: 'Unripe', short: 'unripe', color: '#8fd16a', action: 'Leave on the tree', lo: 0, hi: 0.25 },
    { key: 'turning', name: 'Turning', short: 'turning', color: '#ffc247', action: 'Re-scan in 5 to 10 days', lo: 0.25, hi: 0.55 },
    { key: 'ripe', name: 'Ripe', short: 'ripe', color: '#4de3e0', action: 'Harvest now', lo: 0.55, hi: 0.85 },
    { key: 'over', name: 'Overripe', short: 'over', color: '#ff6fb5', action: 'Sell fast or process', lo: 0.85, hi: 1 },
  ];
  const stageOf = (r) => (r < 0.25 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3);

  // Lighting changes how confident the simulated detector is.
  const LIGHT = {
    sun: { name: 'Sunny', pen: 0, fp: 1 },
    overcast: { name: 'Overcast', pen: 0.05, fp: 1.3 },
    dusk: { name: 'Dusk', pen: 0.2, fp: 2.2 },
    glare: { name: 'Backlit', pen: 0.14, fp: 2.6 },
  };

  function colorAt(key, t) {
    const s = FRUITS[key].rgb;
    const n = s.length - 1;
    const p = U.clamp(t, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(p));
    return U.mix(s[i], s[i + 1], p - i);
  }

  function pickRipe(R, mix) {
    const m = mix || [0.22, 0.3, 0.4, 0.08];
    let x = R(), acc = 0, idx = 0;
    for (let i = 0; i < m.length; i++) {
      acc += m[i];
      if (x <= acc) { idx = i; break; }
      idx = i;
    }
    return U.lerp(STAGES[idx].lo + 0.01, STAGES[idx].hi - 0.01, R());
  }

  /* ---------- canvas helpers ---------- */
  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function offscreen(w, h) {
    return setupCanvas(document.createElement('canvas'), w, h);
  }

  /* ---------- drawing: leaves & fruit ---------- */
  const LEAF_SHADES = ['#1f4d33', '#27613c', '#2f7344', '#1b3f2e', '#356f3a', '#2a5a38'];

  function drawLeaf(ctx, x, y, len, ang, shade) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const w = len * 0.36;
    const base = U.hex2rgb(shade);
    const g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, U.rgbStr(U.mix(base, [160, 220, 130], 0.28)));
    g.addColorStop(1, U.rgbStr(U.mix(base, [5, 25, 15], 0.35)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -w, len * 0.75, -w * 0.9, len, 0);
    ctx.bezierCurveTo(len * 0.75, w * 0.9, len * 0.25, w, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,200,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawFruit(ctx, x, y, r, ripe, key) {
    const col = colorAt(key, ripe);
    const base = U.rgbStr(col);
    const light = U.rgbStr(U.mix(col, [255, 255, 255], 0.38));
    const dark = U.rgbStr(U.mix(col, [20, 5, 25], 0.55));
    const rx = key === 'tomato' ? r * 1.06 : r;
    const ry = key === 'tomato' ? r * 0.9 : r * 0.96;

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.18;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, light);
    g.addColorStop(0.45, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // two-tone blush on part-ripe apples
    if (key === 'apple' && ripe > 0.2 && ripe < 0.8) {
      const b = ctx.createRadialGradient(r * 0.35, r * 0.15, 1, r * 0.35, r * 0.15, r * 0.9);
      b.addColorStop(0, U.rgbStr(colorAt('apple', Math.min(1, ripe + 0.3)), 0.55));
      b.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();

    if (key === 'apple') {
      ctx.fillStyle = 'rgba(30,10,10,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.82, r * 0.2, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a3524';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, -ry * 0.78);
      ctx.quadraticCurveTo(r * 0.04, -ry * 1.08, r * 0.2, -ry * 1.28);
      ctx.stroke();
    } else if (key === 'tomato') {
      ctx.save();
      ctx.translate(0, -ry * 0.72);
      ctx.fillStyle = '#3f7d2c';
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5 - Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(r * 0.24, 0, r * 0.26, r * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else if (key === 'orange') {
      ctx.fillStyle = 'rgba(60,20,0,0.10)';
      for (let i = 0; i < 16; i++) {
        const a = i * 2.399963;
        const d = Math.sqrt((i + 0.5) / 16) * r * 0.86;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.8, r * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(70,95,30,0.85)';
      ctx.beginPath();
      ctx.arc(0, -ry * 0.84, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- procedural orchard scene ---------- */
  function makeScene(opt) {
    const { w, h, fruit = 'apple', count = 40, occlusion = 35, seed = 1, light = 'sun', mix } = opt;
    const R = U.rng(seed);
    const F = FRUITS[fruit];
    const sc = Math.sqrt((w * h) / (960 * 600)) * (opt.scale || 1);

    // fruit placement (some overlap allowed, like real clusters)
    const fruits = [];
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 30; a++) {
        const r = U.lerp(F.r[0], F.r[1], R()) * sc;
        const x = U.lerp(r + 14, w - r - 14, R());
        const y = U.lerp(r + 30, h - r - 14, R());
        let ok = true;
        for (const f of fruits) {
          if (Math.hypot(f.x - x, f.y - y) < (f.r + r) * 0.78) { ok = false; break; }
        }
        if (ok) { fruits.push({ x, y, r, ripe: pickRipe(R, mix), occ: 0 }); break; }
      }
    }
    fruits.sort((a, b) => a.r - b.r); // smaller (further) fruit is drawn first
    fruits.forEach((f, i) => { f.id = i; f.stage = stageOf(f.ripe); });

    // neighbours covering each other
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        const d = Math.hypot(fruits[i].x - fruits[j].x, fruits[i].y - fruits[j].y);
        const rr = fruits[i].r + fruits[j].r;
        if (d < rr) fruits[i].occ += U.clamp((rr - d) / (2 * fruits[i].r), 0, 1) * 0.55;
      }
    }

    // foreground leaves that hide part of a fruit
    const fgLeaves = [];
    const expected = (occlusion / 100) * 3.2;
    fruits.forEach((f) => {
      const n = Math.floor(expected) + (R() < expected % 1 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = R() * Math.PI * 2;
        const dist = f.r * U.lerp(0.45, 0.9, R());
        const len = f.r * U.lerp(1.1, 1.7, R());
        const lx = f.x + Math.cos(a) * dist;
        const ly = f.y + Math.sin(a) * dist;
        fgLeaves.push({ x: lx, y: ly, len, ang: a + Math.PI + (R() - 0.5) * 1.2, shade: LEAF_SHADES[Math.floor(R() * LEAF_SHADES.length)] });
        f.occ += 0.16 + 0.1 * R();
      }
    });
    fruits.forEach((f) => (f.occ = Math.min(0.92, f.occ)));

    // background foliage and branches
    const bgLeaves = [];
    const nLeaves = Math.round(80 * Math.sqrt((w * h) / (960 * 600)) ** 2);
    for (let i = 0; i < nLeaves; i++) {
      bgLeaves.push({ x: R() * w, y: R() * h, len: U.lerp(40, 92, R()) * sc, ang: R() * Math.PI * 2, shade: LEAF_SHADES[Math.floor(R() * LEAF_SHADES.length)] });
    }
    const branches = [];
    for (let i = 0; i < 5; i++) {
      const y0 = R() * h;
      branches.push([-10, y0, w * 0.3, y0 + (R() - 0.5) * 220, w * 0.65, y0 + (R() - 0.5) * 220, w + 10, R() * h, U.lerp(4, 9, R()) * sc]);
    }
    const bokeh = [];
    for (let i = 0; i < 14; i++) bokeh.push({ x: R() * w, y: R() * h * 0.8, r: U.lerp(30, 90, R()) * sc });

    return { w, h, fruit, light, seed, sc, fruits, fgLeaves, bgLeaves, branches, bokeh };
  }

  function renderScene(ctx, s) {
    const { w, h } = s;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2d4d5e');
    bg.addColorStop(1, '#15302a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    s.bokeh.forEach((b) => {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(190,235,210,0.10)');
      g.addColorStop(1, 'rgba(190,235,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    });

    ctx.lineCap = 'round';
    s.branches.forEach((b) => {
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = b[8];
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.bezierCurveTo(b[2], b[3], b[4], b[5], b[6], b[7]);
      ctx.stroke();
    });

    s.bgLeaves.forEach((l) => drawLeaf(ctx, l.x, l.y, l.len, l.ang, l.shade));
    s.fruits.forEach((f) => drawFruit(ctx, f.x, f.y, f.r, f.ripe, s.fruit));
    s.fgLeaves.forEach((l) => drawLeaf(ctx, l.x, l.y, l.len, l.ang, l.shade));

    // lighting overlay
    if (s.light === 'sun') {
      const g = ctx.createRadialGradient(w * 0.15, 0, 0, w * 0.15, 0, w * 0.8);
      g.addColorStop(0, 'rgba(255,225,160,0.14)');
      g.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (s.light === 'overcast') {
      ctx.fillStyle = 'rgba(140,150,170,0.22)';
      ctx.fillRect(0, 0, w, h);
    } else if (s.light === 'dusk') {
      ctx.fillStyle = 'rgba(8,6,30,0.5)';
      ctx.fillRect(0, 0, w, h);
    } else if (s.light === 'glare') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.85, h * 0.05, 0, w * 0.85, h * 0.05, w * 0.7);
      g.addColorStop(0, 'rgba(255,250,225,0.6)');
      g.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /* ---------- simulated detector ---------- */
  // NOT a neural network. Confidence falls as leaves cover a fruit, as light
  // gets worse and as fruit gets small, which is how real detectors behave.
  function simulateDetections(s) {
    const R = U.rng(s.seed * 31 + 5);
    const L = LIGHT[s.light];
    const F = FRUITS[s.fruit];
    const dets = [];

    s.fruits.forEach((f) => {
      const sizePen = f.r < 20 ? 0.05 : 0;
      const conf = U.clamp(0.97 - f.occ * 0.8 - L.pen - sizePen + (R() - 0.5) * 0.12, 0.02, 0.99);
      if (conf < 0.12) return; // the model never fires at all
      const shrink = 1 - f.occ * 0.35;
      const jit = 2 + f.occ * 8 + L.pen * 20;
      const bw = f.r * 2 * shrink + (R() - 0.5) * jit;
      const bh = f.r * 2 * shrink * 0.97 + (R() - 0.5) * jit;
      const cx = f.x + (R() - 0.5) * jit * 0.8;
      const cy = f.y + (R() - 0.5) * jit * 0.8;
      const pr = U.clamp(f.ripe + (R() - 0.5) * (0.08 + L.pen * 0.5), 0, 1);
      dets.push({ id: f.id, x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, conf, ripe: pr, stage: stageOf(pr), fp: false, mm: bw * (F.diaMm / (((F.r[0] + F.r[1]) / 2) * 2 * s.sc)) });
    });

    const nfp = Math.round(s.fruits.length * 0.05 * L.fp) + (R() < 0.5 ? 1 : 0);
    const sc = s.sc;
    for (let i = 0; i < nfp; i++) {
      const r = U.lerp(F.r[0], F.r[1], R()) * sc * 0.8;
      const cx = U.lerp(r + 10, s.w - r - 10, R());
      const cy = U.lerp(r + 20, s.h - r - 10, R());
      const pr = R();
      dets.push({ id: 'fp' + i, x: cx - r, y: cy - r, w: r * 2, h: r * 2, conf: 0.18 + 0.5 * R() * R(), ripe: pr, stage: stageOf(pr), fp: true, mm: 0 });
    }
    return dets;
  }

  function evaluate(s, dets, thr) {
    const shown = dets.filter((d) => d.conf >= thr);
    const tp = shown.filter((d) => !d.fp).length;
    const fp = shown.length - tp;
    const gt = s.fruits.length;
    const fn = gt - tp;
    const precision = shown.length ? tp / shown.length : 0;
    const recall = gt ? tp / gt : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const byStage = [0, 0, 0, 0];
    shown.forEach((d) => byStage[d.stage]++);
    return { gt, shown: shown.length, tp, fp, fn, precision, recall, f1, countErr: gt ? (shown.length - gt) / gt : 0, byStage };
  }

  /* ---------- drawing the detector overlay ---------- */
  function drawBoxes(ctx, dets, o) {
    const thr = o.thr === undefined ? 0.5 : o.thr;
    const scanX = o.scanX === undefined ? Infinity : o.scanX;
    ctx.save();
    ctx.font = '600 11px "DM Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    for (const d of dets) {
      if (d.conf < thr) continue;
      const cx = d.x + d.w / 2;
      if (cx > scanX) continue;
      const a = scanX === Infinity ? 1 : U.clamp((scanX - cx) / 50, 0, 1);
      const st = STAGES[d.stage];
      const hot = d.id === o.hoverId;
      ctx.globalAlpha = a;
      if (hot) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }
      ctx.strokeStyle = st.color;
      ctx.lineWidth = hot ? 3 : 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      if (o.labels !== false) {
        const txt = `${st.short} ${d.conf.toFixed(2)}`;
        const tw = ctx.measureText(txt).width + 8;
        let lx = Math.max(1, Math.min(d.x, o.W - tw - 1));
        let ly = d.y - 15;
        if (ly < 1) ly = d.y + 1;
        ctx.fillStyle = st.color;
        ctx.fillRect(lx, ly, tw, 14);
        ctx.fillStyle = '#1b0f26';
        ctx.fillText(txt, lx + 4, ly + 7.5);
      }
    }
    ctx.restore();
  }

  function drawMisses(ctx, s, thr, detMap) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ff5c7a';
    ctx.lineWidth = 2;
    s.fruits.forEach((f) => {
      const d = detMap.get(f.id);
      if (d && d.conf >= thr) return;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawScanLine(ctx, x, h) {
    const g = ctx.createLinearGradient(x - 40, 0, x, 0);
    g.addColorStop(0, 'rgba(77,227,224,0)');
    g.addColorStop(1, 'rgba(77,227,224,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, 0, 40, h);
    ctx.fillStyle = '#4de3e0';
    ctx.fillRect(x - 1, 0, 2, h);
  }

  return { U, FRUITS, STAGES, LIGHT, stageOf, colorAt, pickRipe, setupCanvas, offscreen, prefersReduced, drawLeaf, drawFruit, makeScene, renderScene, simulateDetections, evaluate, drawBoxes, drawMisses, drawScanLine };
})();

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
