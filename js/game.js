// js/game.js
// Etap 1 — grywalny szkic. Cała logika gry w jednym module, bez frameworków.
// Współrzędne: scena ma stały rozmiar logiczny 1366×1024, skalowana CSS transform.
// Wszystkie książki (na wózku i na regałach) są jednym zbiorem elementów w #books-layer,
// pozycjonowanych absolutnie w układzie logicznym sceny — to upraszcza matematykę przeciągania.

import { EPOCHS, EPOCH_BY_ID, BOOKS } from "./books.js";
import { unlockAudio, playPlaceGood, playMistake, playShelfComplete } from "./sound.js";

const LOGICAL_W = 1366;
const LOGICAL_H = 1024;
const STORAGE_KEY = "biblioteka.v1";
const SLOTS_PER_SHELF = 6;
const DRAG_THRESHOLD = 8; // px w jednostkach ekranu (przed przeliczeniem skali)
const TOTAL_BOOKS = BOOKS.length;

const BOOK_COVER_W = 72;
const BOOK_COVER_H = 100;
const BOOK_SPINE_W = 46;
const BOOK_SPINE_H = 148;

const CART_COLS = 15;
const CART_ROWS = 2;

const SPELL_INFO = {
  wglad: "Każda książka na wózku dostanie znak swojego regału i zaświeci jego kolorem — pomaga rozpoznać trudne tytuły (20 sekund).",
  przywolanie: "Wszystkie tomy tej samej serii (albo książki tego samego autora) zlecą się w jeden stos, który przeniesiesz jednym ruchem.",
  skrzat: "Skrzat biblioteczny sam odłoży kilka książek, przyspieszając porządkowanie (30 sekund).",
};

// ---------------------------------------------------------------------------
// Stan gry i zapis
// ---------------------------------------------------------------------------

function defaultState() {
  return {
    version: 1,
    seed: Math.floor(Math.random() * 1_000_000_000),
    placed: {},
    ink: 0,
    mistakes: 0,
    startedAt: Date.now(),
    playMs: 0,
    completedShelves: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return defaultState();
    return {
      version: 1,
      seed: Number.isFinite(parsed.seed) ? parsed.seed : defaultState().seed,
      placed: parsed.placed && typeof parsed.placed === "object" ? parsed.placed : {},
      ink: clamp(Number(parsed.ink) || 0, 0, 20),
      mistakes: Number(parsed.mistakes) || 0,
      startedAt: Number(parsed.startedAt) || Date.now(),
      playMs: Number(parsed.playMs) || 0,
      completedShelves: Array.isArray(parsed.completedShelves) ? parsed.completedShelves : [],
    };
  } catch (err) {
    console.warn("Nie udało się wczytać zapisu — zaczynam od nowa.", err);
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Nie udało się zapisać stanu gry.", err);
  }
}

let state = defaultState();

// ---------------------------------------------------------------------------
// Drobne narzędzia: PRNG, hash, kolory
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Deterministyczny generator liczb pseudolosowych (mulberry32). */
function mulberry32(seed) {
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
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministyczna wariacja jasności okładki, zależna wyłącznie od id książki. */
function brightnessVariant(id) {
  return (hashString(id) % 41) - 20; // -20..20
}

/** Deterministyczny kąt obrotu okładki na wózku, zależny od id książki. */
function rotationForId(id) {
  return (hashString("rot-" + id) % 121) / 10 - 6; // -6..6.05 stopnia
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0xff) + percent;
  let b = (num & 0xff) + percent;
  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// DOM — referencje
// ---------------------------------------------------------------------------

let sceneEl, sceneWrapEl, booksLayerEl, shelvesAreaEl, cartEl, vignetteEl;
let progressEl, inkCountEl, rotateOverlayEl;
let hoverTipEl, mistakeTipEl, shelfBannerEl, spellTipEl;
let bookModalEl, bookCardCoverEl, bookCardMarkEl, bookCardTitleEl, bookCardAuthorEl;
let bookCardYearEl, bookCardSeriesEl, bookCardEpochEl, bookCardHintEl;
let confirmModalEl, menuModalEl, endModalEl, endMistakesEl, endTimeEl;
let menuBtnEl, spellBtnEls;

function cacheDom() {
  sceneEl = document.getElementById("scene");
  sceneWrapEl = document.getElementById("scene-wrap");
  booksLayerEl = document.getElementById("books-layer");
  shelvesAreaEl = document.getElementById("shelves-area");
  cartEl = document.getElementById("cart");
  vignetteEl = document.getElementById("vignette");
  progressEl = document.getElementById("progress");
  inkCountEl = document.getElementById("ink-count");
  rotateOverlayEl = document.getElementById("rotate-overlay");
  hoverTipEl = document.getElementById("hover-tip");
  mistakeTipEl = document.getElementById("mistake-tip");
  shelfBannerEl = document.getElementById("shelf-banner");
  spellTipEl = document.getElementById("spell-tip");

  bookModalEl = document.getElementById("book-modal");
  bookCardCoverEl = document.getElementById("book-card-cover");
  bookCardMarkEl = document.getElementById("book-card-mark");
  bookCardTitleEl = document.getElementById("book-card-title");
  bookCardAuthorEl = document.getElementById("book-card-author");
  bookCardYearEl = document.getElementById("book-card-year");
  bookCardSeriesEl = document.getElementById("book-card-series");
  bookCardEpochEl = document.getElementById("book-card-epoch");
  bookCardHintEl = document.getElementById("book-card-hint");

  confirmModalEl = document.getElementById("confirm-modal");
  menuModalEl = document.getElementById("menu-modal");
  endModalEl = document.getElementById("end-modal");
  endMistakesEl = document.getElementById("end-mistakes");
  endTimeEl = document.getElementById("end-time");

  menuBtnEl = document.getElementById("menu-btn");
  spellBtnEls = Array.from(document.querySelectorAll(".spell-btn"));
}

// ---------------------------------------------------------------------------
// Geometria: przeliczanie współrzędnych ekranu na logiczne współrzędne sceny
// ---------------------------------------------------------------------------

function getLogicalRect(el) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const scale = sceneRect.width / LOGICAL_W || 1;
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - sceneRect.left) / scale,
    y: (r.top - sceneRect.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

function toSceneCoords(clientX, clientY) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const scale = sceneRect.width / LOGICAL_W || 1;
  return {
    x: (clientX - sceneRect.left) / scale,
    y: (clientY - sceneRect.top) / scale,
  };
}

let shelfSlotRects = {}; // epochId -> [{cx,cy,width,height}] x6, w kolejności czytania
let shelfRectsByEpoch = {}; // epochId -> {x,y,width,height} całego regału
let cartRectLogical = null;

function computeGeometry() {
  shelfSlotRects = {};
  shelfRectsByEpoch = {};
  for (const epoch of EPOCHS) {
    const shelfEl = shelfElsByEpoch[epoch.id];
    shelfRectsByEpoch[epoch.id] = getLogicalRect(shelfEl);
    const slots = shelfEl.querySelectorAll(".slot");
    const rects = [];
    slots.forEach((slotEl) => {
      const r = getLogicalRect(slotEl);
      rects.push({ cx: r.x + r.width / 2, cy: r.y + r.height / 2, width: r.width, height: r.height });
    });
    shelfSlotRects[epoch.id] = rects;
  }
  cartRectLogical = getLogicalRect(cartEl);
}

function cartCellPosition(index) {
  const col = index % CART_COLS;
  const row = Math.floor(index / CART_COLS);
  const padX = 50;
  const padY = 70; // pół wysokości okładki + margines, żeby dolny rząd nie wychodził poza wózek
  const usableW = Math.max(1, cartRectLogical.width - padX * 2);
  const usableH = Math.max(1, cartRectLogical.height - padY * 2);
  const cx = cartRectLogical.x + padX + (CART_COLS > 1 ? (usableW * col) / (CART_COLS - 1) : usableW / 2);
  const cy = cartRectLogical.y + padY + (CART_ROWS > 1 ? (usableH * row) / (CART_ROWS - 1) : usableH / 2);
  return { cx, cy };
}

function findShelfAt(pt) {
  for (const epoch of EPOCHS) {
    const r = shelfRectsByEpoch[epoch.id];
    if (pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height) {
      return epoch.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Skalowanie sceny (letterbox) i nakładka orientacji
// ---------------------------------------------------------------------------

function updateScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / LOGICAL_W, vh / LOGICAL_H);
  sceneEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  updatePortraitOverlay();
}

function updatePortraitOverlay() {
  const portrait = window.innerHeight > window.innerWidth;
  rotateOverlayEl.classList.toggle("hidden", !portrait);
}

// ---------------------------------------------------------------------------
// Regały — budowa DOM
// ---------------------------------------------------------------------------

const shelfElsByEpoch = {};

function renderShelves() {
  shelvesAreaEl.innerHTML = "";
  for (const epoch of EPOCHS) {
    const shelfEl = document.createElement("div");
    shelfEl.className = "shelf";
    shelfEl.dataset.epoch = epoch.id;
    shelfEl.innerHTML = `
      <div class="shelf-plaque">
        <span class="plaque-mark">${epoch.mark}</span>
        <span class="plaque-name">${escapeHtml(epoch.name)}</span>
        <span class="plaque-range">${escapeHtml(epoch.range)}</span>
      </div>
      <div class="shelf-body">
        <div class="shelf-row">
          <div class="slot empty" data-slot="0"></div>
          <div class="slot empty" data-slot="1"></div>
          <div class="slot empty" data-slot="2"></div>
        </div>
        <div class="shelf-row">
          <div class="slot empty" data-slot="3"></div>
          <div class="slot empty" data-slot="4"></div>
          <div class="slot empty" data-slot="5"></div>
        </div>
      </div>`;
    shelvesAreaEl.appendChild(shelfEl);
    shelfElsByEpoch[epoch.id] = shelfEl;
  }
}

function applyCompletedShelvesVisual() {
  for (const epochId of state.completedShelves) {
    const shelfEl = shelfElsByEpoch[epochId];
    if (shelfEl) shelfEl.classList.add("complete");
  }
}

// ---------------------------------------------------------------------------
// Książki — budowa i pozycjonowanie
// ---------------------------------------------------------------------------

const bookRuntime = new Map(); // id -> {id, book, el, location, x, y, rot}
const cartIndexById = {};
const rotById = {};

function coverInnerHtml(book) {
  const epoch = EPOCH_BY_ID[book.epoch];
  return (
    `<div class="cover-frame"></div>` +
    `<span class="cover-mark">${epoch.mark}</span>` +
    `<span class="cover-title">${escapeHtml(book.title)}</span>` +
    `<span class="cover-author">${escapeHtml(book.author)}</span>`
  );
}

function spineInnerHtml(book) {
  const epoch = EPOCH_BY_ID[book.epoch];
  return `<span class="spine-title">${escapeHtml(book.title)}</span><span class="spine-mark">${epoch.mark}</span>`;
}

function applyTransform(el, x, y, rotDeg, scale) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rotDeg}deg) scale(${scale})`;
}

function buildBooksLayer() {
  booksLayerEl.innerHTML = "";
  bookRuntime.clear();
  for (const book of BOOKS) {
    const isPlaced = !!state.placed[book.id];
    const el = document.createElement("div");
    el.className = (isPlaced ? "book-spine" : "book-cover") + " no-anim";
    el.innerHTML = isPlaced ? spineInnerHtml(book) : coverInnerHtml(book);
    el.style.background = shadeColor(EPOCH_BY_ID[book.epoch].baseColor, brightnessVariant(book.id));
    booksLayerEl.appendChild(el);

    const rt = { id: book.id, book, el, location: isPlaced ? "shelf" : "cart", x: 0, y: 0, rot: rotById[book.id] };
    bookRuntime.set(book.id, rt);
    attachBookListeners(el, book.id);
  }
}

function getSortedShelfBooks(epochId) {
  const list = [];
  for (const rt of bookRuntime.values()) {
    if (rt.location === "shelf" && rt.book.epoch === epochId) list.push(rt);
  }
  list.sort((a, b) => {
    const byAuthor = a.book.authorSort.localeCompare(b.book.authorSort, "pl");
    if (byAuthor !== 0) return byAuthor;
    return (a.book.series?.vol ?? 0) - (b.book.series?.vol ?? 0);
  });
  return list;
}

function layoutShelf(epochId) {
  const list = getSortedShelfBooks(epochId);
  const rects = shelfSlotRects[epochId];
  list.forEach((rt, i) => {
    const slot = rects[i];
    if (!slot) return;
    const x = slot.cx - BOOK_SPINE_W / 2;
    const y = slot.cy - BOOK_SPINE_H / 2;
    rt.x = x;
    rt.y = y;
    applyTransform(rt.el, x, y, 0, 1);
  });
  const slotEls = shelfElsByEpoch[epochId].querySelectorAll(".slot");
  slotEls.forEach((slotEl, i) => slotEl.classList.toggle("empty", i >= list.length));
}

function layoutCartBook(rt) {
  const { cx, cy } = cartCellPosition(cartIndexById[rt.id]);
  const x = cx - BOOK_COVER_W / 2;
  const y = cy - BOOK_COVER_H / 2;
  rt.x = x;
  rt.y = y;
  applyTransform(rt.el, x, y, rt.rot, 1);
}

function layoutAll() {
  for (const rt of bookRuntime.values()) {
    if (rt.location === "cart") layoutCartBook(rt);
  }
  for (const epoch of EPOCHS) layoutShelf(epoch.id);
}

function countPlacedInShelf(epochId) {
  return BOOKS.reduce((n, b) => n + (b.epoch === epochId && state.placed[b.id] ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// UI: pasek postępu, atrament, winieta
// ---------------------------------------------------------------------------

function updateProgressUI() {
  const placedCount = Object.keys(state.placed).length;
  progressEl.textContent = `${placedCount} / ${TOTAL_BOOKS}`;
}

function updateInkUI() {
  inkCountEl.textContent = String(state.ink);
}

function updateVignette() {
  const placedCount = Object.keys(state.placed).length;
  const opacity = 0.65 - placedCount * ((0.65 - 0.05) / TOTAL_BOOKS);
  vignetteEl.style.opacity = String(clamp(opacity, 0.05, 0.65));
}

// ---------------------------------------------------------------------------
// Dymki i banery
// ---------------------------------------------------------------------------

let hoverHideTimer = null;

function showHoverTip(rt) {
  const book = rt.book;
  const width = rt.location === "shelf" ? BOOK_SPINE_W : BOOK_COVER_W;
  let html = `<strong>${escapeHtml(book.title)}</strong><span class="hover-tip-author">${escapeHtml(book.author)}</span>`;
  if (book.series) {
    html += `<span class="hover-tip-series">Tom ${book.series.vol} z ${book.series.of}</span>`;
  }
  hoverTipEl.innerHTML = html;
  hoverTipEl.style.left = `${rt.x + width / 2}px`;
  hoverTipEl.style.top = `${rt.y - 6}px`;
  hoverTipEl.classList.remove("hidden");
  clearTimeout(hoverHideTimer);
}

function hideHoverTip() {
  hoverTipEl.classList.add("hidden");
}

let mistakeTipTimer = null;

function showMistakeTip(shelfEl) {
  const r = getLogicalRect(shelfEl);
  mistakeTipEl.style.left = `${r.x + r.width / 2}px`;
  mistakeTipEl.style.top = `${r.y - 6}px`;
  mistakeTipEl.classList.remove("hidden");
  clearTimeout(mistakeTipTimer);
  mistakeTipTimer = setTimeout(() => mistakeTipEl.classList.add("hidden"), 1800);
}

let bannerTimer = null;

function showShelfBanner(epochId) {
  shelfBannerEl.textContent = `Regał «${EPOCH_BY_ID[epochId].name}» uporządkowany!`;
  shelfBannerEl.classList.remove("hidden");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => shelfBannerEl.classList.add("hidden"), 2500);
}

let spellTipTimer = null;

function showSpellTip(btnEl) {
  const unlockN = btnEl.dataset.unlock;
  const spellKey = btnEl.dataset.spell;
  const desc = SPELL_INFO[spellKey] || "";
  const r = getLogicalRect(btnEl);
  spellTipEl.innerHTML = `<strong>Odblokujesz po ukończeniu ${unlockN}. regału</strong><br>${desc}`;
  spellTipEl.style.left = `${r.x + r.width / 2}px`;
  spellTipEl.style.top = `${r.y + r.height + 12}px`;
  spellTipEl.classList.remove("hidden");
  clearTimeout(spellTipTimer);
  spellTipTimer = setTimeout(() => spellTipEl.classList.add("hidden"), 3500);
}

function spawnInkDroplet(epochId, amount) {
  const rect = shelfRectsByEpoch[epochId];
  const el = document.createElement("div");
  el.className = "ink-droplet";
  el.textContent = `+${amount}`;
  el.style.left = `${rect.x + rect.width / 2}px`;
  el.style.top = `${rect.y + 4}px`;
  sceneEl.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// ---------------------------------------------------------------------------
// Modale
// ---------------------------------------------------------------------------

function showModal(el) {
  el.classList.remove("hidden");
}
function hideModal(el) {
  el.classList.add("hidden");
}

function openBookModal(id) {
  const rt = bookRuntime.get(id);
  if (!rt) return;
  const book = rt.book;
  const epoch = EPOCH_BY_ID[book.epoch];

  bookCardCoverEl.style.background = shadeColor(epoch.baseColor, brightnessVariant(book.id));
  bookCardMarkEl.textContent = epoch.mark;
  bookCardTitleEl.textContent = book.title;
  bookCardAuthorEl.textContent = book.author;
  bookCardYearEl.textContent = `Rok: ok. ${book.year}`;

  if (book.series) {
    bookCardSeriesEl.textContent = `Tom ${book.series.vol} z ${book.series.of} — seria «${book.series.name}»`;
    bookCardSeriesEl.classList.remove("hidden");
  } else {
    bookCardSeriesEl.classList.add("hidden");
  }

  if (rt.location === "shelf") {
    bookCardEpochEl.textContent = `Epoka: ${epoch.name}`;
    bookCardEpochEl.classList.remove("hidden");
  } else {
    bookCardEpochEl.classList.add("hidden");
  }

  bookCardHintEl.textContent = book.hint;
  showModal(bookModalEl);
}

function showEndModal() {
  endMistakesEl.textContent = `Liczba pomyłek: ${state.mistakes}`;
  endTimeEl.textContent = `Czas gry: ${formatTime(currentPlayMs())}`;
  showModal(endModalEl);
}

// ---------------------------------------------------------------------------
// Umieszczanie książek na regałach
// ---------------------------------------------------------------------------

function placeBookOnShelf(rt) {
  state.placed[rt.id] = true;
  rt.location = "shelf";
  rt.el.classList.remove("book-cover");
  rt.el.classList.add("book-spine");
  rt.el.innerHTML = spineInnerHtml(rt.book);

  layoutShelf(rt.book.epoch);

  state.ink = clamp(state.ink + 1, 0, 20);
  playPlaceGood();
  spawnInkDroplet(rt.book.epoch, 1);
  updateProgressUI();
  updateInkUI();
  updateVignette();

  const placedInShelf = countPlacedInShelf(rt.book.epoch);
  if (placedInShelf === SLOTS_PER_SHELF && !state.completedShelves.includes(rt.book.epoch)) {
    state.completedShelves.push(rt.book.epoch);
    state.ink = clamp(state.ink + 5, 0, 20);
    updateInkUI();
    shelfElsByEpoch[rt.book.epoch].classList.add("complete");
    playShelfComplete();
    showShelfBanner(rt.book.epoch);
  }

  saveState();
  checkWinCondition();
}

function rejectDrop(rt, targetEpochId) {
  state.mistakes++;
  playMistake();
  const shelfEl = shelfElsByEpoch[targetEpochId];
  shelfEl.classList.add("shake");
  setTimeout(() => shelfEl.classList.remove("shake"), 450);
  showMistakeTip(shelfEl);
  returnBookToCart(rt);
  saveState();
}

function returnBookToCart(rt) {
  layoutCartBook(rt);
}

function checkWinCondition() {
  const placedCount = Object.keys(state.placed).length;
  if (placedCount >= TOTAL_BOOKS) {
    flushPlayTime();
    showEndModal();
  }
}

// ---------------------------------------------------------------------------
// Interakcja wskaźnikowa: przeciąganie, stuknięcie, hover
// ---------------------------------------------------------------------------

let drag = null; // {id, pointerId, startClientX, startClientY, moved, draggable, grabDX, grabDY}

function onBookPointerDown(e, id) {
  const rt = bookRuntime.get(id);
  if (!rt) return;
  e.preventDefault();
  hideHoverTip();
  try {
    rt.el.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane — capture jest tylko usprawnieniem */
  }

  drag = {
    id,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
    draggable: rt.location === "cart",
    grabDX: 0,
    grabDY: 0,
  };

  if (drag.draggable) {
    const scenePt = toSceneCoords(e.clientX, e.clientY);
    drag.grabDX = scenePt.x - rt.x;
    drag.grabDY = scenePt.y - rt.y;
  }
}

function onBookPointerMove(e, id) {
  if (drag && drag.id === id && drag.pointerId === e.pointerId) {
    const rt = bookRuntime.get(id);
    if (!rt) return;
    const dxTotal = e.clientX - drag.startClientX;
    const dyTotal = e.clientY - drag.startClientY;

    if (!drag.moved && Math.hypot(dxTotal, dyTotal) > DRAG_THRESHOLD) {
      drag.moved = true;
      if (drag.draggable) rt.el.classList.add("dragging");
    }

    if (drag.moved && drag.draggable) {
      const scenePt = toSceneCoords(e.clientX, e.clientY);
      const newX = scenePt.x - drag.grabDX;
      const newY = scenePt.y - drag.grabDY;
      rt.x = newX;
      rt.y = newY;
      applyTransform(rt.el, newX, newY, 0, 1.12);
      updateShelfHighlight(scenePt);
    }
    return;
  }

  if (drag) return; // trwa przeciąganie innej książki

  if (e.buttons === 0 && (e.pointerType === "pen" || e.pointerType === "mouse")) {
    const rt = bookRuntime.get(id);
    if (rt) showHoverTip(rt);
  }
}

function updateShelfHighlight(scenePt) {
  const hit = findShelfAt(scenePt);
  for (const epoch of EPOCHS) {
    shelfElsByEpoch[epoch.id].classList.toggle("drag-target", epoch.id === hit);
  }
}

function clearShelfHighlights() {
  for (const epoch of EPOCHS) shelfElsByEpoch[epoch.id].classList.remove("drag-target");
}

function onBookPointerUp(e, id) {
  if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
  const rt = bookRuntime.get(id);
  const wasMoved = drag.moved;
  const wasDraggable = drag.draggable;
  try {
    rt.el.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* ignorowane */
  }
  drag = null;

  if (!rt) return;

  if (!wasMoved) {
    // Stuknięcie bez ruchu = otwórz kartę książki.
    openBookModal(id);
    return;
  }

  if (!wasDraggable) {
    return; // książka na regale — lekki ruch bez efektu
  }

  rt.el.classList.remove("dragging");
  const scenePt = toSceneCoords(e.clientX, e.clientY);
  const targetEpoch = findShelfAt(scenePt);
  clearShelfHighlights();

  if (!targetEpoch) {
    returnBookToCart(rt);
    return;
  }
  if (targetEpoch === rt.book.epoch) {
    placeBookOnShelf(rt);
  } else {
    rejectDrop(rt, targetEpoch);
  }
}

function onBookPointerCancel(e, id) {
  if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
  const rt = bookRuntime.get(id);
  const wasDraggable = drag.draggable;
  const wasMoved = drag.moved;
  drag = null;
  if (rt && wasDraggable && wasMoved) {
    rt.el.classList.remove("dragging");
    clearShelfHighlights();
    returnBookToCart(rt);
  }
}

function onBookPointerLeave(e, id) {
  if (drag && drag.id === id) return;
  hideHoverTip();
}

function attachBookListeners(el, id) {
  el.addEventListener("pointerdown", (e) => onBookPointerDown(e, id));
  el.addEventListener("pointermove", (e) => onBookPointerMove(e, id));
  el.addEventListener("pointerup", (e) => onBookPointerUp(e, id));
  el.addEventListener("pointercancel", (e) => onBookPointerCancel(e, id));
  el.addEventListener("pointerleave", (e) => onBookPointerLeave(e, id));
}

// ---------------------------------------------------------------------------
// Czas gry (liczony tylko, gdy karta jest widoczna)
// ---------------------------------------------------------------------------

let visibleSince = document.visibilityState === "visible" ? performance.now() : null;

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    visibleSince = performance.now();
  } else {
    flushPlayTime();
  }
}

function flushPlayTime() {
  if (visibleSince != null) {
    state.playMs += performance.now() - visibleSince;
    visibleSince = null;
    saveState();
  }
}

function currentPlayMs() {
  let ms = state.playMs;
  if (visibleSince != null) ms += performance.now() - visibleSince;
  return ms;
}

// ---------------------------------------------------------------------------
// Restart gry
// ---------------------------------------------------------------------------

function restartGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Nie udało się wyczyścić zapisu.", err);
  }
  location.reload();
}

// ---------------------------------------------------------------------------
// Zdarzenia globalne / okablowanie UI
// ---------------------------------------------------------------------------

function wireGlobalEvents() {
  window.addEventListener("resize", updateScale);
  window.addEventListener("orientationchange", updateScale);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushPlayTime);

  // iOS: blokada gestów szczypania i podwójnego stuknięcia (powiększanie strony).
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());

  // Odblokowanie/wznowienie AudioContext przy pierwszym geście użytkownika (wymóg iOS).
  document.addEventListener("pointerdown", unlockAudio, { capture: true });

  menuBtnEl.addEventListener("click", () => showModal(menuModalEl));
  document.querySelectorAll('[data-close="menu"]').forEach((el) =>
    el.addEventListener("click", () => hideModal(menuModalEl))
  );
  document.querySelectorAll('[data-close="book"]').forEach((el) =>
    el.addEventListener("click", () => hideModal(bookModalEl))
  );
  document.querySelectorAll('[data-close="confirm"]').forEach((el) =>
    el.addEventListener("click", () => hideModal(confirmModalEl))
  );

  document.getElementById("menu-restart-btn").addEventListener("click", () => {
    hideModal(menuModalEl);
    showModal(confirmModalEl);
  });
  document.getElementById("confirm-cancel").addEventListener("click", () => hideModal(confirmModalEl));
  document.getElementById("confirm-restart").addEventListener("click", restartGame);
  document.getElementById("end-restart-btn").addEventListener("click", restartGame);

  spellBtnEls.forEach((btn) => {
    btn.addEventListener("click", () => showSpellTip(btn));
  });
}

// ---------------------------------------------------------------------------
// Start gry
// ---------------------------------------------------------------------------

function init() {
  state = loadState();
  cacheDom();
  renderShelves();
  computeGeometry();

  const shuffledOrder = seededShuffle(
    BOOKS.map((b) => b.id),
    mulberry32(state.seed)
  );
  shuffledOrder.forEach((id, i) => (cartIndexById[id] = i));
  BOOKS.forEach((b) => (rotById[b.id] = rotationForId(b.id)));

  buildBooksLayer();
  layoutAll();

  // Usuń blokadę animacji dopiero po pierwszym układzie, żeby dalsze ruchy się animowały.
  requestAnimationFrame(() => {
    document.querySelectorAll(".no-anim").forEach((el) => el.classList.remove("no-anim"));
  });

  updateProgressUI();
  updateInkUI();
  updateVignette();
  applyCompletedShelvesVisual();

  wireGlobalEvents();
  updateScale();

  // Zabezpieczenie przed utratą czasu gry przy awaryjnym zamknięciu karty.
  setInterval(flushPlayTime, 15000);

  // Jeżeli zapis wczytał ukończoną salę (30/30), pokaż od razu ekran końcowy.
  checkWinCondition();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
