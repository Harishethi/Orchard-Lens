'use strict';
/* Yield estimator: turns what the camera counted into tonnes, with a
   correction for fruit the detector missed and fruit no camera can see. */
(function () {
  const form = $('#yieldForm');
  if (!form) return;

  const f = (id) => document.getElementById(id);
  const inp = {
    area: f('yArea'), density: f('yDensity'), counted: f('yCounted'), recall: f('yRecall'),
    hidden: f('yHidden'), weight: f('yWeight'), ripe: f('yRipe'), turning: f('yTurning'), market: f('yMarket'),
  };
  const outO = { recall: f('yRecallO'), hidden: f('yHiddenO'), ripe: f('yRipeO'), turning: f('yTurningO'), market: f('yMarketO') };
  const res = {
    total: f('yTotal'), range: f('yRange'), perTree: f('yPerTree'), fruits: f('yFruits'), marketable: f('yMarketable'),
    perHa: f('yPerHa'), bins: f('yBins'), bar: f('yBar'),
    tU: f('yUnripeT'), tT: f('yTurnT'), tR: f('yRipeT'),
  };

  const PRESETS = {
    apple: { area: 12, density: 800, counted: 95, weight: 180 },
    orange: { area: 8, density: 400, counted: 180, weight: 190 },
    tomato: { area: 5, density: 25000, counted: 14, weight: 110 },
  };

  const fmt = (n, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const num = (el) => Math.max(0, parseFloat(el.value) || 0);

  // fruits per tree = counted / recall / (1 - hidden share)
  function perTreeFruit(counted, recallPct, hiddenPct) {
    const rec = VF.U.clamp(recallPct, 40, 99.5) / 100;
    const hid = VF.U.clamp(hiddenPct, 0, 60) / 100;
    return counted / rec / (1 - hid);
  }

  function compute() {
    const area = num(inp.area), density = num(inp.density), counted = num(inp.counted), weightKg = num(inp.weight) / 1000;
    const recall = +inp.recall.value, hidden = +inp.hidden.value, market = +inp.market.value;
    const ripe = +inp.ripe.value;
    // keep ripe + turning at or below 100
    inp.turning.max = 100 - ripe;
    if (+inp.turning.value > 100 - ripe) inp.turning.value = 100 - ripe;
    const turning = +inp.turning.value;
    const unripe = 100 - ripe - turning;

    outO.recall.textContent = recall + '%';
    outO.hidden.textContent = hidden + '%';
    outO.ripe.textContent = ripe + '%';
    outO.turning.textContent = turning + '%';
    outO.market.textContent = market + '%';

    const trees = area * density;
    const ptf = perTreeFruit(counted, recall, hidden);
    const totalFruit = trees * ptf;
    const gross = (totalFruit * weightKg) / 1000;             // tonnes
    const sellable = gross * (market / 100);

    // optimistic and cautious bounds: recall and hidden share each off by 5 points
    const low = (trees * perTreeFruit(counted, recall + 5, hidden - 5) * weightKg * (market / 100)) / 1000;
    const high = (trees * perTreeFruit(counted, recall - 5, hidden + 5) * weightKg * (market / 100)) / 1000;

    const tR = (sellable * ripe) / 100, tT = (sellable * turning) / 100, tU = (sellable * unripe) / 100;

    res.total.textContent = fmt(sellable, sellable < 10 ? 2 : 1);
    res.range.textContent = `${fmt(low, 1)} to ${fmt(high, 1)} t`;
    res.perTree.textContent = fmt(ptf, 0);
    res.fruits.textContent = fmt(totalFruit, 0);
    res.marketable.textContent = fmt(sellable, 1) + ' t of ' + fmt(gross, 1) + ' t';
    res.perHa.textContent = area ? fmt(sellable / area, 1) : '0';
    res.bins.textContent = fmt(Math.ceil((tR * 1000) / 400), 0);
    res.tU.textContent = fmt(tU, 1) + ' t';
    res.tT.textContent = fmt(tT, 1) + ' t';
    res.tR.textContent = fmt(tR, 1) + ' t';

    res.bar.innerHTML = '';
    [[unripe, VF.STAGES[0].color, 'Unripe'], [turning, VF.STAGES[1].color, 'Turning'], [ripe, VF.STAGES[2].color, 'Ripe']].forEach(([p, c, n]) => {
      if (p <= 0) return;
      const s = document.createElement('span');
      s.style.width = p + '%';
      s.style.background = c;
      s.title = `${n}: ${p}%`;
      res.bar.appendChild(s);
    });
  }

  form.addEventListener('input', compute);
  form.addEventListener('submit', (e) => e.preventDefault());

  $$('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.preset];
      inp.area.value = p.area;
      inp.density.value = p.density;
      inp.counted.value = p.counted;
      inp.weight.value = p.weight;
      $$('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      compute();
    })
  );

  compute();
})();
