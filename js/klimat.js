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
// Żyrandol — wahadło, które można chwycić palcem (od 0.5)
// =========================================================================
// Swobodnie: θ'' = −ω0²·sin θ − c·θ'. Trzymany palcem: dodatkowa sprężyna ciągnie kąt
// do kierunku palca względem punktu zawieszenia (żyrandol „idzie za ręką” z bezwładnością),
// po puszczeniu buja się dalej z prędkością, jaką miał. Płomienie świec odchylają się
// przeciwnie do ruchu (bezwładność), kryształki dzwonią przy przejściu przez pion.

const pend = { theta: 0, omega: 0, lastCross: 0, held: false, target: 0, grabOffset: 0 };
const PEND_W0 = (2 * Math.PI) / 2.4; // okres ~2,4 s
const PEND_DAMP = 0.7;
const PEND_MAX = (25 * Math.PI) / 180;
const GRAB_K = 140;
const GRAB_C = 16;

function kickChandelier(dOmega) {
  pend.omega += dOmega;
  startPhysics();
}

function pivotScene() {
  const ch = LAYOUT.chandelier;
  return { x: ch.pivotX - api.getCamX(), y: ch.pivotY + 70 };
}

function pointerScene(e) {
  const scene = document.getElementById("scene");
  const r = scene.getBoundingClientRect();
  const s = r.width / 1366 || 1;
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
}

function fingerAngle(e) {
  const p = pivotScene();
  const f = pointerScene(e);
  return Math.atan2(p.x - f.x, f.y - p.y); // 0 = pionowo w dół; dodatni = w lewo (jak rotate w CSS)
}

function stepPendulum(dt) {
  const steps = 6;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    let acc = -PEND_W0 * PEND_W0 * Math.sin(pend.theta) - PEND_DAMP * pend.omega;
    if (pend.held) acc += GRAB_K * (pend.target - pend.theta) - GRAB_C * pend.omega;
    pend.omega += acc * h;
    const prev = pend.theta;
    pend.theta += pend.omega * h;
    if (Math.abs(pend.theta) > PEND_MAX) {
      pend.theta = Math.sign(pend.theta) * PEND_MAX;
      pend.omega *= -0.35; // miękkie odbicie na granicy wychylenia
    }
    if (prev * pend.theta < 0 && Math.abs(pend.omega) > 0.15) {
      const now = performance.now();
      if (now - pend.lastCross > 220) {
        playCrystal(Math.min(1, Math.abs(pend.omega) / 1.2));
        pend.lastCross = now;
      }
    }
  }
  const ch = api.chandelierEl;
  if (ch) {
    ch.style.transform = `rotate(${pend.theta}rad)`;
    const tilt = Math.max(-35, Math.min(35, -pend.omega * 22));
    ch.querySelectorAll(".chandelier-flame").forEach((f) => (f.style.rotate = `${tilt}deg`));
  }
  const resting = !pend.held && Math.abs(pend.theta) < 0.0008 && Math.abs(pend.omega) < 0.002;
  if (resting) {
    pend.theta = 0;
    pend.omega = 0;
    if (ch) {
      ch.style.transform = "";
      ch.querySelectorAll(".chandelier-flame").forEach((f) => (f.style.rotate = ""));
    }
  }
  return !resting;
}

function buildChandelier() {
  const ch = api.chandelierEl;
  if (!ch) return;
  ch.classList.add("klimat-interaktywny");
  let g = null;
  ch.addEventListener("pointerdown", (e) => {
    if (api.isDragging()) return;
    e.stopPropagation();
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    try {
      ch.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  });
  ch.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) {
      g.moved = true;
      pend.held = true;
      pend.grabOffset = fingerAngle(e) - pend.theta;
      startPhysics();
    }
    if (g.moved) {
      const t = fingerAngle(e) - pend.grabOffset;
      pend.target = Math.max(-PEND_MAX, Math.min(PEND_MAX, t));
    }
  });
  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    const moved = g.moved;
    g = null;
    pend.held = false;
    if (!moved) {
      // Stuknięcie = pchnięcie od strony palca.
      const p = pivotScene();
      const f = pointerScene(e);
      kickChandelier(f.x < p.x ? -0.9 : 0.9);
    } else {
      startPhysics();
    }
  };
  ch.addEventListener("pointerup", end);
  ch.addEventListener("pointercancel", end);
}

// =========================================================================
// Zasłona — wiszący materiał (od 0.5)
// =========================================================================
// Model łańcucha wiszącego pod własnym ciężarem: N węzłów w pionie, każdy ma poziome
// wychylenie u. Napięcie w danym miejscu = ciężar materiału poniżej, więc góra jest
// sztywniejsza, dół luźny — fala biegnie w dół i wraca jak w prawdziwej tkaninie.
// Góra przybita do karnisza, na 70% wysokości słabe przytrzymanie wiązania.
// Palec chwyta najbliższy węzeł i ciągnie go; reszta podąża przez napięcie.
// Rysowanie: obrazek zasłony pocięty na poziome paski przesuwane o u(y),
// z lekkim cieniowaniem fałd tam, gdzie materiał jest najbardziej wygięty.

const CURT_N = 28;
const CURT_G = 6500; // „grawitacja” dobrana tak, by podstawowy okres wahań był ~1,6 s
const CURT_DAMP = 1.3;
const CURT_TIE_K = 26;
const CURT_MAX = 170;
const CURT_MARGIN = 190;
const curtain = {
  u: new Float32Array(CURT_N),
  v: new Float32Array(CURT_N),
  grab: -1,
  grabTarget: 0,
  img: null,
  canvas: null,
  g: null,
  moving: false,
};

function curtainNodeAt(localY) {
  const C = LAYOUT.interactables.curtain;
  return Math.max(1, Math.min(CURT_N - 1, Math.round((localY / C.h) * (CURT_N - 1))));
}

function stepCurtain(dt) {
  if (!curtain.moving && curtain.grab < 0) return false;
  const C = LAYOUT.interactables.curtain;
  const dy = C.h / (CURT_N - 1);
  const tieIdx = Math.round(0.7 * (CURT_N - 1));
  const steps = Math.ceil(dt / 0.004);
  const h = dt / steps;
  const { u, v } = curtain;
  for (let s = 0; s < steps; s++) {
    for (let i = 1; i < CURT_N; i++) {
      const yUp = (i - 0.5) * dy;
      const tUp = CURT_G * (C.h - yUp);
      const tDown = i < CURT_N - 1 ? CURT_G * (C.h - (i + 0.5) * dy) : 0;
      const down = i < CURT_N - 1 ? u[i + 1] - u[i] : 0;
      let a = (tDown * down - tUp * (u[i] - u[i - 1])) / (dy * dy) - CURT_DAMP * v[i];
      if (i === tieIdx) a -= CURT_TIE_K * u[i];
      v[i] += a * h;
    }
    for (let i = 1; i < CURT_N; i++) u[i] += v[i] * h;
    if (curtain.grab > 0) {
      // Chwycony węzeł idzie za palcem (miękko, bez teleportacji).
      const j = curtain.grab;
      const du = curtain.grabTarget - u[j];
      v[j] = du / Math.max(h, 0.016);
      u[j] += du * Math.min(1, h * 30);
    }
    for (let i = 1; i < CURT_N; i++) u[i] = Math.max(-CURT_MAX, Math.min(CURT_MAX, u[i]));
  }
  drawCurtain();

  // Odsłonięcie kryjówki: dolna część materiału odsunięta wystarczająco daleko.
  let lower = 0;
  for (let i = tieIdx; i < CURT_N; i++) lower += Math.abs(u[i]);
  lower /= CURT_N - tieIdx;
  if (lower > C.revealAt && !api.state.hideoutsOpened.curtain) {
    openHideoutById("curtain");
    save();
  }

  let maxU = 0;
  let maxV = 0;
  for (let i = 0; i < CURT_N; i++) {
    maxU = Math.max(maxU, Math.abs(u[i]));
    maxV = Math.max(maxV, Math.abs(v[i]));
  }
  curtain.moving = curtain.grab > 0 || maxU > 0.25 || maxV > 1;
  if (!curtain.moving) {
    u.fill(0);
    v.fill(0);
    drawCurtain();
  }
  return curtain.moving;
}

function drawCurtain() {
  const { g, img } = curtain;
  if (!g || !img || !img.complete) return;
  const C = LAYOUT.interactables.curtain;
  const W = C.w + CURT_MARGIN * 2;
  g.clearRect(0, 0, W, C.h);
  const rows = 110;
  const rowH = C.h / rows;
  const srcRowH = img.naturalHeight / rows;
  const dy = C.h / (CURT_N - 1);
  const uAt = (y) => {
    const f = y / dy;
    const i = Math.min(CURT_N - 2, Math.floor(f));
    const t = f - i;
    return curtain.u[i] * (1 - t) + curtain.u[i + 1] * t;
  };
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const off = uAt(y + rowH / 2);
    g.drawImage(img, 0, r * srcRowH, img.naturalWidth, srcRowH + 0.6, CURT_MARGIN + off, y, C.w, rowH + 0.6);
    // Fałdy: im bardziej materiał wygięty, tym ciemniej (cień) — tylko na samej tkaninie.
    const slope = Math.abs(uAt(Math.min(C.h - 1, y + rowH)) - uAt(y)) / rowH;
    if (slope > 0.02) {
      g.save();
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = `rgba(20,0,0,${Math.min(0.28, slope * 0.9)})`;
      g.fillRect(CURT_MARGIN + off - 2, y, C.w + 4, rowH + 0.6);
      g.restore();
    }
  }
}

function buildCurtain() {
  const C = LAYOUT.interactables.curtain;
  const W = C.w + CURT_MARGIN * 2;
  const canvas = document.createElement("canvas");
  canvas.className = "klimat-zaslona";
  const res = 1.5;
  canvas.width = Math.round(W * res);
  canvas.height = Math.round(C.h * res);
  canvas.style.left = `${C.x - CURT_MARGIN}px`;
  canvas.style.top = `${C.y}px`;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${C.h}px`;
  api.worldLayerEl.appendChild(canvas);
  curtain.canvas = canvas;
  curtain.g = canvas.getContext("2d");
  curtain.g.scale(res, res);
  curtain.img = new Image();
  curtain.img.onload = drawCurtain;
  curtain.img.src = C.image;

  // Pole dotyku = sama zasłona (canvas ma szerokie przezroczyste marginesy na wychylenia).
  const hot = el("klimat-hotspot klimat-zaslona-dotyk", C);
  let g = null;
  hot.addEventListener("pointerdown", (e) => {
    if (api.isDragging()) return;
    e.stopPropagation();
    const f = pointerScene(e);
    const localY = f.y - 70 - C.y;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, fx0: f.x, node: curtainNodeAt(localY), moved: false };
    try {
      hot.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  });
  hot.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) {
      g.moved = true;
      curtain.grab = g.node;
      g.u0 = curtain.u[g.node];
      curtain.moving = true;
      startPhysics();
    }
    if (g.moved) {
      const f = pointerScene(e);
      curtain.grabTarget = Math.max(-CURT_MAX, Math.min(CURT_MAX, g.u0 + (f.x - g.fx0)));
    }
  });
  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    e.stopPropagation();
    const wasMoved = g.moved;
    const node = g.node;
    const fx = pointerScene(e).x;
    g = null;
    curtain.grab = -1;
    if (!wasMoved) {
      // Stuknięcie: pchnięcie materiału w miejscu dotyku, fala rozchodzi się w górę i w dół.
      const center = C.x - api.getCamX() + C.w / 2;
      const dir = fx < center ? 1 : -1;
      for (let i = 1; i < CURT_N; i++) curtain.v[i] += dir * 260 * Math.exp(-((i - node) * (i - node)) / 10);
      if (!api.state.hideoutsOpened.curtain) {
        openHideoutById("curtain");
        save();
      }
    }
    curtain.moving = true;
    startPhysics();
  };
  hot.addEventListener("pointerup", end);
  hot.addEventListener("pointercancel", end);
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
