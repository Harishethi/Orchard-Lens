'use strict';
/* Navigation, the pipeline stepper (with copyable code) and small page bits. */
(function () {
  /* ----- mobile nav ----- */
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ----- highlight the nav link for the section in view ----- */
  const navAnchors = $$('#navLinks a[href^="#"]');
  if ('IntersectionObserver' in window && navAnchors.length) {
    const map = new Map(navAnchors.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navAnchors.forEach((a) => a.removeAttribute('aria-current'));
        const a = map.get(en.target.id);
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ----- pipeline stepper ----- */
  const STEPS = [
    {
      title: 'Capture',
      short: 'Cameras on tractors, drones or phones',
      text: 'Everything starts with images. Rows are filmed from a tractor, a utility vehicle, a drone or a hand-held phone. Overlap between frames matters because it is what lets the counter follow a fruit from one frame to the next.',
      points: ['Film in diffuse light if you can: early morning or overcast beats noon sun.', 'Aim for 60 to 80 percent overlap between frames.', 'Add a depth camera or a reference marker if you want fruit size in millimetres.'],
      lang: 'python',
      code: `import cv2

cap = cv2.VideoCapture("row14.mp4")
i = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    if i % 15 == 0:                      # keep 2 fps from a 30 fps video
        cv2.imwrite(f"frames/{i:06d}.jpg", frame)
    i += 1
cap.release()`,
    },
    {
      title: 'Prepare',
      short: 'Label, balance and augment the data',
      text: 'A detector learns from boxes drawn by people. Label a few hundred varied frames: different trees, light and ripeness. Then augment them with brightness, blur and crop changes so the model copes with a bad day as well as a good one.',
      points: ['Label ripeness stages as classes, so detection and maturity come from one model.', 'Keep whole rows or whole days out of training for a fair test.', 'Include frames with nothing but leaves so the model learns what not to flag.'],
      lang: 'yaml',
      code: `# orchard.yaml
path: datasets/orchard
train: images/train
val: images/val
names:
  0: unripe
  1: turning
  2: ripe
  3: overripe`,
    },
    {
      title: 'Detect',
      short: 'Train a detector that boxes every fruit',
      text: 'A one-stage detector such as the YOLO family is a strong starting point because it is fast enough for video and small enough for an edge device. Start from pretrained weights and fine-tune on your own labelled frames.',
      points: ['Use a larger image size than the default: fruit is small in a wide orchard frame.', 'Watch recall on heavily covered fruit, not just the headline mAP.', 'Tune the confidence threshold on a validation set, as the lab above shows.'],
      lang: 'python',
      code: `from ultralytics import YOLO

model = YOLO("yolov8s.pt")                 # pretrained starting point
model.train(data="orchard.yaml", epochs=100, imgsz=960)

metrics = model.val()
print("mAP@50:", metrics.box.map50)`,
    },
    {
      title: 'Count',
      short: 'Track IDs so each fruit is counted once',
      text: 'Detection gives boxes per frame. A tracker links boxes across frames and gives each fruit a persistent ID, and the unique IDs are the count. This is what stops the same apple being counted a dozen times as the camera moves past.',
      points: ['ID switches after occlusion cause both over- and under-counting.', 'Counting on a line, as in the demo above, is easy to audit.', 'Count per class to get unripe, turning and ripe totals from the same pass.'],
      lang: 'python',
      code: `from collections import defaultdict
from ultralytics import YOLO

model = YOLO("runs/detect/train/weights/best.pt")
seen = defaultdict(set)

for r in model.track("row14.mp4", persist=True,
                     tracker="bytetrack.yaml", stream=True):
    if r.boxes.id is None:
        continue
    for cls, tid in zip(r.boxes.cls.int().tolist(),
                        r.boxes.id.int().tolist()):
        seen[model.names[cls]].add(tid)

print({name: len(ids) for name, ids in seen.items()})`,
    },
    {
      title: 'Assess maturity',
      short: 'Read colour to place fruit on a ripeness scale',
      text: 'Colour is the cheapest ripeness signal. Convert each fruit crop to HSV, ignore washed-out pixels, and use the median hue. A classifier head or a small regression model can then map hue and saturation to a stage, and calibrate against a handheld refractometer or firmness tester.',
      points: ['HSV separates colour from brightness, so shade matters less than in RGB.', 'Calibrate per variety: a green apple never turns red.', 'Near-infrared and hyperspectral cameras can see sugar content that colour cannot.'],
      lang: 'python',
      code: `import cv2
import numpy as np

def median_hue(crop_bgr):
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    keep = hsv[..., 1] > 60                  # drop washed-out pixels
    if not keep.any():
        return None
    return float(np.median(hsv[..., 0][keep]) * 2)   # degrees, 0 to 360`,
    },
    {
      title: 'Estimate yield',
      short: 'Scale up and correct for hidden fruit',
      text: 'Counts from imaged trees are scaled to the whole block. Because the camera misses some fruit and some fruit is hidden from every angle, the raw count is corrected with factors measured on a few trees that were also picked and counted by hand.',
      points: ['Measure the correction factors on a small hand-counted sample, every season.', 'Report a range, not a single number.', 'Multiply by average fruit weight, then by the marketable share.'],
      lang: 'python',
      code: `per_tree = counted / recall / (1 - hidden_share)
total_fruit = trees * per_tree
tonnes = total_fruit * avg_weight_kg / 1000
marketable = tonnes * marketable_share`,
    },
  ];

  const tabs = $('#stepTabs');
  const panel = $('#stepPanel');
  if (!tabs || !panel) return;

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // very small highlighter: comments, strings, keywords, numbers
  function highlight(code) {
    const re = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|for|in|if|not|is|None|def|return|break|continue|while|as|True|False)\b|\b(\d+(?:\.\d+)?)\b/gm;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1] ? 'tok-c' : m[2] ? 'tok-s' : m[3] ? 'tok-k' : 'tok-n';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  }

  STEPS.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'step-tab';
    b.setAttribute('role', 'tab');
    b.id = 'tab-' + i;
    b.setAttribute('aria-controls', 'stepPanel');
    b.innerHTML = `<span class="step-n">${i + 1}</span><span class="step-t"><strong>${s.title}</strong><small>${s.short}</small></span>`;
    b.addEventListener('click', () => select(i, true));
    tabs.appendChild(b);
  });

  tabs.addEventListener('keydown', (e) => {
    const all = $$('.step-tab', tabs);
    const cur = all.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    let n = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (cur + 1) % all.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (cur - 1 + all.length) % all.length;
    if (n >= 0) { e.preventDefault(); select(n, true); }
  });

  function select(i, focus) {
    const s = STEPS[i];
    $$('.step-tab', tabs).forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      if (k === i && focus) t.focus();
    });
    panel.setAttribute('aria-labelledby', 'tab-' + i);
    panel.innerHTML = `
      <h3>${s.title}</h3>
      <p>${s.text}</p>
      <ul class="points">${s.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <div class="code">
        <div class="code-bar"><span>${s.lang}</span><button type="button" class="copy" aria-label="Copy code">Copy</button></div>
        <pre><code>${highlight(s.code)}</code></pre>
      </div>`;
    const btn = $('.copy', panel);
    btn.addEventListener('click', () => {
      const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.code).then(done, done);
      else done();
    });
  }
  select(0, false);

  /* ----- footer year ----- */
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
