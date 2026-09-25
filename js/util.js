// js/util.js
// Drobne, czyste funkcje pomocnicze współdzielone przez js/game.js i js/world.js.
// Zero zależności, zero DOM.

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Deterministyczny generator liczb pseudolosowych (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Prosty hash tekstu (djb2), zawsze ten sam wynik dla tego samego napisu. */
export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0xff) + percent;
  let b = (num & 0xff) + percent;
  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Deterministyczna wariacja jasności okładki, zależna wyłącznie od id książki. */
export function brightnessVariant(id) {
  return (hashString(id) % 41) - 20; // -20..20
}

/** Deterministyczny kąt obrotu, zależny od tekstu (np. "rot-" + id). */
export function rotationFor(text, spread = 12) {
  return (hashString(text) % (spread * 10 + 1)) / 10 - spread / 2;
}

/** Ogranicza prostokąt (x,y,w,h) tak, by mieścił się w boundsW×boundsH z marginesem. */
export function clampRectToBounds(x, y, w, h, boundsW, boundsH, margin = 12) {
  const cx = clamp(x, margin, Math.max(margin, boundsW - margin - w));
  const cy = clamp(y, margin, Math.max(margin, boundsH - margin - h));
  return { x: cx, y: cy };
}

/**
 * Pozycjonuje dymek (już z ustawioną treścią i odsłonięty — trzeba go zmierzyć)
 * tak, by mieścił się w scenie boundsW×boundsH. Domyślnie próbuje pokazać się
 * NAD punktem zaczepienia (anchorX, anchorY); jeśli by się nie zmieścił,
 * przerzuca się pod spód. Zawsze dociska do krawędzi z marginesem `margin`.
 */
export function positionFloatingTip(el, anchorX, anchorY, opts = {}) {
  const { preferAbove = true, gap = 8, margin = 12, boundsW = 1366, boundsH = 1024 } = opts;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let y = preferAbove ? anchorY - h - gap : anchorY + gap;
  if (preferAbove && y < margin) {
    y = anchorY + gap; // nie mieści się nad — pokaż pod
  } else if (!preferAbove && y + h > boundsH - margin) {
    y = anchorY - h - gap; // nie mieści się pod — pokaż nad
  }
  const clamped = clampRectToBounds(anchorX - w / 2, y, w, h, boundsW, boundsH, margin);
  el.style.left = `${clamped.x}px`;
  el.style.top = `${clamped.y}px`;
}
