// js/klimat.js
// Fala 3 — klimat sali:
//  • pora dnia zgodna z zegarem iPada (wschód/zachód słońca w Warszawie wg miesiąca),
//  • liście spadające za oknami + ich odbicie w parkiecie + drobinki kurzu w smudze światła,
//  • interaktywne otoczenie z prostą fizyką: lampa, kinkiety, kominek, zegar,
//    żyrandol (wahadło tłumione), zasłona (sprężyna).
// Moduł nie zna logiki książek — korzysta z wąskiego API świata (getWorldApi w js/world.js).
// Wszystkie pętle animacji działają tylko wtedy, gdy coś jest w kadrze i się rusza.

import { LAYOUT } from "./layout.js";
import { getAudioContext, getSoundsEnabled } from "./sound.js";
import { setAmbient, toggleCandle, openHideoutById } from "./world.js";

let api = null;
let pora = "auto"; // "auto" | "dzien" | "wieczor"
let evening = 0;

// =========================================================================
// Pora dnia
// =========================================================================

// Przybliżone godziny wschodu/zachodu słońca w Warszawie (czas lokalny, połowa miesiąca).
const SUNRISE = [7.67, 7.0, 6.08, 6.0, 5.0, 4.25, 4.58, 5.33, 6.17, 7.0, 7.0, 7.67];
const SUNSET = [15.83, 16.67, 17.67, 19.5, 20.25, 21.0, 20.83, 20.0, 19.0, 17.83, 15.92, 15.5];

function monthValue(table, date) {
  const m = date.getMonth();
  const daysInMonth = new Date(date.getFullYear(), m + 1, 0).getDate();
  const t = (date.getDate() - 15) / daysInMonth; // -0.5..0.5 wokół połowy miesiąca
  if (t >= 0) return table[m] + (table[(m + 1) % 12] - table[m]) * t;
  const prev = (m + 11) % 12;
  return table[m] + (table[m] - table[prev]) * t;
}

/** 0 = dzień, 1 = wieczór/noc. Przejście trwa godzinę (±30 min wokół zachodu i wschodu). */
export function eveningAt(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  const rise = monthValue(SUNRISE, date);
  const set = monthValue(SUNSET, date);
  const ramp = (x) => Math.min(1, Math.max(0, x));
  if (h >= 12) return ramp(h - (set - 0.5));
  return 1 - ramp(h - (rise - 0.5));
}

function computeEvening() {
  const param = new URLSearchParams(location.search).get("pora");
  const mode = param === "dzien" || param === "wieczor" ? param : pora;
  if (mode === "dzien") return 0;
  if (mode === "wieczor") return 1;
  return eveningAt(new Date());
}

function refreshTimeOfDay() {
  evening = computeEvening();
  setAmbient({ evening });
  document.documentElement.classList.toggle("pora-wieczor", evening > 0.5);
}

export function setPora(mode) {
  pora = ["auto", "dzien", "wieczor"].includes(mode) ? mode : "auto";
  if (api) refreshTimeOfDay();
}

// =========================================================================
// Dźwięki otoczenia (syntezowane, cicho)
// =========================================================================

function audio() {
  const ctx = getAudioContext();
  return ctx && getSoundsEnabled() ? ctx : null;
}

function ping(freq, { gain = 0.05, decay = 1.2, at = 0, type = "sine", partials = [1] } = {}) {
  const ctx = audio();
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  out.connect(ctx.destination);
  partials.forEach((p, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * p;
    g.gain.value = 1 / (i + 1.4);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  });
}

let noiseBuf = null;
function noiseBurst({ gain = 0.03, dur = 0.05, freq = 2500, q = 1.2, at = 0 } = {}) {
  const ctx = audio();
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t0, Math.random() * 0.4);
  src.stop(t0 + dur + 0.02);
}

const playSwitch = () => {
  noiseBurst({ gain: 0.08, dur: 0.03, freq: 3200, q: 2 });
  ping(180, { gain: 0.04, decay: 0.08, type: "triangle" });
};
const playCrystal = (energy) => {
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    ping(2400 + Math.random() * 2200, { gain: 0.012 + 0.02 * energy, decay: 0.5, at: i * 0.06 + Math.random() * 0.04, partials: [1, 2.7] });
  }
};
const playBell = (at) => ping(740, { gain: 0.07, decay: 2.6, at, partials: [1, 2.76, 5.4, 8.9] });
const playWhoosh = () => noiseBurst({ gain: 0.06, dur: 0.6, freq: 700, q: 0.6 });

// =========================================================================
// Pomocnicze: elementy świata, gesty „stuknij / przeciągnij”
// =========================================================================

function el(cls, rect, parent = api.worldLayerEl) {
  const d = document.createElement("div");
  d.className = cls;
  if (rect) {
    d.style.left = `${rect.x}px`;
    d.style.top = `${rect.y}px`;
    d.style.width = `${rect.w}px`;
    d.style.height = `${rect.h}px`;
  }
  parent.appendChild(d);
  return d;
}

/** Gest na elemencie: nie przesuwa sali (stopPropagation), rozróżnia stuknięcie od przeciągania. */
function wireGesture(target, { onTap, onDragStart, onDrag, onDragEnd }) {
  let g = null;
  target.addEventListener("pointerdown", (e) => {
    if (api.isDragging()) return;
    e.stopPropagation();
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastT: performance.now(), moved: false };
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  });
  target.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    const scale = sceneScale();
    const dx = (e.clientX - g.x0) / scale;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) {
      g.moved = true;
      onDragStart && onDragStart();
    }
    if (g.moved && onDrag) {
      const now = performance.now();
      const vx = ((e.clientX - g.lastX) / scale) / Math.max(1, now - g.lastT) * 1000;
      onDrag(dx, vx);
      g.lastX = e.clientX;
      g.lastT = now;
    }
  });
  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    const wasMoved = g.moved;
    const scale = sceneScale();
    const tapX = (e.clientX - target.getBoundingClientRect().left) / scale;
    g = null;
    if (wasMoved) onDragEnd && onDragEnd();
    else onTap && onTap(tapX);
  };
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
}

function sceneScale() {
  const scene = document.getElementById("scene");
  return scene.getBoundingClientRect().width / 1366 || 1;
}

function klimatState() {
  if (!api.state.klimat || typeof api.state.klimat !== "object") api.state.klimat = {};
  const k = api.state.klimat;
  if (typeof k.lamp !== "boolean") k.lamp = false;
  if (typeof k.fire !== "boolean") k.fire = false;
  if (!k.candles || typeof k.candles !== "object") k.candles = {};
  return k;
}

function save() {
  api.notifyChange();
}

// =========================================================================
// Okna: liście, odbicie w parkiecie, kurz w smudze światła
// =========================================================================

const LEAF_COLORS = ["#e8a33a", "#d9782a", "#f2c14e", "#c4561f", "#b8872f", "#e0b54a"];
const RES = 1.5; // rozdzielczość canvasów względem współrzędnych logicznych
const FLOOR_Y = 612;
const windowFx = [];

function makeCanvas(cls, rect) {
  const c = document.createElement("canvas");
  c.className = cls;
  c.width = Math.round(rect.w * RES);
  c.height = Math.round(rect.h * RES);
  c.style.left = `${rect.x}px`;
  c.style.top = `${rect.y}px`;
  c.style.width = `${rect.w}px`;
  c.style.height = `${rect.h}px`;
  api.worldLayerEl.appendChild(c);
  const g = c.getContext("2d");
  g.scale(RES, RES);
  return { c, g };
}

function newLeaf(win, fromTop) {
  return {
    x: Math.random() * win.w,
    y: fromTop ? -10 - Math.random() * 40 : Math.random() * win.h,
    vy: 18 + Math.random() * 26,
    sway: 10 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 2.2,
    size: 5 + Math.random() * 5,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
  };
}

function buildWindows() {
  for (const win of LAYOUT.windows) {
    const leaves = makeCanvas("klimat-liscie", win);
    leaves.c.style.clipPath = `inset(0 round ${win.arch}px ${win.arch}px 0 0)`;
    const reflRect = { x: win.x - 50, y: FLOOR_Y, w: win.w + 100, h: 192 };
    const refl = makeCanvas("klimat-odbicie", reflRect);
    let motes = null;
    if (win.sunbeam) motes = makeCanvas("klimat-kurz", win.sunbeam);
    windowFx.push({
      win,
      leaves,
      refl,
      reflRect,
      motes,
      items: Array.from({ length: 13 }, () => newLeaf(win, false)),
      dots: win.sunbeam
        ? Array.from({ length: 22 }, () => ({
            x: Math.random() * win.sunbeam.w,
            y: Math.random() * win.sunbeam.h,
            vx: (Math.random() - 0.5) * 6,
            vy: -2 - Math.random() * 5,
            tw: Math.random() * Math.PI * 2,
          }))
        : [],
    });
  }
}

function drawLeaf(g, x, y, rot, size, color, alpha) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = alpha * 0.6;
  g.strokeStyle = "rgba(90,50,10,0.8)";
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(-size, 0);
  g.lineTo(size, 0);
  g.stroke();
  g.restore();
}

function stepWindows(dt, t) {
  const activeCount = Math.round(13 - 5 * evening);
  for (const fx of windowFx) {
    const { win } = fx;
    const inView = api.isXInView(win.x - 60, win.w + 120);
    fx.leaves.c.style.visibility = inView ? "visible" : "hidden";
    if (!inView) continue;
    const wind = Math.sin(t * 0.21) * 10 + 6;

    const g = fx.leaves.g;
    g.clearRect(0, 0, win.w, win.h);
    const r = fx.refl.g;
    const rw = fx.reflRect.w;
    const rh = fx.reflRect.h;
    r.clearRect(0, 0, rw, rh);
    // Jasna plama okna odbita w parkiecie (dzień: ciepła, wieczór: chłodna).
    const grad = r.createLinearGradient(0, 0, 0, rh);
    const day = 1 - evening;
    grad.addColorStop(0, `rgba(${Math.round(255 * day + 90 * evening)},${Math.round(214 * day + 115 * evening)},${Math.round(150 * day + 200 * evening)},0.85)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    r.fillStyle = grad;
    r.fillRect(50, 0, win.w, rh);

    fx.items.forEach((lf, i) => {
      if (i >= activeCount) return;
      lf.y += lf.vy * dt;
      lf.x += (wind + Math.sin(t * 1.3 + lf.phase) * lf.sway) * dt;
      lf.rot += lf.vr * dt;
      if (lf.y > win.h + 12 || lf.x > win.w + 20 || lf.x < -20) Object.assign(lf, newLeaf(win, true));
      const color = evening > 0.6 ? "#3a2a2a" : lf.color;
      drawLeaf(g, lf.x, lf.y, lf.rot, lf.size, color, 0.9);
      // Odbicie: lustrzane, spłaszczone, blednące w głąb podłogi.
      const ry = (win.h - lf.y) * 0.32;
      if (ry >= 0 && ry < rh) drawLeaf(r, lf.x + 50, ry, -lf.rot, lf.size, color, 0.55 * (1 - ry / rh));
    });

    if (fx.motes) {
      const m = fx.motes.g;
      const sb = win.sunbeam;
      m.clearRect(0, 0, sb.w, sb.h);
      const vis = Math.max(0, 1 - evening * 2);
      fx.motes.c.style.opacity = String(vis);
      if (vis > 0) {
        for (const d of fx.dots) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.tw += dt * 1.7;
          if (d.y < -4) d.y = sb.h + 4;
          if (d.x < -4) d.x = sb.w + 4;
          if (d.x > sb.w + 4) d.x = -4;
          m.globalAlpha = 0.35 + 0.35 * Math.sin(d.tw);
          m.fillStyle = "#fff3cf";
          m.beginPath();
          m.arc(d.x, d.y, 1.3, 0, Math.PI * 2);
          m.fill();
        }
      }
    }
  }
}

// =========================================================================
// Lampa, kinkiety, kominek, zegar
// =========================================================================

let lampEls = null;
let fireEls = null;
let crackleTimer = null;

function applyLamp(on) {
  lampEls.light.classList.toggle("on", on);
}

function buildLamp() {
  const L = LAYOUT.interactables.lamp;
  const light = el("klimat-lampa-swiatlo", { x: L.shade.x - 260, y: L.shade.y - 120, w: 520, h: L.tableY - L.shade.y + 220 });
  light.innerHTML = `<div class="klosz"></div><div class="stozek"></div><div class="blat"></div>`;
  const hot = el("klimat-hotspot", L);
  hot.setAttribute("aria-label", "Lampa");
  lampEls = { light, hot };
  const k = klimatState();
  applyLamp(k.lamp);
  wireGesture(hot, {
    onTap: () => {
      k.lamp = !k.lamp;
      applyLamp(k.lamp);
      playSwitch();
      save();
    },
  });
}

function buildCandleHotspots() {
  const k = klimatState();
  for (const c of LAYOUT.candles) {
    const candleEl = api.candleEls[c.genre];
    if (!candleEl) continue;
    // Ręcznie ustawiony stan z zapisu (ukończony regał i tak zapala kinkiet sam).
    if (typeof k.candles[c.genre] === "boolean" && candleEl.classList.contains("lit") !== k.candles[c.genre]) {
      toggleCandle(c.genre);
    }
    const hot = el("klimat-hotspot klimat-hotspot-kinkiet", { x: c.x - 22, y: c.y - 16, w: 62, h: 80 });
    wireGesture(hot, {
      onTap: () => {
        k.candles[c.genre] = toggleCandle(c.genre);
        if (!k.candles[c.genre]) playSwitch();
        save();
      },
    });
  }
}

function applyFire(on, instant) {
  fireEls.fire.classList.toggle("on", on);
  fireEls.glow.classList.toggle("on", on);
  if (!on && !instant) {
    fireEls.fire.classList.add("dogasa");
    setTimeout(() => fireEls.fire.classList.remove("dogasa"), 4000);
  }
  scheduleCrackle();
}

function scheduleCrackle() {
  clearTimeout(crackleTimer);
  const k = klimatState();
  if (!k.fire || document.visibilityState !== "visible") return;
  const F = LAYOUT.interactables.fireplace;
  if (api.isXInView(F.x, F.w)) {
    noiseBurst({ gain: 0.018 + Math.random() * 0.03, dur: 0.02 + Math.random() * 0.05, freq: 1500 + Math.random() * 3500, q: 1.5 });
  }
  crackleTimer = setTimeout(scheduleCrackle, 90 + Math.random() * 420);
}

function buildFireplace() {
  const F = LAYOUT.interactables.fireplace;
  const glow = el("klimat-kominek-poswiata", { x: F.x - 260, y: F.y - 140, w: F.w + 520, h: 804 - (F.y - 140) });
  const fire = el("klimat-ogien", { x: F.x + 20, y: F.y + 40, w: F.w - 40, h: F.h - 40 });
  fire.innerHTML =
    `<div class="polana"></div><div class="polana p2"></div>` +
    Array.from({ length: 7 }, (_, i) => `<div class="plomien f${i}"></div>`).join("") +
    `<div class="zar"></div>`;
  const hot = el("klimat-hotspot", F);
  hot.setAttribute("aria-label", "Kominek");
  fireEls = { fire, glow, hot };
  const k = klimatState();
  applyFire(k.fire, true);
  wireGesture(hot, {
    onTap: () => {
      k.fire = !k.fire;
      if (k.fire) playWhoosh();
      applyFire(k.fire, false);
      save();
    },
  });
}

function buildClock() {
  const C = LAYOUT.interactables.clock;
  const hot = el("klimat-hotspot klimat-zegar", C);
  hot.setAttribute("aria-label", "Zegar");
  let busyUntil = 0;
  wireGesture(hot, {
    onTap: () => {
      const now = performance.now();
      if (now < busyUntil) return;
      const n = new Date().getHours() % 12 || 12;
      for (let i = 0; i < n; i++) {
        playBell(i * 1.4);
        setTimeout(() => {
          hot.classList.remove("bije");
          void hot.offsetWidth;
          hot.classList.add("bije");
        }, i * 1400);
      }
      busyUntil = now + n * 1400;
    },
  });
}

// =========================================================================
// Żyrandol — wahadło tłumione
// =========================================================================

const pend = { theta: 0, omega: 0, running: false, lastCross: 0 };
const PEND_W0 = (2 * Math.PI) / 2.4; // okres ~2,4 s
const PEND_DAMP = 0.85; // wygasa w ~6 s
const PEND_MAX = (12 * Math.PI) / 180;

function kickChandelier(dOmega) {
  pend.omega += dOmega;
  startPhysics();
}

function stepPendulum(dt) {
  const steps = 4;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const acc = -PEND_W0 * PEND_W0 * Math.sin(pend.theta) - PEND_DAMP * pend.omega;
    pend.omega += acc * h;
    const prev = pend.theta;
    pend.theta = Math.max(-PEND_MAX, Math.min(PEND_MAX, pend.theta + pend.omega * h));
    if (Math.abs(pend.theta) >= PEND_MAX) pend.omega *= -0.4; // miękkie odbicie na granicy wychylenia
    if (prev * pend.theta < 0 && Math.abs(pend.omega) > 0.12) {
      const now = performance.now();
      if (now - pend.lastCross > 250) {
        playCrystal(Math.min(1, Math.abs(pend.omega) / 0.8));
        pend.lastCross = now;
      }
    }
  }
  if (api.chandelierEl) api.chandelierEl.style.transform = `rotate(${pend.theta}rad)`;
  const resting = Math.abs(pend.theta) < 0.0008 && Math.abs(pend.omega) < 0.002;
  if (resting) {
    pend.theta = 0;
    pend.omega = 0;
    if (api.chandelierEl) api.chandelierEl.style.transform = "";
  }
  return !resting;
}

function buildChandelier() {
  const ch = api.chandelierEl;
  if (!ch) return;
  ch.classList.add("klimat-interaktywny");
  wireGesture(ch, {
    onTap: (tapX) => {
      const w = ch.getBoundingClientRect().width / sceneScale();
      const dir = tapX < w / 2 ? 1 : -1;
      kickChandelier(dir * 0.55);
    },
    onDrag: (dx, vx) => {
      kickChandelier((vx / 900) * 0.12);
    },
  });
}

// =========================================================================
// Zasłona — sprężyna z tłumieniem
// =========================================================================

const curtain = { d: 0, v: 0, dragging: false, startD: 0, el: null, img: null };
const CURT_K = Math.pow((2 * Math.PI) / 1.6, 2);
const CURT_C = 3.0;
const CURT_MAX = 150;

function applyCurtain() {
  const C = LAYOUT.interactables.curtain;
  const angle = Math.atan(curtain.d / C.h);
  const squeeze = 1 - Math.min(0.28, Math.abs(curtain.d) / 520);
  curtain.el.style.transform = `skewX(${angle}rad) scaleX(${squeeze})`;
  if (Math.abs(curtain.d) > C.revealAt && !api.state.hideoutsOpened.curtain) {
    openHideoutById("curtain");
    save();
  }
}

function stepCurtain(dt) {
  if (curtain.dragging) return true;
  const steps = 4;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const acc = -CURT_K * curtain.d - CURT_C * curtain.v;
    curtain.v += acc * h;
    curtain.d += curtain.v * h;
  }
  applyCurtain();
  const resting = Math.abs(curtain.d) < 0.2 && Math.abs(curtain.v) < 0.5;
  if (resting) {
    curtain.d = 0;
    curtain.v = 0;
    curtain.el.style.transform = "";
  }
  return !resting;
}

function buildCurtain() {
  const C = LAYOUT.interactables.curtain;
  const wrap = el("klimat-zaslona", C);
  wrap.innerHTML = `<img src="${C.image}" alt="" draggable="false">`;
  curtain.el = wrap;
  wireGesture(wrap, {
    onTap: (tapX) => {
      curtain.v += tapX < C.w / 2 ? 140 : -140;
      if (!api.state.hideoutsOpened.curtain) {
        openHideoutById("curtain");
        save();
      }
      startPhysics();
    },
    onDragStart: () => {
      curtain.dragging = true;
      curtain.startD = curtain.d;
      curtain.v = 0;
    },
    onDrag: (dx) => {
      curtain.d = Math.max(-CURT_MAX, Math.min(CURT_MAX, curtain.startD + dx));
      applyCurtain();
    },
    onDragEnd: () => {
      curtain.dragging = false;
      startPhysics();
    },
  });
}

// =========================================================================
// Jedna pętla animacji (okna + fizyka), ~30 kl./s, tylko gdy jest co robić
// =========================================================================

let rafId = null;
let lastT = 0;
let physicsActive = false;

function windowsInView() {
  return LAYOUT.windows.some((w) => api.isXInView(w.x - 60, w.w + 120));
}

function needsLoop() {
  return document.visibilityState === "visible" && (physicsActive || windowsInView());
}

function startPhysics() {
  physicsActive = true;
  ensureLoop();
}

function ensureLoop() {
  if (rafId || !needsLoop()) return;
  lastT = 0;
  rafId = requestAnimationFrame(tick);
}

function tick(ts) {
  rafId = null;
  if (!needsLoop()) return;
  if (!lastT) lastT = ts;
  const elapsed = ts - lastT;
  if (elapsed >= 30) {
    const dt = Math.min(0.05, elapsed / 1000);
    lastT = ts;
    stepWindows(dt, ts / 1000);
    const pendMoving = stepPendulum(dt);
    const curtMoving = stepCurtain(dt);
    physicsActive = pendMoving || curtMoving;
  }
  rafId = requestAnimationFrame(tick);
}

// =========================================================================
// Podpowiedzi przy pierwszym pojawieniu się w kadrze
// =========================================================================

const HINTS = [
  { key: "lampa", text: "Stuknij lampę, żeby ją zapalić.", rect: () => LAYOUT.interactables.lamp },
  { key: "kominek", text: "Stuknij kominek — rozpalisz ogień.", rect: () => LAYOUT.interactables.fireplace },
  { key: "zegar", text: "Zegar na kominku wybija godzinę — stuknij go.", rect: () => LAYOUT.interactables.clock },
  { key: "zyrandol", text: "Potrąć żyrandol palcem — rozkołysze się.", rect: () => LAYOUT.chandelier.sprite },
  { key: "zaslona", text: "Odsuń zasłonę palcem.", rect: () => LAYOUT.interactables.curtain },
];
let lastHintAt = 0;

function maybeHints() {
  const now = performance.now();
  if (now - lastHintAt < 4500) return;
  const shown = api.state.hintsShown || (api.state.hintsShown = {});
  for (const h of HINTS) {
    if (shown[h.key]) continue;
    const r = h.rect();
    if (!r) continue;
    const cx = r.x + r.w / 2;
    // Tylko gdy obiekt jest wyraźnie w kadrze (bez marginesu).
    const camX = api.getCamX();
    if (cx < camX + 80 || cx > camX + 1366 - 80) continue;
    shown[h.key] = true;
    lastHintAt = now;
    setTimeout(() => api.showMsgTip(h.text, api.worldToScreenX(cx), Math.max(90, r.y + 70), 3600), 1200);
    save();
    return;
  }
}

// =========================================================================
// Publiczne API
// =========================================================================

export function onCameraChange() {
  if (!api) return;
  ensureLoop();
  maybeHints();
  const F = LAYOUT.interactables.fireplace;
  if (fireEls) fireEls.fire.classList.toggle("in-view", api.isXInView(F.x, F.w));
}

export function initKlimat(worldApi, opts = {}) {
  api = worldApi;  pora = opts.pora || "auto";
  klimatState();
  refreshTimeOfDay();
  setInterval(refreshTimeOfDay, 60000);

  buildWindows();
  buildLamp();
  buildCandleHotspots();
  buildFireplace();
  buildClock();
  buildChandelier();
  buildCurtain();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshTimeOfDay();
      ensureLoop();
    }
    scheduleCrackle();
  });

  onCameraChange();
}
