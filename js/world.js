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
import {
  clamp,
  mulberry32,
  hashString,
  seededShuffle,
  shadeColor,
  escapeHtml,
  brightnessVariant,
  positionFloatingTip,
  view,
  TOPBAR_H,
} from "./util.js";
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

const EDGE_ZONE = 120;
const EDGE_ZONE_Y = 70; // pionowa strefa krawędzi (auto-przewijanie w pionie, gdy jest zapas w pionie)
const ZOOM_STEP = 1.25; // krok przycisków +/− i klawiszy +/−
const KEY_PAN_PX = 160; // krok strzałek (px ekranu)
const AUTOSCROLL_MAX_SPEED = 34 * 60; // px/s, szczyt przy krawędzi (~34 px/klatkę @60fps)
const DRAG_THRESHOLD = 8;
const INERTIA_DECAY = 0.92;
const IN_VIEW_MARGIN = 220; // margines (px świata) poza oknem, w którym elementy nadal liczą się jako "widoczne"

const BOOK_COVER_W = 84;
const BOOK_COVER_H = 118;
const BOOK_SPINE_W = 46;
const BOOK_SPINE_H = 148;
const PAGE_W = 40;
const PAGE_H = 52;

const SEAM_WALL_H = 612; // wysokość ściany (styk kończy się na linii podłogi)

// Pierwsze pojawienie się każdego typu obiektu w polu widzenia -> jednorazowy dymek.
const HINT_TEXT = {
  hideout: "Stuknij — tu może kryć się książka",
  cobweb: "Zmieć pajęczynę: pocieraj palcem lub rysikiem",
  page: "Luźna kartka — stuknij, przeczytaj fragment i włóż ją do książki, z której wypadła",
  dust: "Przetrzyj kurz, żeby zobaczyć tytuł",
  stack: "Zdejmuj książki ze stosu od góry",
};

const INK_PLACE = 1;
const INK_EPOCH_BONUS = 1;
const INK_SHELF_COMPLETE = 5;
const INK_CHRONOLOGY = 5;
const INK_MAX = 20;

let state = null;
let hooks = { openBookModal() {}, onChange() {}, onCameraChange() {} };

// --- DOM ---------------------------------------------------------------
let sceneEl, worldViewportEl, worldLayerEl, dragLayerEl, darknessEl, zoomControlsEl;
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
let floorGlossEl = null;

// Kamera: camX/camY = lewy górny róg kadru w pikselach ŚWIATA, worldZoom = skala świata.
// Widoczny kadr ma (view.w / worldZoom) × (view.worldH / worldZoom) px świata.
// fitZoom = świat mieści się wysokością w oknie świata; maxZoom = max(fitZoom, 1). Na iPadzie fitZoom = 1 (brak zoomu).
let camX = 0;
let camY = 0;
let worldZoom = 1;
let fitZoom = 1;
let maxZoom = 1;
let lastVisW = 0; // widoczny kadr przed ostatnią zmianą rozmiaru okna (do zachowania środka kadru)
let lastVisH = 0;
const touchPts = new Map(); // pointerId -> {x, y} (clientX/Y) aktywnych palców w oknie świata (szczypanie)
let activeDrag = null; // {type:'book'|'page'|'pan'|'pinch', ...}
let inertiaRaf = null;
let autoScrollRaf = null;
let autoScrollPointerX = 0;
let autoScrollPointerY = 0;
let autoScrollLastT = 0;
let lastWipeSoundAt = 0;
let ambientEvening = 0;
let seamPilasterEls = [];

// =========================================================================
// Geometria — konwersje współrzędnych
// =========================================================================

function sceneScale() {
  const r = sceneEl.getBoundingClientRect();
  return r.width / view.w || 1;
}

function visW() {
  return view.w / worldZoom;
}
function visH() {
  return view.worldH / worldZoom;
}
function maxCamX() {
  return Math.max(0, WORLD_W - visW());
}
function maxCamY() {
  return Math.max(0, WORLD_H - visH());
}

function toSceneCoords(clientX, clientY) {
  const r = sceneEl.getBoundingClientRect();
  const scale = sceneScale();
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

/** Punkt sceny (px logiczne) -> punkt świata (uwzględnia zoom i camY). */
function sceneToWorld(sx, sy) {
  return { x: camX + sx / worldZoom, y: camY + (sy - TOPBAR_H) / worldZoom };
}

function toWorldCoords(clientX, clientY) {
  const p = toSceneCoords(clientX, clientY);
  return sceneToWorld(p.x, p.y);
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

/** Punkt świata -> współrzędne SCENY (px logiczne): x i y (y uwzględnia górny pasek). */
function worldToScreenX(wx) {
  return (wx - camX) * worldZoom;
}
function worldToScreenY(wy) {
  return TOPBAR_H + (wy - camY) * worldZoom;
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
  const pagesFiled = st.pagesFiled.length; // od 0.6: kartka wróciła do swojej książki (= naprawa)
  // Zadania z wersji 0.6 (js/zadania.js): prośby czytelników, pieczęcie, porządki.
  const z = st.zadania || {};
  const requestsDone = Math.min(LAYOUT.zadania.requestsTotal, z.requestsDone || 0);
  const sealsFound = (z.seals || []).length;
  const choresDone = (z.chores || []).length;
  const osDone = Math.min(LAYOUT.zadania.osTotal, (z.os || []).length); // od 0.10: Oś dziejów
  const points =
    placedBooks * 2 + dustCleared * 1 + cobwebsCleared * 2 + pagesFiled * 2 + requestsDone * 2 + sealsFound * 1 + choresDone * 1 + osDone * 1;
  const totalPoints =
    BOOKS.length * 2 +
    LAYOUT.dusty * 1 +
    LAYOUT.cobwebs.length * 2 +
    LAYOUT.pages.length * 2 +
    LAYOUT.zadania.requestsTotal * 2 +
    LAYOUT.zadania.seals.length * 1 +
    LAYOUT.zadania.chores.length * 1 +
    LAYOUT.zadania.osTotal * 1;
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
    requestsDone,
    totalRequests: LAYOUT.zadania.requestsTotal,
    sealsFound,
    totalSeals: LAYOUT.zadania.seals.length,
    choresDone,
    totalChores: LAYOUT.zadania.chores.length,
    osDone,
    totalOs: LAYOUT.zadania.osTotal,
    percent: clamp(percent, 0, 100),
    chronologyGenres,
  };
}

// Sala jest jasna i ciepła od startu — postęp NIE przyciemnia jej ani nie rozjaśnia
// (dawna mechanika "ciemność maleje z porządkiem" została usunięta). Zamiast tego
// wyższy porządek dokłada subtelny połysk: jaśniejszy parkiet + wędrujące błyski
// na złoceniach (patrz `.seam-pilaster`, `.shelf-plaque::after`, `.shelf.has-image::after`
// w CSS, sterowane zmienną --shine na #world-layer).
const GLEAM_MAX = 0.5;

function applyOrderGleam() {
  const stats = computeStats(state);
  const gleam = clamp(stats.percent / 100, 0, 1) * GLEAM_MAX;
  if (worldLayerEl) worldLayerEl.style.setProperty("--shine", String(gleam));
  if (floorGlossEl) floorGlossEl.style.opacity = String(gleam);
}

/**
 * Zaczep pod porę dnia (kolejna fala): `evening` 0..1 przyciemnia okna na
 * niebiesko-granatowo (nakładka `#darkness::before`, sterowana zmienną --evening)
 * i włącza ciepłe światła. Na razie nikt tego nie woła — sala zawsze jest w dzień.
 */
export function setAmbient({ evening = 0 } = {}) {
  ambientEvening = clamp(evening, 0, 1);
  if (darknessEl) darknessEl.style.setProperty("--evening", String(ambientEvening));
  if (worldLayerEl) worldLayerEl.style.setProperty("--evening", String(ambientEvening));
  if (ambientEvening > 0.5) {
    for (const genre of state.completedShelves) lightCandle(genre);
    if (computeStats(state).percent >= 100) lightChandelier();
  }
}

/** Aktualizuje połysk porządku nad światem, potem woła hooks.onChange(). */
function notifyChange() {
  applyOrderGleam();
  hooks.onChange();
}

// =========================================================================
// Widoczność w oknie kamery — gating nieskończonych animacji CSS i podpowiedzi
// =========================================================================

function isXInView(x, w = 0) {
  return x + w >= camX - IN_VIEW_MARGIN && x <= camX + visW() + IN_VIEW_MARGIN;
}

/** Nadaje/zdejmuje klasę .in-view elementom z nieskończonymi animacjami CSS,
 * żeby nie mieliły baterii, gdy są poza oknem świata. */
function updateInViewClasses() {
  for (const shelf of LAYOUT.shelves) {
    const el = shelfElByGenre[shelf.genre];
    if (el) el.classList.toggle("in-view", isXInView(shelf.x, shelf.w));
  }
  for (const c of LAYOUT.candles) {
    const el = candleFlameByGenre[c.genre];
    if (el) el.classList.toggle("in-view", isXInView(c.x, 18));
  }
  if (chandelierEl) chandelierEl.classList.toggle("in-view", isXInView(LAYOUT.chandelier.x - 45, 90));
  for (const h of LAYOUT.hideouts) {
    const el = hideoutElById[h.id];
    if (el) el.classList.toggle("in-view", isXInView(h.x, h.w));
  }
  for (const rt of pageRuntime.values()) {
    rt.el.classList.toggle("in-view", isXInView(rt.def.x - PAGE_W / 2, PAGE_W));
  }
  for (const el of seamPilasterEls) {
    const x = parseFloat(el.dataset.seamX || "0");
    el.classList.toggle("in-view", isXInView(x - 30, 60));
  }
  maybeShowFirstTimeHints();
}

// =========================================================================
// Podpowiedzi przy pierwszym pojawieniu się obiektu w polu widzenia
// =========================================================================

function checkHintFor(type, items) {
  if (!state.hintsShown) state.hintsShown = {};
  if (state.hintsShown[type]) return;
  for (const it of items) {
    if (!it) continue;
    if (isXInView(it.x, it.w || 0)) {
      state.hintsShown[type] = true;
      const screenX = worldToScreenX(it.x + (it.w || 0) / 2);
      const screenY = worldToScreenY(it.y || 0);
      showMsgTip(HINT_TEXT[type], screenX, screenY, 3600);
      notifyChange();
      return;
    }
  }
}

function maybeShowFirstTimeHints() {
  checkHintFor(
    "hideout",
    LAYOUT.hideouts
      .filter((h) => !state.hideoutsOpened[h.id])
      .map((h) => ({ x: h.x, y: h.y, w: h.w }))
  );
  checkHintFor(
    "cobweb",
    LAYOUT.cobwebs
      .filter((cw) => !state.cobwebsCleared.includes(cw.genre))
      .map((cw) => {
        const shelf = LAYOUT.shelfByGenre[cw.genre];
        return shelf ? { x: shelf.x, y: shelf.y, w: shelf.w } : null;
      })
  );
  checkHintFor(
    "page",
    Array.from(pageRuntime.values()).map((rt) => ({ x: rt.def.x - PAGE_W / 2, y: rt.def.y - PAGE_H, w: PAGE_W }))
  );
  checkHintFor(
    "dust",
    [...dustyBookIds]
      .filter((id) => !state.dustCleared.includes(id))
      .map((id) => {
        const rt = bookRuntime.get(id);
        return rt && rt.location === "world" ? { x: rt.x - BOOK_COVER_W / 2, y: rt.y - BOOK_COVER_H, w: BOOK_COVER_W } : null;
      })
  );
  checkHintFor(
    "stack",
    LAYOUT.stacks.map((st) => ({ x: st.x - BOOK_COVER_W / 2, y: st.y - BOOK_COVER_H, w: BOOK_COVER_W }))
  );
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
  zoomControlsEl = document.getElementById("zoom-controls");
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

    // Wieczorna wersja ilustracji (pixel-aligned) — krycie = --evening (js/klimat.js).
    const eveningSrc = bay.image.replace(/\.jpg$/, "-wieczor.jpg");
    const eveningImg = new Image();
    eveningImg.onload = () => {
      const ev = document.createElement("div");
      ev.className = "bay-evening";
      ev.style.backgroundImage = `url("${eveningSrc}")`;
      bayEl.appendChild(ev);
    };
    eveningImg.src = eveningSrc;

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

  buildSeams();
  buildFloorGloss();
}

/**
 * Styki między wnękami (x = 1240, 2480, 3720): element `.seam` na całą wysokość
 * świata. Część ścienna (y 0..612) to pilaster z assets/pilaster.png (77×900,
 * przezroczyste tło) wyśrodkowany w słupku, wysokość dopasowana do ściany (612px),
 * szerokość ~54px (proporcje zachowane) — fallback CSS (dębowy gradient + cienka
 * złota linia), gdy pliku brak. Część podłogowa (y 612..804) to miękkie przenikanie:
 * pasek w kolorze parkietu z maską zanikającą na obu krawędziach, żeby nie było
 * twardej linii między sąsiednimi podłogami.
 */
function buildSeams() {
  for (let i = 1; i < LAYOUT.bays.length; i++) {
    const bay = LAYOUT.bays[i];
    const seam = document.createElement("div");
    seam.className = "seam";
    seam.style.left = `${bay.x - LAYOUT.pilasterWidth / 2}px`;
    seam.style.width = `${LAYOUT.pilasterWidth}px`;
    seam.innerHTML = `<div class="seam-pilaster"></div><div class="seam-floor"></div>`;
    worldLayerEl.appendChild(seam);

    const pilasterEl = seam.querySelector(".seam-pilaster");
    pilasterEl.dataset.seamX = String(bay.x);
    seamPilasterEls.push(pilasterEl);

    const img = new Image();
    img.onload = () => {
      pilasterEl.style.backgroundImage = `url("assets/pilaster.png")`;
      pilasterEl.classList.add("has-image");
    };
    img.onerror = () => {
      /* brak pliku — zostaje zastępczy CSS (dębowy gradient) */
    };
    img.src = "assets/pilaster.png";
  }
}

/** Prosta nakładka połysku na podłodze (y > 610) — opacity rośnie z porządkiem sali. */
function buildFloorGloss() {
  floorGlossEl = document.createElement("div");
  floorGlossEl.id = "floor-gloss";
  floorGlossEl.style.top = `${SEAM_WALL_H - 2}px`;
  floorGlossEl.style.height = `${WORLD_H - SEAM_WALL_H + 2}px`;
  floorGlossEl.style.width = `${WORLD_W}px`;
  worldLayerEl.appendChild(floorGlossEl);
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

    // Plakietka epoki: hover (rysik/mysz) LUB stuknięcie (palec) pokazują, co ona znaczy.
    shelfSlotElsByGenre[shelf.genre].forEach((slotEl, i) => {
      const badge = slotEl.querySelector(".slot-badge");
      const showEpochTip = () => {
        const epoch = EPOCH_BY_ID[shelf.slots[i].epoch];
        const r = getLogicalRect(badge);
        showHoverHtml(`<strong>Epoka: ${escapeHtml(epoch.name)}</strong><br>Połóż tu książkę z tej epoki, a dostaniesz bonus ✦`, r.x + r.width / 2, r.y);
      };
      badge.addEventListener("pointermove", (e) => {
        if (e.buttons !== 0 || (e.pointerType !== "pen" && e.pointerType !== "mouse")) return;
        showEpochTip();
      });
      badge.addEventListener("pointerleave", hideHoverTip);
      badge.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;
        e.stopPropagation();
        showEpochTip();
        clearTimeout(hoverHideTimer);
        hoverHideTimer = setTimeout(hideHoverTip, 3000);
      });
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
  if (LAYOUT.chandelier.sprite) {
    // Żyrandol jako osobny obrazek (kołysze się — js/klimat.js). Element obejmuje prostokąt
    // sprite'a, punkt obrotu = środek górnej krawędzi; płomienie są jego dziećmi.
    const sp = LAYOUT.chandelier.sprite;
    chEl.classList.add("sprite");
    chEl.style.left = `${sp.x}px`;
    chEl.style.top = `${sp.y}px`;
    chEl.style.width = `${sp.w}px`;
    chEl.style.height = `${sp.h}px`;
    chEl.innerHTML =
      `<img class="chandelier-img" src="assets/zyrandol.png" alt="" draggable="false">` +
      (LAYOUT.chandelier.flames || [])
        .map((f) => `<div class="chandelier-flame" style="left:${f.x - sp.x}px;top:${f.y - sp.y}px"></div>`)
        .join("");
  } else if (LAYOUT.chandelier.painted) {
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
    g.el.style.top = `${(g.y - camY) * worldZoom}px`; // #darkness leży w oknie świata (bez górnego paska)
  }
  if (chandelierGlowEl) {
    chandelierGlowEl.style.left = `${worldToScreenX(LAYOUT.chandelier.x)}px`;
    chandelierGlowEl.style.top = `${(LAYOUT.chandelier.y - camY) * worldZoom}px`;
  }
  darknessEl.style.setProperty("--zoom", String(worldZoom)); // skaluje plamy światła razem ze światem
}

function buildCobwebs() {
  for (const cw of LAYOUT.cobwebs) {
    const shelfEl = shelfElByGenre[cw.genre];
    const host = document.createElement("div");
    host.className = `cobweb-host cobweb-${cw.corner}`;
    shelfEl.appendChild(host); // bez plakietki 🧹 (od 0.5) — pajęczynę widać, a podpowiedź przy pierwszym spotkaniu mówi, co z nią zrobić
    cobwebByGenre[cw.genre] = { host, cleared: false };
  }
}

function attachCobweb(genre) {
  const entry = cobwebByGenre[genre];
  if (!entry || entry.layer) return;
  entry.layer = createWipeLayer(entry.host, {
    width: 150,
    height: 150,
    cols: 5,
    rows: 5,
    threshold: 0.5,
    radius: 24,
    texture: "cobweb",
    onCleared: () => {
      if (!state.cobwebsCleared.includes(genre)) state.cobwebsCleared.push(genre);
      const badge = entry.host.querySelector(".cobweb-badge");
      if (badge) badge.remove();
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
    el.innerHTML = `<span class="hideout-badge">🔍</span>`;
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
  const c = folderEl.querySelector(".folder-counter"); // od 0.6 teczkę przejmuje js/zadania.js (rewersy)
  if (c) c.textContent = `${state.pagesFiled.length}/${LAYOUT.pages.length}`;
}

// ---------------------------------------------------------------------------
// Zaczepy dla js/zadania.js (od 0.6): upuszczenie książki/kartki i stuknięcie kartki
// ---------------------------------------------------------------------------

const dropHandlers = [];
let pageTapHandler = null;

/**
 * fn({ kind: "book"|"page", id, clientX, clientY, worldPt, scenePt, fromBasket }) →
 *   null (nie moje — gra działa dalej jak zwykle) albo
 *   { then: "basket"|"home" } (książka) / { consumed: true } (kartka) / { reject: "komunikat" }.
 */
export function registerDropHandler(fn) {
  dropHandlers.push(fn);
}

export function setPageTapHandler(fn) {
  pageTapHandler = fn;
}

function runDropHandlers(info) {
  for (const h of dropHandlers) {
    const r = h(info);
    if (r) return r;
  }
  return null;
}

/** Kartka wróciła do swojej książki — znika z sali/koszyka i liczy się jako naprawa. */
function consumePage(rt) {
  if (rt.location === "basket") {
    basket.clear(state.pagesInBasket[rt.id]);
    delete state.pagesInBasket[rt.id];
  }
  if (!state.pagesFiled.includes(rt.id)) state.pagesFiled.push(rt.id);
  rt.el.remove();
  pageRuntime.delete(rt.id);
  playPaper();
  updateFolderCounter();
  notifyChange();
}

function buildPages() {
  if (!state.pagesInBasket || typeof state.pagesInBasket !== "object") state.pagesInBasket = {};
  for (const p of LAYOUT.pages) {
    if (state.pagesFiled.includes(p.id)) continue;
    const el = document.createElement("div");
    el.className = "page-item no-anim";
    el.dataset.pageId = p.id;
    const rt = { id: p.id, def: p, el, location: "world", x: p.x, y: p.y };
    pageRuntime.set(p.id, rt);
    const slot = state.pagesInBasket[p.id];
    if (Number.isInteger(slot)) {
      basket.assign(slot, p.id);
      renderPageInBasket(rt, slot);
    } else {
      applyTransform(el, p.x - PAGE_W / 2, p.y - PAGE_H / 2, p.rot, 1);
      worldLayerEl.appendChild(el);
    }
  }
}

// Luźna kartka w koszyku (od 0.5): zajmuje jedno z 6 miejsc, z koszyka niesie się ją do teczki.
function renderPageInBasket(rt, slot) {
  const { cx, cy } = basket.slotCenter(slot);
  rt.location = "basket";
  rt.x = cx;
  rt.y = cy;
  applyTransform(rt.el, cx - PAGE_W / 2, cy - PAGE_H / 2, -4, 1.3);
  if (rt.el.parentElement !== basketLayerEl) basketLayerEl.appendChild(rt.el);
}

function returnPageHome(rt) {
  if (rt.location === "basket") {
    renderPageInBasket(rt, state.pagesInBasket[rt.id]);
    return;
  }
  applyTransform(rt.el, rt.def.x - PAGE_W / 2, rt.def.y - PAGE_H / 2, rt.def.rot, 1);
  if (rt.el.parentElement !== worldLayerEl) worldLayerEl.appendChild(rt.el);
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
    // Od 0.7.1: długi tytuł (np. „Zdążyć przed Panem Bogiem”) mniejszą czcionką — inaczej ucina się czwarta linijka.
    `<span class="cover-title${book.title.length >= 22 ? " dlugi" : ""}">${escapeHtml(book.title)}</span>` +
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
    el.dataset.genre = book.genre;
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
  // Grzbiet: napis tak duży, jak pozwala szerokość TEGO regału (przegródki mają różną szerokość).
  const titleEl = rt.el.querySelector(".spine-title");
  if (titleEl) titleEl.style.fontSize = `${clamp(Math.round(sp.w * 0.42), 12, 20)}px`;
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
    threshold: 0.6,
    radius: 16,
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
  hoverTipEl.classList.remove("hidden");
  positionFloatingTip(hoverTipEl, screenX, screenY, { preferAbove: true, gap: 10 });
  clearTimeout(hoverHideTimer);
}
function hideHoverTip() {
  hoverTipEl.classList.add("hidden");
}

let msgTipTimer = null;
function showMsgTip(text, screenX, screenY, duration = 2000) {
  msgTipEl.textContent = text;
  msgTipEl.classList.remove("hidden");
  positionFloatingTip(msgTipEl, screenX, screenY, { preferAbove: true, gap: 10 });
  clearTimeout(msgTipTimer);
  msgTipTimer = setTimeout(() => msgTipEl.classList.add("hidden"), duration);
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
  // Książka już w koszyku nie może zająć drugiego miejsca (dawniej: „duch” blokujący koszyk).
  if (rt.location === "basket") {
    returnBookHome(rt);
    return;
  }
  const idx = basket.findFreeSlot();
  basket.assign(idx, rt.id);
  state.books[rt.id] = { where: "basket", basketSlot: idx, shelfSlot: null };
  renderBookInBasket(rt, idx, false);
  playPlaceGood();
  refreshStackAccessibility();
  notifyChange();
}

// Dla modułu „książka w ręku” (js/ksiazka.js): przycisk „Do koszyka” na rozkładówce.
export function basketHasRoom() {
  return !basket.isFull();
}

export function moveBookToBasket(bookId) {
  const rt = bookRuntime.get(bookId);
  if (rt && rt.location === "shelf") return takeOffShelf(rt);
  if (!rt || rt.location !== "world" || basket.isFull()) return false;
  placeBookInBasket(rt);
  return true;
}

// Od 0.6.3 książki można zdejmować z regału i przestawiać, więc nagrody wypłacamy RAZ:
// state.nagrody = { placed: [id], epoch: [id], chronology: [genre] } (regał — state.completedShelves).
// Bez tego odkładanie tej samej książki w kółko „drukowałoby” atrament.
function nagrody() {
  if (!state.nagrody || typeof state.nagrody !== "object") state.nagrody = {};
  const n = state.nagrody;
  for (const k of ["placed", "epoch", "chronology"]) if (!Array.isArray(n[k])) n[k] = [];
  return n;
}

/** Zapisy sprzed 0.6.3: to, co już stoi na regałach, zostało opłacone. */
function migrateNagrody() {
  if (state.nagrody && typeof state.nagrody === "object") return;
  const n = nagrody();
  for (const book of BOOKS) {
    const rec = state.books[book.id];
    if (!rec || rec.where !== "shelf") continue;
    n.placed.push(book.id);
    const slot = LAYOUT.shelfByGenre[book.genre].slots[rec.shelfSlot];
    if (slot && slot.epoch === book.epoch) n.epoch.push(book.id);
  }
  for (const g of computeStats(state).chronologyGenres) if (state.completedShelves.includes(g)) n.chronology.push(g);
}

/** Atrament za odłożenie książki i za dobrą epokę — każda nagroda tylko za pierwszym razem. */
function awardPlacement(rt, shelf, slotIndex, { quiet = false } = {}) {
  const n = nagrody();
  if (!n.placed.includes(rt.id)) {
    n.placed.push(rt.id);
    addInk(INK_PLACE);
    spawnFloatingLabel(shelf.x + shelf.w / 2, shelf.y - 6, `+${INK_PLACE}`);
  }
  if (shelf.slots[slotIndex].epoch !== rt.book.epoch) return;
  if (!n.epoch.includes(rt.id)) {
    n.epoch.push(rt.id);
    addInk(INK_EPOCH_BONUS);
    playEpochBonus();
    spawnFloatingLabel(shelf.x + shelf.w / 2, shelf.y - 30, "✦ Dobra epoka!", "epoch-bonus");
  } else if (!quiet) {
    spawnFloatingLabel(shelf.x + shelf.w / 2, shelf.y - 30, "✦ Dobra epoka!", "epoch-bonus");
  }
}

/** Po każdej zmianie na regale: wygląd „uporządkowany”/gwiazdka wg stanu TERAZ, nagrody raz. */
function afterShelfChange(genre) {
  const shelfEl = shelfElByGenre[genre];
  const full = isShelfFull(genre);
  shelfEl.classList.toggle("complete", full);
  if (full && !state.completedShelves.includes(genre)) {
    state.completedShelves.push(genre);
    addInk(INK_SHELF_COMPLETE);
    playShelfComplete();
    shelfEl.classList.add("just-completed");
    setTimeout(() => shelfEl.classList.remove("just-completed"), 2700);
    lightCandle(genre);
    showBanner(`Regał «${GENRE_BY_ID[genre].name}» uporządkowany!`);
  }
  const chrono = computeStats(state).chronologyGenres.includes(genre);
  const star = shelfEl.querySelector(".plaque-star");
  if (star) star.classList.toggle("hidden", !chrono);
  const n = nagrody();
  if (chrono && !n.chronology.includes(genre)) {
    n.chronology.push(genre);
    addInk(INK_CHRONOLOGY);
    playChronologyStar();
    showBanner("Ład chronologiczny!");
  }
  refreshStackAccessibility();
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

  playPlaceGood();
  awardPlacement(rt, shelf, slotIndex);
  afterShelfChange(shelf.genre);
  notifyChange();
}

function nearestSlot(shelf, worldPt) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < shelf.slots.length; i++) {
    const c = shelfSlotCenter(shelf, i);
    const d = Math.hypot(c.cx - worldPt.x, c.cyBottom - worldPt.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Przestawienie na tym samym regale: na wolne miejsce albo zamiana z książką, która tam stoi. */
function moveWithinShelf(rt, shelf, worldPt) {
  const genre = shelf.genre;
  const occ = shelfOccupancy[genre];
  const from = state.books[rt.id].shelfSlot;
  const to = nearestSlot(shelf, worldPt);
  if (to === from) {
    returnBookHome(rt);
    return;
  }
  const otherId = occ[to];
  occ[to] = rt.id;
  occ[from] = otherId;
  state.books[rt.id].shelfSlot = to;
  renderBookOnShelf(rt, to, false);
  if (otherId) {
    state.books[otherId].shelfSlot = from;
    const other = bookRuntime.get(otherId);
    renderBookOnShelf(other, from, false);
    awardPlacement(other, shelf, from, { quiet: true });
  } else {
    updateSlotVisual(genre, from, false);
  }
  playPlaceGood();
  awardPlacement(rt, shelf, to);
  afterShelfChange(genre);
  notifyChange();
}

/** Zdjęcie książki z regału do koszyka (przeciągnięciem albo przyciskiem na karcie książki). */
function takeOffShelf(rt) {
  if (basket.isFull()) {
    const r = basket.rect();
    showMsgTip("Koszyk pełny — zrób w nim miejsce.", r.x + r.width / 2, r.y - 6);
    returnBookHome(rt);
    return false;
  }
  const genre = rt.book.genre;
  const slot = state.books[rt.id].shelfSlot;
  shelfOccupancy[genre][slot] = null;
  updateSlotVisual(genre, slot, false);
  // grzbiet → z powrotem okładka
  rt.el.classList.remove("book-spine");
  rt.el.classList.add("book-cover");
  if (isOpenVariant(rt.id)) rt.el.classList.add("open-variant");
  rt.el.style.width = "";
  rt.el.style.height = "";
  rt.el.innerHTML = coverInnerHtml(rt.book);
  placeBookInBasket(rt);
  afterShelfChange(genre);
  notifyChange();
  return true;
}

function lightCandle(genre) {
  const el = candleFlameByGenre[genre];
  if (el) el.classList.add("lit");
  const glow = candleGlowByGenre[genre];
  if (glow) glow.el.classList.add("lit-visible");
  playCandle();
}

/** Ręczne zapalanie/gaszenie kinkietu (js/klimat.js). Zwraca nowy stan. */
export function toggleCandle(genre) {
  const el = candleFlameByGenre[genre];
  if (!el) return false;
  const lit = !el.classList.contains("lit");
  el.classList.toggle("lit", lit);
  const glow = candleGlowByGenre[genre];
  if (glow) glow.el.classList.toggle("lit-visible", lit);
  if (lit) playCandle();
  return lit;
}

/** Otwiera kryjówkę po id (np. odsunięcie zasłony w js/klimat.js). */
export function openHideoutById(id) {
  const el = hideoutElById[id];
  if (el) onHideoutActivate(el);
}

// =========================================================================
// Czary (od 0.5) — wołane z js/czary.js
// =========================================================================

/** Wgląd: każda książka (w sali i w koszyku) świeci kolorem swojego gatunku, regały też. */
export function spellInsight(on) {
  sceneEl.classList.toggle("wglad", on);
}

function cleanDustMagically(rt) {
  if (!dustyBookIds.has(rt.id) || state.dustCleared.includes(rt.id)) return;
  state.dustCleared.push(rt.id);
  if (rt.wipeLayer) {
    rt.wipeLayer.destroy();
    rt.wipeLayer = null;
  }
  rt.el.classList.remove("dusty");
}

function isVisibleInWorld(rt) {
  if (rt.location !== "world") return false;
  const spot = bookHomeSpot.get(rt.id);
  return !(spot.kind === "hidden" && !state.hideoutsOpened[spot.hideoutId]);
}

/**
 * Przywołanie: wszystkie tomy tej samej serii (albo książki tego samego autora) leżące
 * w sali lecą do koszyka — tyle, ile zmieści koszyk; magia zdejmuje z nich kurz.
 * Zwraca { moved, total } albo null, gdy książka nie ma „rodzeństwa” w sali.
 */
export function spellSummon(bookId) {
  const src = BOOKS.find((b) => b.id === bookId);
  if (!src) return null;
  const sameGroup = (b) => (src.series ? b.series && b.series.name === src.series.name : b.author === src.author);
  const candidates = BOOKS.filter(sameGroup)
    .map((b) => bookRuntime.get(b.id))
    .filter((rt) => rt && isVisibleInWorld(rt));
  if (!candidates.length) return null;
  let moved = 0;
  for (const rt of candidates) {
    if (basket.isFull()) break;
    cleanDustMagically(rt);
    placeBookInBasket(rt);
    rt.el.classList.remove("summoned");
    void rt.el.offsetWidth;
    rt.el.classList.add("summoned");
    moved++;
  }
  refreshStackAccessibility();
  notifyChange();
  return { moved, total: candidates.length };
}

/**
 * Skrzat: odkłada JEDNĄ książkę na właściwy regał — najpierw z koszyka, potem czyste,
 * dostępne książki z sali; wybiera miejsce z pasującą epoką, jeśli jest wolne.
 * Zwraca { bookId, shelf } albo null, gdy nie ma czego odłożyć.
 */
export function elfPlaceOne() {
  const all = [...bookRuntime.values()];
  const fromBasket = all.filter((rt) => rt.location === "basket");
  const fromWorld = all.filter(
    (rt) => isVisibleInWorld(rt) && isBookAccessible(rt.id) && !(dustyBookIds.has(rt.id) && !state.dustCleared.includes(rt.id))
  );
  for (const rt of [...fromBasket, ...fromWorld]) {
    const shelf = LAYOUT.shelfByGenre[rt.book.genre];
    const occ = shelfOccupancy[shelf.genre];
    let slot = shelf.slots.findIndex((s, i) => !occ[i] && s.epoch === rt.book.epoch);
    if (slot === -1) slot = occ.findIndex((x) => !x);
    if (slot === -1) continue;
    const c = shelfSlotCenter(shelf, slot);
    cleanDustMagically(rt);
    placeBookOnShelf(rt, shelf, { x: c.cx, y: c.cyBottom - 10 });
    refreshStackAccessibility();
    return { bookId: rt.id, shelf, slot };
  }
  return null;
}

/** Wąskie API świata dla modułów fali 3 (js/klimat.js). */
export function getWorldApi() {
  return {
    worldLayerEl,
    darknessEl,
    state,
    getCamX: () => camX,
    getCamY: () => camY,
    getZoom: () => worldZoom,
    getVisibleW: visW,
    setCamX,
    isXInView,
    worldToScreenX,
    worldToScreenY,
    toWorldCoords,
    showMsgTip,
    notifyChange,
    candleEls: candleFlameByGenre,
    chandelierEl,
    isDragging: () => !!activeDrag,
  };
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
  showMsgTip(message, screenX, worldToScreenY(shelf.y) - TOPBAR_H - 6); // jak dawniej: dymek wyżej niż górna krawędź regału
  returnBookHome(rt);
  notifyChange();
}

function returnBookHome(rt) {
  if (rt.location === "basket") {
    const idx = state.books[rt.id].basketSlot;
    renderBookInBasket(rt, idx, false);
  } else if (rt.location === "shelf") {
    renderBookOnShelf(rt, state.books[rt.id].shelfSlot, false);
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
  autoScrollLastT = 0;
}

/** Przelicza zakres zoomu z bieżącego rozmiaru okna świata (view.worldH / view.w) i pokazuje/chowa przyciski +/−. */
function updateFit() {
  fitZoom = Math.max(view.worldH / WORLD_H, view.w / WORLD_W);
  maxZoom = Math.max(fitZoom, 1);
  if (zoomControlsEl) zoomControlsEl.classList.toggle("hidden", maxZoom - fitZoom < 0.02);
}

/**
 * Jedyne miejsce, które zmienia kamerę: pozycja (x, y lewego górnego rogu kadru w px świata) i zoom.
 * Zoom jest ograniczony do [fitZoom, maxZoom], pozycja do granic świata przy tym zoomie.
 */
export function setCamera(x, y, z, opts = {}) {
  cancelInertia();
  worldZoom = clamp(Number.isFinite(z) ? z : worldZoom, fitZoom, maxZoom);
  camX = clamp(x, 0, maxCamX());
  camY = clamp(y, 0, maxCamY());
  state.camX = camX;
  worldLayerEl.style.transform = `translate(${-camX * worldZoom}px, ${-camY * worldZoom}px) scale(${worldZoom})`;
  lastVisW = visW();
  lastVisH = visH();
  repositionGlows();
  updateInViewClasses();
  if (!opts.silent) hooks.onCameraChange();
}

export function setCamX(x, opts = {}) {
  setCamera(x, camY, worldZoom, opts);
}

/** Zmienia zoom tak, by punkt sceny (sx, sy) został w tym samym miejscu świata. */
function zoomAt(newZoom, sx, sy) {
  const z = clamp(newZoom, fitZoom, maxZoom);
  const wp = sceneToWorld(sx, sy);
  setCamera(wp.x - sx / z, wp.y - (sy - TOPBAR_H) / z, z);
}

function zoomBy(factor) {
  zoomAt(worldZoom * factor, view.w / 2, TOPBAR_H + view.worldH / 2);
}

/**
 * Zmiana rozmiaru okna / obrót: przelicza zakres zoomu i kadr, zachowując środek kadru.
 * Jeśli widok był dopasowany (zoom = fitZoom), zostaje dopasowany do nowej wysokości okna.
 */
export function relayoutWorld() {
  if (!worldLayerEl || !state) return;
  if (view.w < view.h) return; // pion: nakładka „Obróć urządzenie” zasłania salę — kadr zostaje, wróci po obrocie
  const wasFit = worldZoom <= fitZoom + 1e-6;
  const cx = camX + (lastVisW || visW()) / 2;
  const cy = camY + (lastVisH || visH()) / 2;
  updateFit();
  const z = wasFit ? fitZoom : clamp(worldZoom, fitZoom, maxZoom);
  worldZoom = z;
  setCamera(cx - visW() / 2, cy - visH() / 2, z);
  // Koszyk jest wyśrodkowany w scenie o zmiennej szerokości — rzeczy w nim idą za nim.
  for (const rt of bookRuntime.values()) {
    const rec = state.books[rt.id];
    if (rt.location === "basket" && rec && rec.basketSlot != null) renderBookInBasket(rt, rec.basketSlot, true);
  }
  for (const rt of pageRuntime.values()) {
    if (rt.location === "basket" && state.pagesInBasket && state.pagesInBasket[rt.id] != null) {
      renderPageInBasket(rt, state.pagesInBasket[rt.id]);
    }
  }
}

/** Położenie kamery dla innych modułów (mini-mapa): lewy róg kadru, zoom i widoczna szerokość w px świata. */
export function getCamera() {
  return { camX, camY, zoom: worldZoom, visW: visW(), visH: visH() };
}

// Auto-przewijanie pod niesioną książką/kartką: strefa krawędzi EDGE_ZONE (120px),
// prędkość rośnie z krzywą speed² (łagodne przyspieszanie), szczyt ~34 px/klatkę
// (AUTOSCROLL_MAX_SPEED px/s licząc realny czas między klatkami, nie licznik klatek —
// dzięki temu tempo nie zależy od odświeżania ekranu). `autoScrollPointerX/Y` trzymają
// NAJŚWIEŻSZĄ pozycję wskaźnika (aktualizowaną w maybeAutoScroll przy każdym ruchu),
// więc pętla rAF zawsze liczy prędkość na bieżąco — nie zamyka się w domknięciu
// starej wartości z chwili startu (dawny błąd: pętla raz wystartowana ignorowała
// dalszy ruch palca/rysika, dopóki nie wyszedł ze strefy krawędzi).
// Od 0.9: gdy jest zapas w pionie (telefon / zoom), przewija też w pionie — przy górnej
// i dolnej krawędzi okna świata (dolna strefa pomija okolice koszyka, bo tam się odkłada).
function autoScrollVector() {
  const sp = toSceneCoords(autoScrollPointerX, autoScrollPointerY);
  let fx = 0;
  let fy = 0;
  if (sp.x < EDGE_ZONE) fx = -(EDGE_ZONE - sp.x) / EDGE_ZONE;
  else if (sp.x > view.w - EDGE_ZONE) fx = (sp.x - (view.w - EDGE_ZONE)) / EDGE_ZONE;
  if (maxCamY() > 0) {
    const top = TOPBAR_H;
    const bottom = TOPBAR_H + view.worldH;
    if (sp.y < top + EDGE_ZONE_Y) {
      fy = -(top + EDGE_ZONE_Y - sp.y) / EDGE_ZONE_Y;
    } else if (sp.y <= bottom && sp.y > bottom - EDGE_ZONE_Y) {
      const cr = basket.rect();
      const overCart = sp.x >= cr.x - 40 && sp.x <= cr.x + cr.width + 40;
      if (!overCart) fy = (sp.y - (bottom - EDGE_ZONE_Y)) / EDGE_ZONE_Y;
    }
  }
  return { fx: clamp(fx, -1, 1), fy: clamp(fy, -1, 1) };
}

function autoScrollTick(ts) {
  if (!autoScrollLastT) autoScrollLastT = ts;
  const dt = Math.min(50, ts - autoScrollLastT);
  autoScrollLastT = ts;

  const { fx, fy } = autoScrollVector();
  if (fx === 0 && fy === 0) {
    cancelAutoScroll();
    return;
  }
  // Prędkość liczona w pikselach EKRANU (po zoomie), żeby tempo było takie samo przy każdym zoomie.
  const speedX = (Math.sign(fx) * fx * fx * AUTOSCROLL_MAX_SPEED) / worldZoom;
  const speedY = (Math.sign(fy) * fy * fy * AUTOSCROLL_MAX_SPEED * 0.6) / worldZoom;
  setCamera(camX + speedX * (dt / 1000), camY + speedY * (dt / 1000), worldZoom);
  autoScrollRaf = requestAnimationFrame(autoScrollTick);
}

function maybeAutoScroll(clientX, clientY) {
  autoScrollPointerX = clientX;
  autoScrollPointerY = clientY;
  const { fx, fy } = autoScrollVector();
  const nearEdge = fx !== 0 || fy !== 0;
  if (nearEdge && !autoScrollRaf) {
    autoScrollLastT = 0;
    autoScrollRaf = requestAnimationFrame(autoScrollTick);
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
    startClientY: e.clientY,
    startCamX: camX,
    startCamY: camY,
    moved: false,
    samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }],
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
  const dy = e.clientY - activeDrag.startClientY;
  if (!activeDrag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    activeDrag.moved = true;
    worldViewportEl.classList.add("panning");
  }
  if (activeDrag.moved) {
    const k = sceneScale() * worldZoom; // px ekranu na px świata
    setCamera(activeDrag.startCamX - dx / k, activeDrag.startCamY - dy / k, worldZoom); // oś pionowa działa tylko przy zapasie (clamp)
    activeDrag.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (activeDrag.samples.length > 5) activeDrag.samples.shift();
  }
}

function finishPan(e) {
  const drag = activeDrag;
  activeDrag = null;
  worldViewportEl.classList.remove("panning");
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
    const k = sceneScale() * worldZoom;
    const vx = -((last.x - first.x) / k / dt) * 16; // px świata/klatkę (~60fps)
    const vy = -((last.y - first.y) / k / dt) * 16;
    runInertia(vx, vy);
  }
}

function runInertia(vx, vy) {
  cancelInertia();
  function step() {
    if (Math.hypot(vx, vy) < 0.05) {
      inertiaRaf = null;
      return;
    }
    setCamera(camX + vx, camY + vy, worldZoom);
    vx *= INERTIA_DECAY;
    vy *= INERTIA_DECAY;
    if (camX <= 0 || camX >= maxCamX()) vx = 0; // oparcie o brzeg zeruje tylko tę oś
    if (camY <= 0 || camY >= maxCamY()) vy = 0;
    if (vx === 0 && vy === 0) {
      inertiaRaf = null;
      return;
    }
    inertiaRaf = requestAnimationFrame(step);
  }
  step();
}

// --- Zoom: szczypanie dwoma palcami, kółko z Ctrl, przyciski +/−, klawiatura ---------

/**
 * Drugi palec w oknie świata zamienia przesuwanie (lub niezaczęte jeszcze chwytanie książki)
 * w szczypanie. Niesionej już książki/kartki nie przerywamy. Wołane w fazie przechwytywania,
 * żeby zadziałać także wtedy, gdy palec trafił w książkę, kartkę, kryjówkę lub warstwę kurzu.
 */
function onScenePointerDownCapture(e) {
  if (e.pointerType !== "touch") return;
  if (!worldViewportEl.contains(e.target) || e.target.closest("#zoom-controls")) return;
  touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchPts.size !== 2 || maxZoom - fitZoom < 0.02) return;

  const d = activeDrag;
  if (d) {
    const unmovedGrab = (d.type === "book" || d.type === "page" || d.type === "hideout") && !d.moved;
    if (d.type !== "pan" && !unmovedGrab) return;
    if (unmovedGrab) {
      const el = d.type === "book" ? bookRuntime.get(d.id)?.el : d.type === "page" ? pageRuntime.get(d.id)?.el : hideoutElById[d.id];
      try {
        el && el.releasePointerCapture(d.pointerId);
      } catch (err) {
        /* ignorowane */
      }
    } else {
      try {
        worldViewportEl.releasePointerCapture(d.pointerId);
      } catch (err) {
        /* ignorowane */
      }
    }
  }
  cancelInertia();
  cancelAutoScroll();
  hideHoverTip();
  const ids = Array.from(touchPts.keys());
  const a = touchPts.get(ids[0]);
  const b = touchPts.get(ids[1]);
  const mid = toSceneCoords((a.x + b.x) / 2, (a.y + b.y) / 2);
  activeDrag = {
    type: "pinch",
    ids,
    startDist: Math.max(40, Math.hypot(a.x - b.x, a.y - b.y)),
    startZoom: worldZoom,
    anchorWorld: sceneToWorld(mid.x, mid.y),
  };
  worldViewportEl.classList.remove("panning");
  e.stopPropagation(); // drugi palec nie zaczyna żadnego chwytania
}

function handlePinchMove() {
  const d = activeDrag;
  const a = touchPts.get(d.ids[0]);
  const b = touchPts.get(d.ids[1]);
  if (!a || !b) return;
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  const mid = toSceneCoords((a.x + b.x) / 2, (a.y + b.y) / 2);
  const z = clamp((d.startZoom * dist) / d.startDist, fitZoom, maxZoom);
  // Punkt świata spod środka szczypnięcia zostaje pod środkiem (to też przesuwa kadr razem z palcami).
  setCamera(d.anchorWorld.x - mid.x / z, d.anchorWorld.y - (mid.y - TOPBAR_H) / z, z);
}

/** Palec podniesiony/anulowany: kończy szczypanie, a pozostały palec przejmuje przesuwanie. */
function touchEnded(e) {
  if (e.pointerType !== "touch") return;
  touchPts.delete(e.pointerId);
  const d = activeDrag;
  if (d && d.type === "pinch" && d.ids.includes(e.pointerId)) {
    const rest = d.ids.find((id) => id !== e.pointerId);
    const pt = touchPts.get(rest);
    activeDrag = null;
    if (pt) {
      activeDrag = {
        type: "pan",
        pointerId: rest,
        startClientX: pt.x,
        startClientY: pt.y,
        startCamX: camX,
        startCamY: camY,
        moved: false,
        samples: [{ t: performance.now(), x: pt.x, y: pt.y }],
      };
      try {
        worldViewportEl.setPointerCapture(rest);
      } catch (err) {
        /* ignorowane */
      }
    }
  }
}

function onWheel(e) {
  e.preventDefault(); // bez tego Ctrl+kółko/szczypanie na gładziku powiększałoby całą stronę
  if (activeDrag && activeDrag.type !== "pan") return;
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.deltaMode === 1) {
    dx *= 16;
    dy *= 16;
  } else if (e.deltaMode === 2) {
    dx *= view.w;
    dy *= view.h;
  }
  if (e.ctrlKey) {
    // Ctrl+kółko albo szczypanie na gładziku (przeglądarka zgłasza je jako kółko z ctrlKey) = zoom wokół kursora.
    const sp = toSceneCoords(e.clientX, e.clientY);
    zoomAt(worldZoom * Math.exp(-clamp(dy, -60, 60) * 0.01), sp.x, sp.y);
    return;
  }
  // Kółko / dwa palce na gładziku = przesuwanie sali w poziomie (deltaX lub deltaY, co silniejsze).
  const k = sceneScale() * worldZoom;
  const horiz = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  setCamera(camX + horiz / k, camY, worldZoom);
}

function isModalOpen() {
  return !!document.querySelector(".modal:not(.hidden), #ksiazka-overlay.visible, .zadania-karta:not(.hidden)");
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // pole tekstowe / suwak: klawisze są jego
  if (isModalOpen() || activeDrag) return;
  const k = sceneScale() * worldZoom;
  switch (e.key) {
    case "ArrowLeft":
      setCamera(camX - KEY_PAN_PX / k, camY, worldZoom);
      break;
    case "ArrowRight":
      setCamera(camX + KEY_PAN_PX / k, camY, worldZoom);
      break;
    case "ArrowUp":
      setCamera(camX, camY - KEY_PAN_PX / k, worldZoom);
      break;
    case "ArrowDown":
      setCamera(camX, camY + KEY_PAN_PX / k, worldZoom);
      break;
    case "+":
    case "=":
      zoomBy(ZOOM_STEP);
      break;
    case "-":
    case "_":
      zoomBy(1 / ZOOM_STEP);
      break;
    default:
      return;
  }
  e.preventDefault();
}

function wireZoomControls() {
  worldViewportEl.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("keydown", onKeyDown);
  document.getElementById("zoom-in")?.addEventListener("click", () => zoomBy(ZOOM_STEP));
  document.getElementById("zoom-out")?.addEventListener("click", () => zoomBy(1 / ZOOM_STEP));
  // Safari: gesty szczypania strony nie mogą powiększać sceny (gesturestart blokuje też js/game.js globalnie).
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    sceneEl.addEventListener(type, (ev) => ev.preventDefault());
  }
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
  if (e.pointerType === "mouse" && e.button !== 0) return; // prawy/środkowy przycisk myszy nie chwyta ani nie przesuwa
  if (activeDrag) return;

  const bookEl = e.target.closest(".book-item");
  const pageEl = !bookEl ? e.target.closest(".page-item") : null;
  const hideoutEl = !bookEl && !pageEl ? e.target.closest(".hideout") : null;

  if (!bookEl && !pageEl && !hideoutEl) {
    if (e.target.closest(".slot-badge, .wipe-canvas, #zoom-controls")) return; // podgląd/przecieranie/przyciski zoomu, nie panoramowanie
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
  // Lewy górny róg książki na ekranie (grzbiet na regale stoi dolną krawędzią na półce).
  // Książka w świecie jest na ekranie w skali worldZoom (w koszyku zawsze 1) — niesiona ma już skalę 1,12,
  // więc punkt chwytu przeliczamy na jednostki książki (dzielenie przez z), żeby palec został na tym samym jej miejscu.
  const z = rt.location === "basket" ? 1 : worldZoom;
  let originTop;
  if (rt.location === "basket") originTop = { x: rt.x - w / 2, y: rt.y - BOOK_COVER_H / 2 };
  else if (rt.location === "shelf") originTop = { x: worldToScreenX(rt.x) - (w * z) / 2, y: worldToScreenY(rt.y) - spineSize(rt).h * z };
  else originTop = { x: worldToScreenX(rt.x) - (w * z) / 2, y: worldToScreenY(rt.y) - (BOOK_COVER_H * z) / 2 };

  activeDrag = {
    type: "book",
    id: rt.id,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
    // Od 0.6.3 książkę z regału można nieść: do koszyka (zdjęcie), na inne miejsce tego regału
    // (przestawienie) albo na rewersy.
    draggable: true,
    grabDX: (scenePt.x - originTop.x) / z,
    grabDY: (scenePt.y - originTop.y) / z,
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
  const z = rt.location === "basket" ? 1 : worldZoom;
  const screenX = rt.location === "basket" ? rt.x : worldToScreenX(rt.def.x);
  const screenY = rt.location === "basket" ? rt.y : worldToScreenY(rt.def.y);
  activeDrag = {
    type: "page",
    id: rt.id,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
    grabDX: (scenePt.x - (screenX - (PAGE_W * z) / 2)) / z,
    grabDY: (scenePt.y - (screenY - (PAGE_H * z) / 2)) / z,
  };
  try {
    rt.el.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
}

function onWorldPointerMove(e) {
  if (e.pointerType === "touch" && touchPts.has(e.pointerId)) touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeDrag && activeDrag.type === "pinch") {
    handlePinchMove();
    return;
  }
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
  const z = rt.location === "basket" ? 1 : worldZoom;
  const screenX = rt.location === "basket" ? rt.x : worldToScreenX(rt.x);
  const screenY = (rt.location === "basket" ? rt.y : worldToScreenY(rt.y)) - ((rt.location === "shelf" ? spineSize(rt).h / 2 : BOOK_COVER_H / 2) * z) - 6;
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

  maybeAutoScroll(e.clientX, e.clientY);
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
  maybeAutoScroll(e.clientX, e.clientY);
  updateFolderHighlight(scenePt);
  if (rt.location === "world") updateBasketHighlight(scenePt);
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
  const worldPt = sceneToWorld(scenePt.x, scenePt.y);
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
  touchEnded(e);
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

  // Zadania 0.6 (np. rewersy czytelników na biurku) mają pierwszeństwo przed koszykiem i regałami.
  const hr = runDropHandlers({
    kind: "book",
    id: rt.id,
    clientX: e.clientX,
    clientY: e.clientY,
    worldPt: toWorldCoords(e.clientX, e.clientY),
    scenePt,
    fromBasket: drag.originLocation === "basket",
  });
  if (hr) {
    if (hr.reject) showMsgTip(hr.reject, scenePt.x, Math.max(90, scenePt.y - 30), 2800);
    if (hr.then === "basket" && rt.location === "world" && !basket.isFull()) {
      placeBookInBasket(rt);
      return;
    }
    returnBookHome(rt);
    notifyChange();
    return;
  }

  if (drag.originLocation === "shelf") {
    const br = basket.rect();
    const toBasket = scenePt.x >= br.x && scenePt.x <= br.x + br.width && scenePt.y >= br.y && scenePt.y <= br.y + br.height;
    const wp = toWorldCoords(e.clientX, e.clientY);
    const target = shelfAt(wp);
    if (toBasket) takeOffShelf(rt);
    else if (target && target.genre === rt.book.genre) moveWithinShelf(rt, target, wp);
    else if (target) rejectDrop(rt, target, "Ta książka szuka regału innego gatunku.");
    else {
      showMsgTip("Książkę z regału przestawisz na tym regale albo zdejmiesz do koszyka.", scenePt.x, Math.max(90, scenePt.y - 30), 2800);
      returnBookHome(rt);
      notifyChange();
    }
    return;
  }

  const basketRect = basket.rect();
  const inBasket =
    scenePt.x >= basketRect.x &&
    scenePt.x <= basketRect.x + basketRect.width &&
    scenePt.y >= basketRect.y &&
    scenePt.y <= basketRect.y + basketRect.height;

  if (inBasket) {
    if (rt.location === "basket") {
      returnBookHome(rt); // przesunięta w obrębie koszyka — zostaje na swoim miejscu
    } else if (basket.isFull()) {
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

  if (!drag.moved) {
    if (pageTapHandler) pageTapHandler(rt.id); // od 0.6: stuknięcie kartki pokazuje jej fragment
    return;
  }
  rt.el.classList.remove("dragging");
  clearDragHighlights();

  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const worldPt = sceneToWorld(scenePt.x, scenePt.y);

  // Od 0.6 kartka wraca do SWOJEJ książki (js/zadania.js decyduje, czy pasuje).
  const hr = runDropHandlers({ kind: "page", id: rt.id, clientX: e.clientX, clientY: e.clientY, worldPt, scenePt });
  if (hr) {
    if (hr.consumed) {
      consumePage(rt);
      return;
    }
    if (hr.reject) {
      showMsgTip(hr.reject, scenePt.x, Math.max(90, scenePt.y - 30), 2800);
      returnPageHome(rt);
      return;
    }
  }

  const f = LAYOUT.folder;
  const inFolder = worldPt.x >= f.x && worldPt.x <= f.x + f.w && worldPt.y >= f.y && worldPt.y <= f.y + f.h;
  if (inFolder) {
    showMsgTip("Ta kartka wypadła z którejś książki — przeciągnij ją na właściwą książkę.", scenePt.x, Math.max(90, scenePt.y - 30), 3000);
    returnPageHome(rt);
    return;
  }

  const br = basket.rect();
  const inBasket = scenePt.x >= br.x && scenePt.x <= br.x + br.width && scenePt.y >= br.y && scenePt.y <= br.y + br.height;
  if (inBasket && rt.location === "world") {
    if (basket.isFull()) {
      showMsgTip("Koszyk pełny — odnieś coś z koszyka.", br.x + br.width / 2, br.y - 6);
    } else {
      const slot = basket.findFreeSlot();
      basket.assign(slot, rt.id);
      state.pagesInBasket[rt.id] = slot;
      renderPageInBasket(rt, slot);
      playPaper();
      notifyChange();
      return;
    }
  }

  returnPageHome(rt);
}

function onPointerCancelAnywhere(e) {
  touchEnded(e);
  if (activeDrag && activeDrag.pointerId === e.pointerId) {
    if (activeDrag.type === "pan") {
      worldViewportEl.classList.remove("panning");
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
        returnPageHome(rt);
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
  if (!state.hintsShown) state.hintsShown = {};
  seamPilasterEls = [];

  cacheDom();

  const assignment = computeAssignment(state.seed);
  bookHomeSpot = assignment.homeSpot;
  spotToBook = assignment.spotBook;
  dustyBookIds = assignment.dustyIds;

  basket = createBasket(cartEl, basketCounterEl, getLogicalRect, 6);

  worldLayerEl.style.width = `${WORLD_W}px`;
  worldLayerEl.style.height = `${WORLD_H}px`;
  updateFit();
  worldZoom = fitZoom; // start zawsze w dopasowaniu (cała wysokość sali w oknie); na iPadzie fitZoom = 1

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

  migrateNagrody();
  for (const shelf of LAYOUT.shelves) shelfElByGenre[shelf.genre].classList.toggle("complete", isShelfFull(shelf.genre));
  for (const genreId of state.completedShelves) {
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
  sceneEl.addEventListener("pointerdown", onScenePointerDownCapture, true);
  sceneEl.addEventListener("pointerdown", onScenePointerDown);
  wireZoomControls();
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
  // Test: ?zoom=Z ustawia przybliżenie (w granicach fitZoom..maxZoom), ?kameray=Y przesuwa kadr w pionie.
  const qp = new URLSearchParams(location.search);
  const camParam = Number(qp.get("kamera"));
  const zoomParam = Number(qp.get("zoom"));
  const camYParam = Number(qp.get("kameray"));
  setCamera(
    Number.isFinite(camParam) && camParam > 0 ? camParam : state.camX || 0,
    Number.isFinite(camYParam) ? camYParam : 0,
    Number.isFinite(zoomParam) && zoomParam > 0 ? zoomParam : fitZoom,
    { silent: true }
  );
  requestAnimationFrame(() => {
    document.querySelectorAll(".no-anim").forEach((el) => el.classList.remove("no-anim"));
  });

  applyOrderGleam();
  if (computeStats(state).percent >= 100) {
    lightChandelier();
  }

  return { setCamX, setAmbient, relayout: relayoutWorld };
}
