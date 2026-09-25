// js/dust.js
// Wspólny mechanizm "przecierania" — używany dla kurzu na książkach i dla pajęczyn
// na regałach. Rysuje canvas z teksturą, wymazuje go wzdłuż ścieżki wskaźnika
// (destination-out) i śledzi pokrycie siatką komórek. Gdy pokrycie >= threshold,
// warstwa gaśnie i wywołuje onCleared().
//
// Moduł nie wie nic o książkach ani regałach — dostaje tylko element-hosta
// (musi mieć position:relative/absolute i właściwy rozmiar) i zwraca obiekt
// z canvasem, który sam nasłuchuje zdarzeń wskaźnikowych.

/**
 * @param {HTMLElement} hostEl - element, do którego domontowany jest canvas (inset:0)
 * @param {object} opts
 * @param {number} opts.width - szerokość w jednostkach logicznych sceny (px CSS)
 * @param {number} opts.height
 * @param {number} [opts.cols=6]
 * @param {number} [opts.rows=8]
 * @param {number} [opts.threshold=0.7]
 * @param {number} [opts.radius=11]
 * @param {"dust"|"cobweb"} [opts.texture="dust"]
 * @param {() => void} [opts.onCleared]
 * @param {() => void} [opts.onWipeTick] - wywoływane (rzadko, throttlowane przez wołającego) przy każdym ruchu
 */
export function createWipeLayer(hostEl, opts) {
  const {
    width,
    height,
    cols = 6,
    rows = 8,
    threshold = 0.7,
    radius = 11,
    texture = "dust",
    onCleared,
    onWipeTick,
  } = opts;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.className = "wipe-canvas";
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.touchAction = "none";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  drawTexture(ctx, width, height, texture);

  const cellW = width / cols;
  const cellH = height / rows;
  const cleared = new Set();
  let done = false;
  let active = false;
  let lastPt = null;

  function markCell(x, y) {
    const cx = Math.floor(x / cellW);
    const cy = Math.floor(y / cellH);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
    cleared.add(cy * cols + cx);
  }

  function eraseAt(x, y) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, "rgba(0,0,0,1)");
    grd.addColorStop(0.7, "rgba(0,0,0,0.9)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    markCell(x, y);
  }

  function eraseSegment(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / Math.max(3, radius * 0.6)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      eraseAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }

  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? width / rect.width : 1;
    const sy = rect.height ? height / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function coverage() {
    return cleared.size / (cols * rows);
  }

  function finish() {
    if (done) return;
    done = true;
    active = false;
    canvas.classList.add("wipe-done");
    if (onCleared) onCleared();
    setTimeout(() => canvas.remove(), 450);
  }

  function onPointerDown(e) {
    if (done) return;
    e.preventDefault();
    e.stopPropagation();
    active = true;
    lastPt = localPoint(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane — capture jest tylko usprawnieniem */
    }
    eraseAt(lastPt.x, lastPt.y);
    if (onWipeTick) onWipeTick();
    if (coverage() >= threshold) finish();
  }

  function onPointerMove(e) {
    if (!active || done) return;
    e.stopPropagation();
    const pt = localPoint(e);
    eraseSegment(lastPt.x, lastPt.y, pt.x, pt.y);
    lastPt = pt;
    if (onWipeTick) onWipeTick();
    if (coverage() >= threshold) finish();
  }

  function onPointerUp(e) {
    e.stopPropagation();
    active = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  hostEl.appendChild(canvas);

  return {
    canvas,
    get isDone() {
      return done;
    },
    destroy() {
      canvas.remove();
    },
  };
}

function drawTexture(ctx, w, h, kind) {
  if (kind === "cobweb") {
    drawCobwebTexture(ctx, w, h);
  } else {
    drawDustTexture(ctx, w, h);
  }
}

/** Zakurzona okładka: szara, ziarnista warstwa (tytuł pod spodem jest tylko rozmyty CSS-em przez wołającego). */
function drawDustTexture(ctx, w, h) {
  ctx.fillStyle = "rgba(148,138,118,0.95)";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.3 + 0.3;
    const light = Math.random() > 0.5;
    ctx.fillStyle = light
      ? `rgba(200,192,170,${0.12 + Math.random() * 0.22})`
      : `rgba(90,84,70,${0.12 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Pajęczyna w rogu regału: cienkie białawe nitki promieniste + kilka łuków. */
function drawCobwebTexture(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(238,233,218,0.6)";
  ctx.lineWidth = 1;
  const maxR = Math.max(w, h) * 1.05;
  for (let a = 0; a <= 90; a += 11) {
    const rad = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(rad) * maxR, Math.sin(rad) * maxR);
    ctx.stroke();
  }
  for (let r = maxR * 0.22; r < maxR; r += maxR * 0.2) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI / 2);
    ctx.stroke();
  }
}
