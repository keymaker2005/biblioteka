// js/cienie.js
// Wersja 0.7 — cienie od ognia w kominku (wariant A „ray tracingu”: promienie liczone na płaszczyźnie).
// Ogień pali się w palenisku, czyli GŁĘBIEJ niż stoją meble, więc cienie padają na podłogę
// i dywan — od kominka w stronę widza. Dla każdego przedmiotu stojącego na podłodze liczymy
// promień od podstawy ognia przez jego „stopę” i przedłużamy go w cień. Długość rośnie
// z odległością i wysokością przedmiotu (jak prawdziwy cień od niskiego źródła), a ogień
// drga, więc cienie drgają razem z nim.
//
// Wydajność (iPad): małe płótno (RES = 0,35 piksela na piksel świata — rozmycie gratis
// przy powiększeniu), ~30 klatek/s i tylko wtedy, gdy ogień się pali, a kominek jest w kadrze.

import { LAYOUT } from "./layout.js";

const RES = 0.35;
const F = LAYOUT.interactables.fireplace;
const LIGHT = { x: F.x + F.w / 2, y: F.fireY }; // podstawa ognia (środek paleniska)
const AREA = { x: F.x - 760, y: 600, w: 1640, h: 204 }; // pas podłogi wokół kominka (świat)
const LIGHT_H = 180; // „wysokość” płomienia nad podłogą — im niżej, tym dłuższe cienie
const MAX_LEN = 270;
const REACH = 1100; // dalej ogień już nie rzuca widocznego cienia
const BASE_ALPHA = 0.85;
const GLOW_R = 720; // zasięg ciepłej plamy światła na podłodze
const GLOW_ALPHA = 0.3;
const FRAME_MS = 33;

// Nogi biurka (wymierzone na ilustracji 29.09): stopa = dolna krawędź nogi, h = wysokość nogi.
const B = LAYOUT.furniture.find((f) => f.id === "desk-3");
const STATIC_OCCLUDERS = [
  { x1: B.x + 89, x2: B.x + 118, y: B.y + 226, h: 136 }, // przednia lewa
  { x1: B.x + 332, x2: B.x + 363, y: B.y + 226, h: 136 }, // przednia prawa
  { x1: B.x + 23, x2: B.x + 45, y: B.y + 199, h: 109 }, // tylna lewa
  { x1: B.x + 380, x2: B.x + 402, y: B.y + 199, h: 109 }, // tylna prawa
];

let api = null;
let opts = null;
let canvas = null;
let g = null;
let raf = null;
let lastDraw = 0;
let fireOn = false;
let fadeUntil = 0;

function inView() {
  return api.isXInView(AREA.x, AREA.w);
}

function active() {
  return (fireOn || performance.now() < fadeUntil) && document.visibilityState === "visible" && inView();
}

function ensureLoop() {
  if (!raf && active()) raf = requestAnimationFrame(frame);
}

function frame(t) {
  raf = null;
  if (!active()) return;
  if (t - lastDraw >= FRAME_MS) {
    lastDraw = t;
    draw(t);
  }
  raf = requestAnimationFrame(frame);
}

// Migotanie: kilka nałożonych sinusów — tanie i bez widocznego powtarzania.
function flicker(t) {
  const i = 0.86 + 0.08 * Math.sin(t * 0.011) + 0.05 * Math.sin(t * 0.037 + 1.3) + 0.03 * Math.sin(t * 0.093 + 0.4);
  const dx = 5 * Math.sin(t * 0.013) + 3 * Math.sin(t * 0.051 + 2.1);
  return { i, x: LIGHT.x + dx, y: LIGHT.y };
}

function draw(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.setTransform(RES, 0, 0, RES, -AREA.x * RES, -AREA.y * RES);

  const L = flicker(t);
  const ev = 0.55 + 0.45 * (opts.getEvening ? opts.getEvening() : 0); // wieczorem ogień „rządzi” salą
  const occluders = STATIC_OCCLUDERS.concat(api.floorBooks ? api.floorBooks() : []);

  // 1) Ciepła plama światła na podłodze (elipsa — podłoga ucieka w głąb).
  g.save();
  g.translate(L.x, L.y + 40);
  g.scale(1, 0.42);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, GLOW_R);
  glow.addColorStop(0, `rgba(255, 170, 80, ${(GLOW_ALPHA * L.i * ev).toFixed(3)})`);
  glow.addColorStop(0.55, `rgba(255, 150, 60, ${(GLOW_ALPHA * 0.45 * L.i * ev).toFixed(3)})`);
  glow.addColorStop(1, "rgba(255, 140, 50, 0)");
  g.fillStyle = glow;
  g.fillRect(-GLOW_R, -GLOW_R, GLOW_R * 2, GLOW_R * 2);
  g.restore();

  // 2) Cienie: najpierw wycinamy w plamie światła „dziurę”, potem przyciemniamy.
  for (const pass of ["cut", "dark"]) {
    g.globalCompositeOperation = pass === "cut" ? "destination-out" : "source-over";
    for (const o of occluders) drawShadow(o, L, ev, pass);
  }
  g.globalCompositeOperation = "source-over";
}

function drawShadow(o, L, ev, pass) {
  const cx = (o.x1 + o.x2) / 2;
  const dx = cx - L.x;
  const dy = o.y - L.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30 || dist > REACH) return;
  const ux = dx / dist;
  const uy = dy / dist;
  const len = Math.min(MAX_LEN, (dist * o.h) / (LIGHT_H * 1.6)) * (0.92 + 0.08 * L.i);
  const alpha = pass === "cut" ? 1 : BASE_ALPHA * L.i * ev * Math.sqrt(1 - dist / REACH);
  if (alpha < 0.01) return;
  // Podłoga ucieka w głąb, więc ruch „w dół ekranu” skracamy o połowę (perspektywa).
  const fx = cx + ux * len;
  const fy = o.y + uy * len * 0.5;
  const hw = ((o.x2 - o.x1) / 2) * (1 + len / 240);
  const grad = g.createLinearGradient(cx, o.y, fx, fy);
  grad.addColorStop(0, `rgba(18, 7, 0, ${alpha.toFixed(3)})`);
  grad.addColorStop(1, "rgba(18, 7, 0, 0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(o.x1, o.y);
  g.lineTo(o.x2, o.y);
  g.lineTo(fx + hw, fy);
  g.lineTo(fx - hw, fy);
  g.closePath();
  g.fill();
}

/** Kominek zapalony/zgaszony (wołane z js/klimat.js). */
export function setFire(on) {
  fireOn = on;
  if (!canvas) return;
  canvas.classList.toggle("on", on);
  if (!on) fadeUntil = performance.now() + 1000; // rysujemy jeszcze chwilę, aż płótno zblednie
  ensureLoop();
}

/** Przesunięcie sali lub powrót do karty — wznawia rysowanie, gdy kominek wraca w kadr. */
export function onCameraChangeCienie() {
  if (api) ensureLoop();
}

export function initCienie(worldApi, options = {}) {
  api = worldApi;
  opts = options;
  canvas = document.createElement("canvas");
  canvas.className = "klimat-cienie";
  canvas.width = Math.round(AREA.w * RES);
  canvas.height = Math.round(AREA.h * RES);
  Object.assign(canvas.style, {
    left: `${AREA.x}px`,
    top: `${AREA.y}px`,
    width: `${AREA.w}px`,
    height: `${AREA.h}px`,
  });
  api.worldLayerEl.appendChild(canvas);
  g = canvas.getContext("2d");
  document.addEventListener("visibilitychange", ensureLoop);
}
