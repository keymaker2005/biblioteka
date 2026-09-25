// js/world.js
// Sala jako przewijany świat 3720×804: budowa DOM (wnęki, meble zastępcze, regały,
// kryjówki, stosy, kartki, książki), przesuwanie widoku (przeciąganie + bezwładność +
// auto-przewijanie pod niesioną książką), przeciąganie książek/kartek, kurz i pajęczyny
// (przez js/dust.js), umieszczanie na regałach wg GATUNKU ze slotami i bonusem epoki.
//
// Współpraca z js/game.js: initWorld(state, hooks) mutuje `state` bezpośrednio
// (ten sam obiekt co w game.js) i wywołuje hooks.onChange() po każdej znaczącej
// zmianie (zapis + odświeżenie paska/minimapy/warunku zwycięstwa) oraz
// hooks.onCameraChange() przy każdej zmianie kamery (tylko odświeżenie minimapy).

import { LAYOUT, WORLD_W, WORLD_H } from "./layout.js";
import { BOOKS, EPOCH_BY_ID, GENRE_BY_ID, GENRE_ICONS } from "./books.js";
import { clamp, mulberry32, hashString, seededShuffle, shadeColor, escapeHtml, brightnessVariant } from "./util.js";
import { createWipeLayer } from "./dust.js";
import { createBasket } from "./basket.js";
import {
  playPlaceGood,
  playMistake,
  playShelfComplete,
  playDustGone,
  playWipe,
  playDrawer,
  playPaper,
  playCandle,
  playEpochBonus,
  playChronologyStar,
} from "./sound.js";

const LOGICAL_W = 1366;
const WORLD_VIEW_W = 1366;
const WORLD_VIEW_H = 804;
const EDGE_ZONE = 90;
const DRAG_THRESHOLD = 8;
const INERTIA_DECAY = 0.92;
const MAX_CAMX = Math.max(0, WORLD_W - WORLD_VIEW_W);

const BOOK_COVER_W = 72;
const BOOK_COVER_H = 100;
const BOOK_SPINE_W = 46;
const BOOK_SPINE_H = 148;
const PAGE_W = 40;
const PAGE_H = 52;

const INK_PLACE = 1;
const INK_EPOCH_BONUS = 1;
const INK_SHELF_COMPLETE = 5;
const INK_CHRONOLOGY = 5;
const INK_MAX = 20;

let state = null;
let hooks = { openBookModal() {}, onChange() {}, onCameraChange() {} };

// --- DOM ---------------------------------------------------------------
let sceneEl, worldViewportEl, worldLayerEl, dragLayerEl, darknessEl;
let cartEl, basketCounterEl, basketLayerEl;
let hoverTipEl, msgTipEl, shelfBannerEl;
let basket;

// --- Runtime ------------------------------------------------------------
const bookRuntime = new Map(); // id -> {id, book, el, location, x, y}
const pageRuntime = new Map(); // id -> {id, def, el}
let bookHomeSpot = new Map(); // bookId -> spot
let spotToBook = new Map(); // spotId -> bookId
let dustyBookIds = new Set();
const shelfElByGenre = {};
const shelfSlotElsByGenre = {}; // genre -> [slotEl,...]
const shelfOccupancy = {}; // genre -> [bookId|null,...]
const candleFlameByGenre = {};
const candleGlowByGenre = {};
const cobwebByGenre = {};
const hideoutElById = {};
let chandelierGlowEl = null;
let chandelierEl = null;
let folderEl = null;

let camX = 0;
let activeDrag = null; // {type:'book'|'page'|'pan', ...}
let inertiaRaf = null;
let autoScrollRaf = null;
let lastWipeSoundAt = 0;

// =========================================================================
// Geometria — konwersje współrzędnych
// =========================================================================

function sceneScale() {
  const r = sceneEl.getBoundingClientRect();
  return r.width / LOGICAL_W || 1;
}

function toSceneCoords(clientX, clientY) {
  const r = sceneEl.getBoundingClientRect();
  const scale = sceneScale();
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

function toWorldCoords(clientX, clientY) {
  const scale = sceneScale();
  const r = worldLayerEl.getBoundingClientRect();
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

function getLogicalRect(el) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const scale = sceneScale();
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - sceneRect.left) / scale,
    y: (r.top - sceneRect.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

function worldToScreenX(wx) {
  return wx - camX;
}

// =========================================================================
// Przydział książek do miejsc + kurz — deterministycznie z ziarna
// =========================================================================

function computeAssignment(seed) {
  const rngSpots = mulberry32(seed >>> 0);
  const bookIds = BOOKS.map((b) => b.id);
  const shuffledBooks = seededShuffle(bookIds, rngSpots);
  const spots = LAYOUT.spots;
  const homeSpot = new Map();
  const spotBook = new Map();
  shuffledBooks.forEach((id, i) => {
    const spot = spots[i];
    homeSpot.set(id, spot);
    spotBook.set(spot.id, id);
  });

  const rngDust = mulberry32((seed + 1) >>> 0);
  const nonHidden = shuffledBooks.filter((id) => homeSpot.get(id).kind !== "hidden");
  const dustyIds = new Set(seededShuffle(nonHidden, rngDust).slice(0, LAYOUT.dusty));

  return { homeSpot, spotBook, dustyIds };
}

// =========================================================================
// Regały — pomocnicze
// =========================================================================

function shelfSlotCenter(shelf, slotIndex) {
  const slot = shelf.slots[slotIndex];
  return { cx: shelf.x + slot.fx * shelf.w, cyBottom: shelf.y + slot.fy * shelf.h, epoch: slot.epoch };
}

function findNearestFreeSlot(shelf, genre, worldPt) {
  const occ = shelfOccupancy[genre];
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < shelf.slots.length; i++) {
    if (occ[i]) continue;
    const c = shelfSlotCenter(shelf, i);
    const d = Math.hypot(c.cx - worldPt.x, c.cyBottom - worldPt.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function shelfAt(worldPt) {
  for (const shelf of LAYOUT.shelves) {
    if (worldPt.x >= shelf.x && worldPt.x <= shelf.x + shelf.w && worldPt.y >= shelf.y && worldPt.y <= shelf.y + shelf.h) {
      return shelf;
    }
  }
  return null;
}

function isShelfFull(genre) {
  return shelfOccupancy[genre].every((b) => b !== null);
}

// =========================================================================
// Statystyki (czysta funkcja — może być wołana z game.js bez dostępu do DOM)
// =========================================================================

export function computeStats(st) {
  let placedBooks = 0;
  let goodEpoch = 0;
  for (const book of BOOKS) {
    const rec = st.books[book.id];
    if (rec && rec.where === "shelf") {
      placedBooks++;
      const shelf = LAYOUT.shelfByGenre[book.genre];
      const slot = shelf && shelf.slots[rec.shelfSlot];
      if (slot && slot.epoch === book.epoch) goodEpoch++;
    }
  }
  const dustCleared = st.dustCleared.length;
  const cobwebsCleared = st.cobwebsCleared.length;
  const pagesFiled = st.pagesFiled.length;
  const points = placedBooks * 2 + dustCleared * 1 + cobwebsCleared * 2 + pagesFiled * 1;
  const totalPoints = BOOKS.length * 2 + LAYOUT.dusty * 1 + LAYOUT.cobwebs.length * 2 + LAYOUT.pages.length * 1;
  const percent = totalPoints > 0 ? Math.round((points / totalPoints) * 100) : 0;

  const chronologyGenres = [];
  for (const shelf of LAYOUT.shelves) {
    const booksOfGenre = BOOKS.filter((b) => b.genre === shelf.genre);
    const allPlaced = booksOfGenre.every((b) => st.books[b.id] && st.books[b.id].where === "shelf");
    if (!allPlaced) continue;
    const allGood = booksOfGenre.every((b) => {
      const rec = st.books[b.id];
      const slot = shelf.slots[rec.shelfSlot];
      return slot && slot.epoch === b.epoch;
    });
    if (allGood) chronologyGenres.push(shelf.genre);
  }

  return {
    placedBooks,
    totalBooks: BOOKS.length,
    goodEpoch,
    dustCleared,
    totalDusty: LAYOUT.dusty,
    cobwebsCleared,
    totalCobwebs: LAYOUT.cobwebs.length,
    pagesFiled,
    totalPages: LAYOUT.pages.length,
    percent: clamp(percent, 0, 100),
    chronologyGenres,
  };
}

const DARKNESS_MAX = 0.55;

function applyDarknessOpacity() {
  const stats = computeStats(state);
  if (darknessEl) darknessEl.style.opacity = String(DARKNESS_MAX * (1 - stats.percent / 100));
}

/** Aktualizuje krycie ciemności nad światem wg procentu porządku, potem woła hooks.onChange(). */
function notifyChange() {
  applyDarknessOpacity();
  hooks.onChange();
}

// =========================================================================
// Budowa DOM świata
// =========================================================================

function cacheDom() {
  sceneEl = document.getElementById("scene");
  worldViewportEl = document.getElementById("world-viewport");
  worldLayerEl = document.getElementById("world-layer");
  dragLayerEl = document.getElementById("drag-layer");
  darknessEl = document.getElementById("darkness");
  cartEl = document.getElementById("cart");
  basketCounterEl = document.getElementById("basket-counter");
  basketLayerEl = document.getElementById("basket-layer");
  hoverTipEl = document.getElementById("hover-tip");
  msgTipEl = document.getElementById("msg-tip");
  shelfBannerEl = document.getElementById("shelf-banner");
}

function genreIconHtml(genreId, cls) {
  const genre = GENRE_BY_ID[genreId];
  return `<span class="${cls}">${GENRE_ICONS[genre.icon]}</span>`;
}

function buildBays() {
  for (const bay of LAYOUT.bays) {
    const bayEl = document.createElement("div");
    bayEl.className = "bay";
    bayEl.dataset.bayId = bay.id;
    bayEl.style.left = `${bay.x}px`;
    bayEl.style.width = `${bay.width}px`;
    bayEl.innerHTML = `<div class="bay-fallback"><div class="bay-wall"></div><div class="bay-floor"></div></div>`;
    worldLayerEl.appendChild(bayEl);

    const img = new Image();
    img.onload = () => {
      bayEl.style.backgroundImage = `url("${bay.image}")`;
      bayEl.classList.add("has-image");
      // Meble zastępcze tej konkretnej wnęki znikają — na ilustracji już są.
      worldLayerEl.querySelectorAll(".furniture").forEach((el) => {
        const fx = parseFloat(el.style.left);
        if (fx >= bay.x && fx < bay.x + bay.width) el.classList.add("furniture-hidden");
      });
    };
    img.onerror = () => {
      /* brak ilustracji — zostaje zastępcze CSS tło */
    };
    img.src = bay.image;
  }

  // Pilastry między wnękami (maskują styk teł).
  for (let i = 1; i < LAYOUT.bays.length; i++) {
    const bay = LAYOUT.bays[i];
    const pil = document.createElement("div");
    pil.className = "pilaster";
    pil.style.left = `${bay.x - LAYOUT.pilasterWidth / 2}px`;
    pil.style.width = `${LAYOUT.pilasterWidth}px`;
    worldLayerEl.appendChild(pil);
  }
}

function buildFurnitureFallback() {
  for (const f of LAYOUT.furniture) {
    const el = document.createElement("div");
    el.className = `furniture furniture-${f.id.replace(/-\d+$/, "")}`;
    el.dataset.furnitureId = f.id;
    el.style.left = `${f.x}px`;
    el.style.top = `${f.y}px`;
    el.style.width = `${f.w}px`;
    el.style.height = `${f.h}px`;
    el.innerHTML = `<span class="furniture-label">${escapeHtml(f.label)}</span>`;
    worldLayerEl.appendChild(el);
  }
}

function buildShelves() {
  for (const shelf of LAYOUT.shelves) {
    const genre = GENRE_BY_ID[shelf.genre];
    const el = document.createElement("div");
    el.className = "shelf";
    el.dataset.genre = shelf.genre;
    el.style.left = `${shelf.x}px`;
    el.style.top = `${shelf.y}px`;
    el.style.width = `${shelf.w}px`;
    el.style.height = `${shelf.h}px`;

    const slotsHtml = shelf.slots
      .map((slot, i) => {
        const epoch = EPOCH_BY_ID[slot.epoch];
        return `<div class="shelf-slot" data-slot="${i}" style="left:${slot.fx * 100}%;top:${slot.fy * 100}%">
          <div class="slot-badge" data-epoch="${slot.epoch}" style="background:${epoch.baseColor}"></div>
        </div>`;
      })
      .join("");

    el.innerHTML = `
      <div class="shelf-plaque">
        ${genreIconHtml(shelf.genre, "plaque-icon")}
        <span class="plaque-name">${escapeHtml(genre.name)}</span>
        <span class="plaque-star hidden" title="Ład chronologiczny">★</span>
      </div>
      <div class="shelf-body">${slotsHtml}</div>
    `;
    worldLayerEl.appendChild(el);
    shelfElByGenre[shelf.genre] = el;
    shelfSlotElsByGenre[shelf.genre] = Array.from(el.querySelectorAll(".shelf-slot"));
    shelfOccupancy[shelf.genre] = new Array(shelf.slots.length).fill(null);

    if (shelf.image) {
      const img = new Image();
      img.onload = () => {
        el.style.backgroundImage = `url("${shelf.image}")`;
        el.classList.add("has-image");
      };
      img.onerror = () => {
        /* brak ilustracji — zostaje zastępczy wygląd CSS */
      };
      img.src = shelf.image;
    }

    // Hover na plakietce epoki pokazuje jej nazwę (rysik/mysz, bez wciśniętego przycisku).
    shelfSlotElsByGenre[shelf.genre].forEach((slotEl, i) => {
      const badge = slotEl.querySelector(".slot-badge");
      badge.addEventListener("pointermove", (e) => {
        if (e.buttons !== 0 || (e.pointerType !== "pen" && e.pointerType !== "mouse")) return;
        const epoch = EPOCH_BY_ID[shelf.slots[i].epoch];
        const r = getLogicalRect(badge);
        showHoverHtml(`<strong>${escapeHtml(epoch.name)}</strong>`, r.x + r.width / 2, r.y - 4);
      });
      badge.addEventListener("pointerleave", hideHoverTip);
    });
  }
}

function buildCandlesAndChandelier() {
  for (const c of LAYOUT.candles) {
    const el = document.createElement("div");
    el.className = "candle";
    el.style.left = `${c.x}px`;
    el.style.top = `${c.y}px`;
    el.innerHTML = `<div class="candle-body"></div><div class="candle-flame"></div>`;
    worldLayerEl.appendChild(el);
    candleFlameByGenre[c.genre] = el;

    const glow = document.createElement("div");
    glow.className = "glow-spot";
    darknessEl.appendChild(glow);
    candleGlowByGenre[c.genre] = { el: glow, x: c.x, y: c.y };
  }

  const chEl = document.createElement("div");
  chEl.className = "chandelier";
  chEl.style.left = `${LAYOUT.chandelier.x}px`;
  chEl.style.top = `${LAYOUT.chandelier.y}px`;
  if (LAYOUT.chandelier.painted) {
    // Żyrandol jest namalowany na ilustracji — dokładamy tylko płomienie na czubkach jego świec.
    chEl.classList.add("painted");
    chEl.innerHTML = (LAYOUT.chandelier.flames || [])
      .map((f) => `<div class="chandelier-flame" style="left:${f.x - LAYOUT.chandelier.x}px;top:${f.y - LAYOUT.chandelier.y}px"></div>`)
      .join("");
  } else {
    chEl.innerHTML = `<div class="chandelier-frame"></div>`;
  }
  worldLayerEl.appendChild(chEl);
  chandelierEl = chEl;

  chandelierGlowEl = document.createElement("div");
  chandelierGlowEl.className = "glow-spot glow-spot-big";
  darknessEl.appendChild(chandelierGlowEl);
}

function repositionGlows() {
  for (const genre in candleGlowByGenre) {
    const g = candleGlowByGenre[genre];
    g.el.style.left = `${worldToScreenX(g.x)}px`;
    g.el.style.top = `${g.y}px`;
  }
  if (chandelierGlowEl) {
    chandelierGlowEl.style.left = `${worldToScreenX(LAYOUT.chandelier.x)}px`;
    chandelierGlowEl.style.top = `${LAYOUT.chandelier.y}px`;
  }
}

function buildCobwebs() {
  for (const cw of LAYOUT.cobwebs) {
    const shelfEl = shelfElByGenre[cw.genre];
    const host = document.createElement("div");
    host.className = `cobweb-host cobweb-${cw.corner}`;
    shelfEl.appendChild(host);
    cobwebByGenre[cw.genre] = { host, cleared: false };
  }
}

function attachCobweb(genre) {
  const entry = cobwebByGenre[genre];
  if (!entry || entry.layer) return;
  entry.layer = createWipeLayer(entry.host, {
    width: 110,
    height: 110,
    cols: 6,
    rows: 6,
    threshold: 0.7,
    radius: 13,
    texture: "cobweb",
    onCleared: () => {
      if (!state.cobwebsCleared.includes(genre)) state.cobwebsCleared.push(genre);
      playDustGone();
      notifyChange();
    },
    onWipeTick: throttledWipeSound,
  });
}

function buildHideouts() {
  for (const h of LAYOUT.hideouts) {
    const el = document.createElement("div");
    el.className = `hideout hideout-${h.type}`;
    el.dataset.hideoutId = h.id;
    el.style.left = `${h.x}px`;
    el.style.top = `${h.y}px`;
    el.style.width = `${h.w}px`;
    el.style.height = `${h.h}px`;
    el.innerHTML = `<span class="hideout-sparkle">✨</span>`;
    worldLayerEl.appendChild(el);
    hideoutElById[h.id] = el;
  }
}

function buildFolder() {
  const el = document.createElement("div");
  el.id = "folder";
  el.style.left = `${LAYOUT.folder.x}px`;
  el.style.top = `${LAYOUT.folder.y}px`;
  el.style.width = `${LAYOUT.folder.w}px`;
  el.style.height = `${LAYOUT.folder.h}px`;
  el.innerHTML = `<span class="folder-label">Teczka</span><span class="folder-counter">0/${LAYOUT.pages.length}</span>`;
  worldLayerEl.appendChild(el);
  folderEl = el;
}

function updateFolderCounter() {
  if (!folderEl) return;
  folderEl.querySelector(".folder-counter").textContent = `${state.pagesFiled.length}/${LAYOUT.pages.length}`;
}

function buildPages() {
  for (const p of LAYOUT.pages) {
    if (state.pagesFiled.includes(p.id)) continue;
    const el = document.createElement("div");
    el.className = "page-item no-anim";
    el.dataset.pageId = p.id;
    applyTransform(el, p.x - PAGE_W / 2, p.y - PAGE_H / 2, p.rot, 1);
    worldLayerEl.appendChild(el);
    pageRuntime.set(p.id, { id: p.id, def: p, el });
  }
}

// =========================================================================
// Książki — budowa i (re)pozycjonowanie
// =========================================================================

function applyTransform(el, x, y, rotDeg, scale) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rotDeg}deg) scale(${scale})`;
}

function coverInnerHtml(book) {
  return (
    `<div class="cover-inner">` +
    `<div class="cover-frame"></div>` +
    genreIconHtml(book.genre, "cover-genre-icon") +
    `<span class="cover-title">${escapeHtml(book.title)}</span>` +
    `<span class="cover-author">${escapeHtml(book.author)}</span>` +
    `</div>`
  );
}

function spineInnerHtml(book) {
  return (
    `<span class="spine-title">${escapeHtml(book.title)}</span>` +
    genreIconHtml(book.genre, "spine-genre-icon")
  );
}

function bookColor(book) {
  return shadeColor(EPOCH_BY_ID[book.epoch].baseColor, brightnessVariant(book.id));
}

function isOpenVariant(bookId) {
  return hashString(bookId) % 3 === 0;
}

function hideoutLanding(hideout, index) {
  const x = clamp(hideout.x + hideout.w + 30 + index * 70, BOOK_COVER_W, WORLD_W - BOOK_COVER_W);
  const y = clamp(hideout.y + hideout.h - 10, BOOK_COVER_H, WORLD_H - BOOK_COVER_H);
  return { x, y };
}

function worldPosForBook(id) {
  const spot = bookHomeSpot.get(id);
  if (spot.kind === "hidden") {
    if (!state.hideoutsOpened[spot.hideoutId]) return null; // jeszcze niewidoczna
    const hideout = LAYOUT.hideouts.find((h) => h.id === spot.hideoutId);
    const pos = hideoutLanding(hideout, spot.hideoutIndex);
    return { x: pos.x, y: pos.y, rot: 0 };
  }
  return { x: spot.x, y: spot.y, rot: spot.rot };
}

function buildBooksInWorld() {
  for (const book of BOOKS) {
    const rec = state.books[book.id];
    const el = document.createElement("div");
    el.className = "book-item book-cover no-anim";
    el.dataset.bookId = book.id;
    el.style.background = bookColor(book);
    el.innerHTML = coverInnerHtml(book);
    if (isOpenVariant(book.id)) el.classList.add("open-variant");

    const rt = { id: book.id, book, el, location: rec.where, x: 0, y: 0 };
    bookRuntime.set(book.id, rt);

    if (rec.where === "shelf") {
      renderBookOnShelf(rt, rec.shelfSlot, true);
      shelfOccupancy[book.genre][rec.shelfSlot] = book.id;
    } else if (rec.where === "basket") {
      renderBookInBasket(rt, rec.basketSlot, true);
      basket.assign(rec.basketSlot, book.id);
    } else {
      const pos = worldPosForBook(book.id);
      if (pos) {
        rt.x = pos.x;
        rt.y = pos.y;
        applyTransform(el, pos.x - bookWidth(rt) / 2, pos.y - BOOK_COVER_H / 2, pos.rot, 1);
        // W stosie musi malować się na wierzchu ten o wyższym indeksie (widoczna "góra" stosu),
        // niezależnie od kolejności książek w BOOKS — inaczej losowa książka spod spodu
        // przesłoniłaby wizualnie i w hit-testingu tę faktycznie dostępną.
        const homeSpot = bookHomeSpot.get(book.id);
        if (homeSpot.kind === "stack") el.style.zIndex = String(12 + homeSpot.stackIndex);
        worldLayerEl.appendChild(el);
        maybeAttachDust(rt);
      } else {
        rt.hiddenAway = true; // w kryjówce, jeszcze niewidoczna
      }
    }
  }
  refreshStackAccessibility();
}

// Grzbiet ma rozmiar zależny od regału (musi zmieścić się w przegródce na ilustracji).
function spineSize(rt) {
  const shelf = LAYOUT.shelfByGenre[rt.book.genre];
  return { w: shelf.spineW ?? BOOK_SPINE_W, h: shelf.spineH ?? BOOK_SPINE_H };
}

function bookWidth(rt) {
  return rt.location === "shelf" ? spineSize(rt).w : BOOK_COVER_W;
}

function renderBookOnShelf(rt, slotIndex, initial) {
  const shelf = LAYOUT.shelfByGenre[rt.book.genre];
  const c = shelfSlotCenter(shelf, slotIndex);
  rt.location = "shelf";
  rt.x = c.cx;
  rt.y = c.cyBottom;
  if (rt.el.classList.contains("book-cover")) {
    rt.el.classList.remove("book-cover", "open-variant");
    rt.el.classList.add("book-spine");
    rt.el.innerHTML = spineInnerHtml(rt.book);
  }
  if (initial) rt.el.classList.add("no-anim");
  const sp = spineSize(rt);
  rt.el.style.width = `${sp.w}px`;
  rt.el.style.height = `${sp.h}px`;
  applyTransform(rt.el, c.cx - sp.w / 2, c.cyBottom - sp.h, 0, 1);
  if (rt.el.parentElement !== worldLayerEl) worldLayerEl.appendChild(rt.el);
  updateSlotVisual(shelf.genre, slotIndex, true);
}

function renderBookInBasket(rt, slotIndex, initial) {
  const { cx, cy } = basket.slotCenter(slotIndex);
  rt.location = "basket";
  rt.x = cx;
  rt.y = cy;
  if (initial) rt.el.classList.add("no-anim");
  applyTransform(rt.el, cx - BOOK_COVER_W / 2, cy - BOOK_COVER_H / 2, 0, 1);
  if (rt.el.parentElement !== basketLayerEl) basketLayerEl.appendChild(rt.el);
}

function updateSlotVisual(genre, slotIndex, filled) {
  const slotEl = shelfSlotElsByGenre[genre][slotIndex];
  slotEl.classList.toggle("filled", filled);
}

// =========================================================================
// Kurz — dołączanie warstwy przecierania
// =========================================================================

function throttledWipeSound() {
  const now = performance.now();
  if (now - lastWipeSoundAt > 100) {
    lastWipeSoundAt = now;
    playWipe();
  }
}

function maybeAttachDust(rt) {
  if (rt.location !== "world") return;
  if (!dustyBookIds.has(rt.id)) return;
  if (state.dustCleared.includes(rt.id)) return;
  if (rt.wipeLayer) return;
  if (!isBookAccessible(rt.id)) return;

  rt.el.classList.add("dusty");
  rt.wipeLayer = createWipeLayer(rt.el, {
    width: bookWidth(rt),
    height: BOOK_COVER_H,
    cols: 6,
    rows: 8,
    threshold: 0.7,
    radius: 11,
    texture: "dust",
    onCleared: () => {
      state.dustCleared.push(rt.id);
      rt.el.classList.remove("dusty");
      playDustGone();
      rt.wipeLayer = null;
      notifyChange();
    },
    onWipeTick: throttledWipeSound,
  });
}

// =========================================================================
// Stosy — dostępność górnej książki
// =========================================================================

function refreshStackAccessibility() {
  for (const stack of LAYOUT.stacks) {
    let topIndex = -1;
    for (let i = stack.size - 1; i >= 0; i--) {
      const spotId = `${stack.id}-${i}`;
      const bookId = spotToBook.get(spotId);
      const rec = state.books[bookId];
      if (rec && rec.where === "world") {
        topIndex = i;
        break;
      }
    }
    if (topIndex >= 0) {
      const spotId = `${stack.id}-${topIndex}`;
      const bookId = spotToBook.get(spotId);
      const rt = bookRuntime.get(bookId);
      if (rt) maybeAttachDust(rt);
    }
  }
}

function isBookAccessible(bookId) {
  const spot = bookHomeSpot.get(bookId);
  if (spot.kind !== "stack") return true;
  const stack = LAYOUT.stacks.find((s) => s.id === spot.stackId);
  for (let i = stack.size - 1; i > spot.stackIndex; i--) {
    const otherId = spotToBook.get(`${stack.id}-${i}`);
    const rec = state.books[otherId];
    if (rec && rec.where === "world") return false; // ktoś wyżej wciąż leży
  }
  return true;
}

// =========================================================================
// Dymki / banery
// =========================================================================

let hoverHideTimer = null;
function showHoverHtml(html, screenX, screenY) {
  hoverTipEl.innerHTML = html;
  hoverTipEl.style.left = `${screenX}px`;
  hoverTipEl.style.top = `${screenY}px`;
  hoverTipEl.classList.remove("hidden");
  clearTimeout(hoverHideTimer);
}
function hideHoverTip() {
  hoverTipEl.classList.add("hidden");
}

let msgTipTimer = null;
function showMsgTip(text, screenX, screenY) {
  msgTipEl.textContent = text;
  msgTipEl.style.left = `${screenX}px`;
  msgTipEl.style.top = `${screenY}px`;
  msgTipEl.classList.remove("hidden");
  clearTimeout(msgTipTimer);
  msgTipTimer = setTimeout(() => msgTipEl.classList.add("hidden"), 2000);
}

let bannerTimer = null;
let bannerQueue = [];
function showBanner(text) {
  bannerQueue.push(text);
  if (bannerQueue.length === 1) playNextBanner();
}
function playNextBanner() {
  if (bannerQueue.length === 0) return;
  shelfBannerEl.textContent = bannerQueue[0];
  shelfBannerEl.classList.remove("hidden");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    shelfBannerEl.classList.add("hidden");
    bannerQueue.shift();
    if (bannerQueue.length > 0) setTimeout(playNextBanner, 350);
  }, 2200);
}

function spawnFloatingLabel(worldX, worldY, text, extraClass) {
  const el = document.createElement("div");
  el.className = `ink-droplet${extraClass ? ` ${extraClass}` : ""}`;
  el.textContent = text;
  el.style.left = `${worldX}px`;
  el.style.top = `${worldY}px`;
  worldLayerEl.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// =========================================================================
// Umieszczanie książek: koszyk / regał / gdzie indziej
// =========================================================================

function addInk(amount) {
  state.ink = clamp(state.ink + amount, 0, INK_MAX);
}

function placeBookInBasket(rt) {
  const idx = basket.findFreeSlot();
  basket.assign(idx, rt.id);
  state.books[rt.id] = { where: "basket", basketSlot: idx, shelfSlot: null };
  renderBookInBasket(rt, idx, false);
  playPlaceGood();
  refreshStackAccessibility();
  notifyChange();
}

function placeBookOnShelf(rt, shelf, worldPt) {
  const slotIndex = findNearestFreeSlot(shelf, shelf.genre, worldPt);
  if (slotIndex === -1) {
    rejectDrop(rt, shelf, "Ten regał jest już pełny.");
    return;
  }
  const fromBasketSlot = rt.location === "basket" ? state.books[rt.id].basketSlot : null;
  state.books[rt.id] = { where: "shelf", shelfSlot: slotIndex, basketSlot: null };
  if (fromBasketSlot !== null) basket.clear(fromBasketSlot);

  renderBookOnShelf(rt, slotIndex, false);
  shelfOccupancy[shelf.genre][slotIndex] = rt.id;

  addInk(INK_PLACE);
  playPlaceGood();
  spawnFloatingLabel(shelf.x + shelf.w / 2, shelf.y - 6, `+${INK_PLACE}`);

  const slot = shelf.slots[slotIndex];
  const goodEpoch = slot.epoch === rt.book.epoch;
  if (goodEpoch) {
    addInk(INK_EPOCH_BONUS);
    playEpochBonus();
    spawnFloatingLabel(shelf.x + shelf.w / 2, shelf.y - 30, "✦ Dobra epoka!", "epoch-bonus");
  }

  refreshStackAccessibility();

  if (isShelfFull(shelf.genre) && !state.completedShelves.includes(shelf.genre)) {
    state.completedShelves.push(shelf.genre);
    addInk(INK_SHELF_COMPLETE);
    playShelfComplete();
    shelfElByGenre[shelf.genre].classList.add("complete");
    lightCandle(shelf.genre);
    showBanner(`Regał «${GENRE_BY_ID[shelf.genre].name}» uporządkowany!`);

    const stats = computeStats(state);
    if (stats.chronologyGenres.includes(shelf.genre)) {
      addInk(INK_CHRONOLOGY);
      playChronologyStar();
      shelfElByGenre[shelf.genre].querySelector(".plaque-star").classList.remove("hidden");
      showBanner("Ład chronologiczny!");
    }
  }

  notifyChange();
}

function lightCandle(genre) {
  const el = candleFlameByGenre[genre];
  if (el) el.classList.add("lit");
  const glow = candleGlowByGenre[genre];
  if (glow) glow.el.classList.add("lit-visible");
  playCandle();
}

function lightChandelier() {
  if (chandelierEl) chandelierEl.classList.add("lit");
  if (chandelierGlowEl) chandelierGlowEl.classList.add("lit-visible");
}

function rejectDrop(rt, shelf, message) {
  state.mistakes++;
  playMistake();
  const shelfEl = shelfElByGenre[shelf.genre];
  shelfEl.classList.add("shake");
  setTimeout(() => shelfEl.classList.remove("shake"), 450);
  const screenX = worldToScreenX(shelf.x + shelf.w / 2);
  showMsgTip(message, screenX, shelf.y - 6);
  returnBookHome(rt);
  notifyChange();
}

function returnBookHome(rt) {
  if (rt.location === "basket") {
    const idx = state.books[rt.id].basketSlot;
    renderBookInBasket(rt, idx, false);
  } else {
    const pos = worldPosForBook(rt.id);
    rt.location = "world";
    if (pos) {
      rt.x = pos.x;
      rt.y = pos.y;
      applyTransform(rt.el, pos.x - bookWidth(rt) / 2, pos.y - BOOK_COVER_H / 2, pos.rot, 1);
      if (rt.el.parentElement !== worldLayerEl) worldLayerEl.appendChild(rt.el);
    }
  }
}

// =========================================================================
// Karta książki
// =========================================================================

function openBookCard(bookId) {
  hooks.openBookModal(bookId);
}

// =========================================================================
// Przeciąganie: książki, kartki, panoramowanie
// =========================================================================

function cancelInertia() {
  if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
  inertiaRaf = null;
}
function cancelAutoScroll() {
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
  autoScrollRaf = null;
}

export function setCamX(x, opts = {}) {
  cancelInertia();
  camX = clamp(x, 0, MAX_CAMX);
  state.camX = camX;
  worldLayerEl.style.transform = `translateX(${-camX}px)`;
  repositionGlows();
  if (!opts.silent) hooks.onCameraChange();
}

function autoScrollTick(clientX) {
  const scenePt = toSceneCoords(clientX, 0);
  let dir = 0;
  let speed = 0;
  if (scenePt.x < EDGE_ZONE) {
    dir = -1;
    speed = (EDGE_ZONE - scenePt.x) / EDGE_ZONE;
  } else if (scenePt.x > WORLD_VIEW_W - EDGE_ZONE) {
    dir = 1;
    speed = (scenePt.x - (WORLD_VIEW_W - EDGE_ZONE)) / EDGE_ZONE;
  }
  if (dir === 0) {
    cancelAutoScroll();
    return;
  }
  setCamX(camX + dir * speed * 18);
  autoScrollRaf = requestAnimationFrame(() => autoScrollTick(clientX));
}

function maybeAutoScroll(clientX) {
  const scenePt = toSceneCoords(clientX, 0);
  const nearEdge = scenePt.x < EDGE_ZONE || scenePt.x > WORLD_VIEW_W - EDGE_ZONE;
  if (nearEdge && !autoScrollRaf) {
    autoScrollTick(clientX);
  } else if (!nearEdge) {
    cancelAutoScroll();
  }
}

// --- Panoramowanie sali --------------------------------------------------
//
// Uwaga architektoniczna: pointerdown na książce/kartce/kryjówce jest wykrywany
// w JEDNYM, wspólnym handlerze na poziomie sceny (onScenePointerDown) — patrz
// niżej — bo te elementy żyją w trzech różnych poddrzewach DOM (#world-layer,
// #basket-layer, #drag-layer) zależnie od tego, gdzie akurat są, a dawny podział
// „osobny listener na world-viewport (pan) + osobny na world-layer (książki)”
// nie widział wcale zdarzeń z koszyka i psuł się przy przenoszeniu do drag-layer.

function startPan(e) {
  activeDrag = {
    type: "pan",
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startCamX: camX,
    moved: false,
    samples: [{ t: performance.now(), x: e.clientX }],
  };
  cancelInertia();
  try {
    worldViewportEl.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
}

function handlePanMove(e) {
  const dx = e.clientX - activeDrag.startClientX;
  if (!activeDrag.moved && Math.abs(dx) > DRAG_THRESHOLD) activeDrag.moved = true;
  if (activeDrag.moved) {
    const scale = sceneScale();
    setCamX(activeDrag.startCamX - dx / scale);
    activeDrag.samples.push({ t: performance.now(), x: e.clientX });
    if (activeDrag.samples.length > 5) activeDrag.samples.shift();
  }
}

function finishPan(e) {
  const drag = activeDrag;
  activeDrag = null;
  try {
    worldViewportEl.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
  if (!drag.moved) return; // stuknięcie w puste miejsce — nic

  const samples = drag.samples;
  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const scale = sceneScale();
    let velocity = -((last.x - first.x) / scale / dt) * 16; // px/klatkę (~60fps)
    runInertia(velocity);
  }
}

function runInertia(velocity) {
  cancelInertia();
  function step() {
    if (Math.abs(velocity) < 0.05) {
      inertiaRaf = null;
      return;
    }
    setCamX(camX + velocity);
    velocity *= INERTIA_DECAY;
    if (camX <= 0 || camX >= MAX_CAMX) {
      inertiaRaf = null;
      return;
    }
    inertiaRaf = requestAnimationFrame(step);
  }
  step();
}

// --- Przeciąganie książek -------------------------------------------------

/**
 * Jedyny listener pointerdown w całej sali (dopięty do #scene). Rozstrzyga,
 * pod czym jest palec/rysik: książka/kartka/kryjówka (gdziekolwiek akurat leżą)
 * dostają pierwszeństwo, w przeciwnym razie — jeśli jesteśmy nad oknem świata —
 * zaczyna się panoramowanie. Poza oknem świata (pasek, koszyk, mini-mapa, modale)
 * nic się nie dzieje — te elementy mają własne, niezależne listenery.
 */
function onScenePointerDown(e) {
  if (activeDrag) return;

  const bookEl = e.target.closest(".book-item");
  const pageEl = !bookEl ? e.target.closest(".page-item") : null;
  const hideoutEl = !bookEl && !pageEl ? e.target.closest(".hideout") : null;

  if (!bookEl && !pageEl && !hideoutEl) {
    if (e.target.closest(".slot-badge, .wipe-canvas")) return; // tylko podgląd/przecieranie, nie panoramowanie
    if (worldViewportEl.contains(e.target)) startPan(e);
    return;
  }

  e.stopPropagation();

  if (hideoutEl) {
    if (activeDrag) return;
    activeDrag = {
      type: "hideout",
      id: hideoutEl.dataset.hideoutId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    try {
      hideoutEl.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
    return;
  }

  if (bookEl) {
    const id = bookEl.dataset.bookId;
    const rt = bookRuntime.get(id);
    if (!rt || activeDrag) return;
    if (!isBookAccessible(id)) {
      const r = getLogicalRect(bookEl);
      showMsgTip("Najpierw zdejmij książki z wierzchu.", r.x + r.width / 2, r.y - 6);
      return;
    }
    if (dustyBookIds.has(id) && !state.dustCleared.includes(id)) {
      // Kurz — canvas przechwytuje gest sam (stopPropagation w dust.js). Tu tylko dymek na czyste stuknięcie
      // (canvas leży na wierzchu, więc to gałąź wykona się tylko, gdy z jakiegoś powodu event przeszedł mimo to).
      const r = getLogicalRect(bookEl);
      showMsgTip("Przetrzyj kurz palcem albo rysikiem.", r.x + r.width / 2, r.y - 6);
      return;
    }
    startBookDrag(rt, e);
    return;
  }

  if (pageEl) {
    const id = pageEl.dataset.pageId;
    const rt = pageRuntime.get(id);
    if (!rt || activeDrag) return;
    startPageDrag(rt, e);
  }
}

function startBookDrag(rt, e) {
  hideHoverTip();
  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const w = bookWidth(rt);
  const originScreen =
    rt.location === "basket" ? { x: rt.x, y: rt.y } : { x: worldToScreenX(rt.x), y: rt.y + 70 };

  activeDrag = {
    type: "book",
    id: rt.id,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
    draggable: rt.location !== "shelf", // odłożona książka: samo stuknięcie otwiera kartę, nie da się jej przenieść
    grabDX: scenePt.x - (originScreen.x - w / 2),
    grabDY: scenePt.y - (originScreen.y - BOOK_COVER_H / 2),
    originLocation: rt.location,
    width: w,
  };
  try {
    rt.el.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
}

function startPageDrag(rt, e) {
  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const screenX = worldToScreenX(rt.def.x);
  const screenY = rt.def.y + 70;
  activeDrag = {
    type: "page",
    id: rt.id,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
    grabDX: scenePt.x - (screenX - PAGE_W / 2),
    grabDY: scenePt.y - (screenY - PAGE_H / 2),
  };
  try {
    rt.el.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
}

function onWorldPointerMove(e) {
  if (activeDrag && activeDrag.type === "pan" && activeDrag.pointerId === e.pointerId) {
    handlePanMove(e);
    return;
  }
  if (activeDrag && activeDrag.type === "book" && activeDrag.pointerId === e.pointerId) {
    handleBookDragMove(e);
    return;
  }
  if (activeDrag && activeDrag.type === "page" && activeDrag.pointerId === e.pointerId) {
    handlePageDragMove(e);
    return;
  }
  if (activeDrag && activeDrag.type === "hideout" && activeDrag.pointerId === e.pointerId) {
    const dxTotal = e.clientX - activeDrag.startClientX;
    const dyTotal = e.clientY - activeDrag.startClientY;
    if (Math.hypot(dxTotal, dyTotal) > DRAG_THRESHOLD) activeDrag.moved = true;
    return;
  }
  if (activeDrag) return;

  // Podgląd przy unoszeniu rysika/myszy nad książką (bez wciśniętego przycisku).
  if (e.buttons === 0 && (e.pointerType === "pen" || e.pointerType === "mouse")) {
    const bookEl = e.target.closest(".book-item");
    if (bookEl) {
      const rt = bookRuntime.get(bookEl.dataset.bookId);
      const stillDusty = rt && dustyBookIds.has(rt.id) && !state.dustCleared.includes(rt.id);
      if (rt && !stillDusty) {
        showBookHoverTip(rt);
        return;
      }
    }
    hideHoverTip();
  }
}

function showBookHoverTip(rt) {
  const book = rt.book;
  const w = bookWidth(rt);
  let html = `<strong>${escapeHtml(book.title)}</strong><span class="hover-tip-author">${escapeHtml(book.author)}</span>`;
  if (book.series) html += `<span class="hover-tip-series">Tom ${book.series.vol} z ${book.series.of}</span>`;
  const screenX = rt.location === "basket" ? rt.x : worldToScreenX(rt.x);
  const screenY = (rt.location === "basket" ? rt.y : rt.y + 70) - (rt.location === "shelf" ? spineSize(rt).h / 2 : BOOK_COVER_H / 2) - 6;
  showHoverHtml(html, screenX, screenY);
}

function handleBookDragMove(e) {
  const drag = activeDrag;
  const rt = bookRuntime.get(drag.id);
  const dxTotal = e.clientX - drag.startClientX;
  const dyTotal = e.clientY - drag.startClientY;

  if (!drag.moved && Math.hypot(dxTotal, dyTotal) > DRAG_THRESHOLD) {
    drag.moved = true;
    if (drag.draggable) {
      rt.el.classList.add("dragging");
      if (rt.el.parentElement !== dragLayerEl) dragLayerEl.appendChild(rt.el);
    }
  }
  if (!drag.moved || !drag.draggable) return;

  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const x = scenePt.x - drag.grabDX;
  const y = scenePt.y - drag.grabDY;
  applyTransform(rt.el, x, y, 0, 1.12);

  maybeAutoScroll(e.clientX);
  updateShelfHighlight(toWorldCoords(e.clientX, e.clientY));
  updateBasketHighlight(scenePt);
}

function handlePageDragMove(e) {
  const drag = activeDrag;
  const rt = pageRuntime.get(drag.id);
  const dxTotal = e.clientX - drag.startClientX;
  const dyTotal = e.clientY - drag.startClientY;
  if (!drag.moved && Math.hypot(dxTotal, dyTotal) > DRAG_THRESHOLD) {
    drag.moved = true;
    rt.el.classList.add("dragging");
    if (rt.el.parentElement !== dragLayerEl) dragLayerEl.appendChild(rt.el);
  }
  if (!drag.moved) return;
  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const x = scenePt.x - drag.grabDX;
  const y = scenePt.y - drag.grabDY;
  applyTransform(rt.el, x, y, 0, 1.15);
  maybeAutoScroll(e.clientX);
  updateFolderHighlight(scenePt);
}

function updateShelfHighlight(worldPt) {
  const hit = shelfAt(worldPt);
  for (const shelf of LAYOUT.shelves) {
    shelfElByGenre[shelf.genre].classList.toggle("drag-target", hit === shelf);
  }
}

function updateBasketHighlight(scenePt) {
  const r = basket.rect();
  const inside = scenePt.x >= r.x && scenePt.x <= r.x + r.width && scenePt.y >= r.y && scenePt.y <= r.y + r.height;
  cartEl.classList.toggle("drag-target", inside);
}

function updateFolderHighlight(scenePt) {
  const worldPt = { x: scenePt.x + camX, y: scenePt.y - 70 };
  const f = LAYOUT.folder;
  const inside = worldPt.x >= f.x && worldPt.x <= f.x + f.w && worldPt.y >= f.y && worldPt.y <= f.y + f.h;
  folderEl.classList.toggle("drag-target", inside);
}

function clearDragHighlights() {
  for (const shelf of LAYOUT.shelves) shelfElByGenre[shelf.genre].classList.remove("drag-target");
  cartEl.classList.remove("drag-target");
  if (folderEl) folderEl.classList.remove("drag-target");
}

function onWorldPointerUp(e) {
  if (activeDrag && activeDrag.type === "pan" && activeDrag.pointerId === e.pointerId) {
    finishPan(e);
    return;
  }
  if (activeDrag && activeDrag.type === "book" && activeDrag.pointerId === e.pointerId) {
    finishBookDrag(e);
    return;
  }
  if (activeDrag && activeDrag.type === "page" && activeDrag.pointerId === e.pointerId) {
    finishPageDrag(e);
    return;
  }
  if (activeDrag && activeDrag.type === "hideout" && activeDrag.pointerId === e.pointerId) {
    const drag = activeDrag;
    activeDrag = null;
    const hideoutEl = hideoutElById[drag.id];
    try {
      hideoutEl.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
    if (!drag.moved) onHideoutActivate(hideoutEl);
  }
}

function finishBookDrag(e) {
  const drag = activeDrag;
  const rt = bookRuntime.get(drag.id);
  activeDrag = null;
  cancelAutoScroll();
  try {
    rt.el.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }

  if (!drag.moved) {
    openBookCard(drag.id);
    return;
  }
  if (!drag.draggable) return; // książka na regale: lekki ruch bez efektu

  rt.el.classList.remove("dragging");
  clearDragHighlights();

  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const basketRect = basket.rect();
  const inBasket =
    scenePt.x >= basketRect.x &&
    scenePt.x <= basketRect.x + basketRect.width &&
    scenePt.y >= basketRect.y &&
    scenePt.y <= basketRect.y + basketRect.height;

  if (inBasket) {
    if (basket.isFull()) {
      const r = basket.rect();
      showMsgTip("Koszyk pełny — odnieś książki na regały.", r.x + r.width / 2, r.y - 6);
      returnBookHome(rt);
      notifyChange();
    } else {
      placeBookInBasket(rt);
    }
    return;
  }

  const worldPt = toWorldCoords(e.clientX, e.clientY);
  const shelf = shelfAt(worldPt);
  if (shelf) {
    if (shelf.genre === rt.book.genre) {
      placeBookOnShelf(rt, shelf, worldPt);
    } else {
      rejectDrop(rt, shelf, "Ta książka szuka regału innego gatunku.");
    }
    return;
  }

  returnBookHome(rt);
  notifyChange();
}

function finishPageDrag(e) {
  const drag = activeDrag;
  const rt = pageRuntime.get(drag.id);
  activeDrag = null;
  cancelAutoScroll();
  try {
    rt.el.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }

  if (!drag.moved) return;
  rt.el.classList.remove("dragging");
  clearDragHighlights();

  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const worldPt = { x: scenePt.x + camX, y: scenePt.y - 70 };
  const f = LAYOUT.folder;
  const inFolder = worldPt.x >= f.x && worldPt.x <= f.x + f.w && worldPt.y >= f.y && worldPt.y <= f.y + f.h;

  if (inFolder) {
    state.pagesFiled.push(rt.id);
    rt.el.remove();
    pageRuntime.delete(rt.id);
    playPaper();
    updateFolderCounter();
    notifyChange();
    return;
  }

  const x = rt.def.x - PAGE_W / 2;
  const y = rt.def.y - PAGE_H / 2;
  applyTransform(rt.el, x, y, rt.def.rot, 1);
  if (rt.el.parentElement !== worldLayerEl) worldLayerEl.appendChild(rt.el);
}

function onPointerCancelAnywhere(e) {
  if (activeDrag && activeDrag.pointerId === e.pointerId) {
    if (activeDrag.type === "pan") {
      try {
        worldViewportEl.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignorowane */
      }
    } else if (activeDrag.type === "book") {
      const rt = bookRuntime.get(activeDrag.id);
      if (activeDrag.moved && activeDrag.draggable) {
        rt.el.classList.remove("dragging");
        clearDragHighlights();
        returnBookHome(rt);
      }
    } else if (activeDrag.type === "page") {
      const rt = pageRuntime.get(activeDrag.id);
      if (activeDrag.moved) {
        rt.el.classList.remove("dragging");
        clearDragHighlights();
        const x = rt.def.x - PAGE_W / 2;
        const y = rt.def.y - PAGE_H / 2;
        applyTransform(rt.el, x, y, rt.def.rot, 1);
        if (rt.el.parentElement !== worldLayerEl) worldLayerEl.appendChild(rt.el);
      }
    }
    if (activeDrag.type === "hideout") {
      const hideoutEl = hideoutElById[activeDrag.id];
      try {
        hideoutEl.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignorowane */
      }
    }
    activeDrag = null;
    cancelAutoScroll();
  }
}

// =========================================================================
// Kryjówki
// =========================================================================

function onHideoutActivate(hideoutEl) {
  const id = hideoutEl.dataset.hideoutId;
  const hideout = LAYOUT.hideouts.find((h) => h.id === id);
  if (state.hideoutsOpened[id]) return;

  state.hideoutsOpened[id] = true;
  hideoutEl.classList.add("opened");

  for (let i = 0; i < hideout.capacity; i++) {
    const bookId = spotToBook.get(`hideout-${id}-${i}`);
    const rt = bookRuntime.get(bookId);
    const pos = hideoutLanding(hideout, i);
    rt.x = pos.x;
    rt.y = pos.y;
    rt.el.classList.add("pop-in", "no-anim");
    worldLayerEl.appendChild(rt.el);
    applyTransform(rt.el, pos.x - BOOK_COVER_W / 2, pos.y - BOOK_COVER_H / 2, 0, 1);
    requestAnimationFrame(() => rt.el.classList.remove("no-anim"));
    maybeAttachDust(rt);
  }

  if (hideout.type === "drawer") playDrawer();
  else playPaper();

  notifyChange();
}

// =========================================================================
// Publiczne API
// =========================================================================

export function initWorld(gameState, gameHooks) {
  state = gameState;
  hooks = { openBookModal() {}, onChange() {}, onCameraChange() {}, ...gameHooks };

  cacheDom();

  const assignment = computeAssignment(state.seed);
  bookHomeSpot = assignment.homeSpot;
  spotToBook = assignment.spotBook;
  dustyBookIds = assignment.dustyIds;

  basket = createBasket(cartEl, basketCounterEl, getLogicalRect, 6);

  worldLayerEl.style.width = `${WORLD_W}px`;
  worldLayerEl.style.height = `${WORLD_H}px`;

  buildBays();
  buildFurnitureFallback();
  buildShelves();
  buildCandlesAndChandelier();
  buildCobwebs();
  buildHideouts();
  buildFolder();
  buildPages();
  buildBooksInWorld();

  for (const genre of Object.keys(cobwebByGenre)) {
    if (!state.cobwebsCleared.includes(genre)) attachCobweb(genre);
    else cobwebByGenre[genre].host.remove();
  }

  for (const genreId of state.completedShelves) {
    shelfElByGenre[genreId].classList.add("complete");
    const el = candleFlameByGenre[genreId];
    if (el) el.classList.add("lit");
    const glow = candleGlowByGenre[genreId];
    if (glow) glow.el.classList.add("lit-visible");
  }
  const stats0 = computeStats(state);
  for (const genre of stats0.chronologyGenres) {
    const star = shelfElByGenre[genre].querySelector(".plaque-star");
    if (star) star.classList.remove("hidden");
  }

  updateFolderCounter();

  // Początek gestu: JEDEN listener na całej scenie (patrz komentarz przy
  // onScenePointerDown) — książki/kartki/kryjówki żyją w trzech różnych
  // poddrzewach (world-layer / basket-layer / drag-layer) zależnie od tego,
  // gdzie akurat są, więc nie da się tego rozstrzygnąć osobnymi listenerami
  // per-kontener bez gubienia zdarzeń.
  sceneEl.addEventListener("pointerdown", onScenePointerDown);
  worldLayerEl.addEventListener("pointerleave", (e) => {
    if (!activeDrag) hideHoverTip();
  });

  // Kontynuacja gestu (move/up/cancel) nasłuchuje na document, nie na world-layer
  // czy world-viewport: przeciągana książka/kartka jest w trakcie ruchu przenoszona
  // do #drag-layer (żeby liczyć jej pozycję we współrzędnych sceny, nie świata),
  // więc przestaje być potomkiem world-layer — zdarzenia od niej (nawet przy
  // setPointerCapture) bąbelkowałyby przez #drag-layer, a nie przez world-layer,
  // i nigdy by tu nie doszły.
  document.addEventListener("pointermove", onWorldPointerMove);
  document.addEventListener("pointerup", onWorldPointerUp);
  document.addEventListener("pointercancel", onPointerCancelAnywhere);

  // Parametr testowy ?kamera=X ustawia widok na wybrany fragment sali (do zrzutów ekranu).
  const camParam = Number(new URLSearchParams(location.search).get("kamera"));
  setCamX(Number.isFinite(camParam) && camParam > 0 ? camParam : state.camX || 0, { silent: true });
  requestAnimationFrame(() => {
    document.querySelectorAll(".no-anim").forEach((el) => el.classList.remove("no-anim"));
  });

  applyDarknessOpacity();
  if (computeStats(state).percent >= 100) {
    lightChandelier();
  }

  return { setCamX };
}
