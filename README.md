# Orchard Lens

An interactive website on **AI-powered computer vision for fruit detection, counting,
maturity assessment and yield estimation**.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no install.

## Run it in VS Code

**Option 1: Live Server (recommended)**
1. Unzip the folder and open it in VS Code (`File > Open Folder`).
2. Install the **Live Server** extension (Ritwick Dey).
3. Right-click `index.html` and choose **Open with Live Server**.

**Option 2: just open the file**
Double-click `index.html`. Everything works from `file://`.

**Option 3: Python server**
```
python -m http.server 8000
```
then visit http://localhost:8000

Fonts (Bricolage Grotesque, Albert Sans, DM Mono) load from Google Fonts when you are online.
Offline, the site falls back to system fonts and still works.

## What is in the site

| Section | What it shows |
|---|---|
| Hero | Live simulated detection sweep over a generated orchard frame |
| How it works | Six-step pipeline with copyable Python samples (OpenCV, Ultralytics YOLO) |
| Detector lab | Change fruit, light, leaf cover and confidence threshold, see precision / recall / F1 |
| Counting | Moving-camera demo: per-frame sums vs tracked count at a line |
| Maturity | Ripeness slider with real HSV values, stage and harvest call |
| Yield | Calculator from per-tree counts to tonnes, with a range |
| Models, metrics, datasets, challenges, FAQ | Reference content |

## Project structure

```
orchard-lens/
  index.html
  css/style.css
  js/
    common.js    shared helpers: fruit palettes, scene generator, simulated detector
    hero.js      hero animation
    ui.js        nav, pipeline stepper, code highlighting
    lab.js       detector lab
    tracker.js   counting demo
    maturity.js  maturity lab
    yield.js     yield estimator
```

## Notes

- The demos are **simulations** built for teaching. No neural network runs in the browser.
  The code samples in the pipeline section use real libraries and can be run on your own footage.
- To change colours, edit the custom properties at the top of `css/style.css`.
- To change the fruit palettes or detector behaviour, edit `FRUITS` and `simulateDetections` in `js/common.js`.
