// js/game.js
// Etap 1b — orchestrator: stan gry i zapis (localStorage, klucz biblioteka.v2),
// skalowanie sceny, pasek górny (porządek % + mini-mapa + atrament + czary),
// modale (karta książki, menu, potwierdzenie restartu, ekran końcowy), czas gry.
// Cała reszta (sala, przeciąganie, kurz, pajęczyny, koszyk, kryjówki, regały)
// mieszka w js/world.js — ten plik tylko go inicjuje i reaguje na jego zmiany.

import { EPOCH_BY_ID, GENRE_BY_ID, GENRE_ICONS, BOOKS } from "./books.js";
import { LAYOUT, WORLD_W } from "./layout.js";
import { initWorld, computeStats } from "./world.js";
import { unlockAudio } from "./sound.js";
import { clamp, shadeColor, brightnessVariant, formatTime } from "./util.js";

const LOGICAL_W = 1366;
const LOGICAL_H = 1024;
const STORAGE_KEY = "biblioteka.v2";
const WORLD_VIEW_W = 1366;
const MAX_CAMX = Math.max(0, WORLD_W - WORLD_VIEW_W);

const SPELL_INFO = {
  wglad: "Każda książka w sali dostanie znak swojego regału i zaświeci jego kolorem — pomaga rozpoznać trudne tytuły (20 sekund).",
  przywolanie: "Wszystkie tomy tej samej serii (albo książki tego samego autora) zlecą się w jeden stos, który przeniesiesz jednym ruchem.",
  skrzat: "Skrzat biblioteczny sam odłoży kilka książek, przyspieszając porządkowanie (30 sekund).",
};

// ---------------------------------------------------------------------------
// Stan gry i zapis
// ---------------------------------------------------------------------------

function defaultHideoutsOpened() {
  return Object.fromEntries(LAYOUT.hideouts.map((h) => [h.id, false]));
}

function defaultBooksState() {
  const out = {};
  for (const b of BOOKS) out[b.id] = { where: "world", basketSlot: null, shelfSlot: null };
  return out;
}

function defaultState() {
  return {
    version: 2,
    seed: Math.floor(Math.random() * 1_000_000_000),
    books: defaultBooksState(),
    dustCleared: [],
    cobwebsCleared: [],
    pagesFiled: [],
    hideoutsOpened: defaultHideoutsOpened(),
    ink: 0,
    mistakes: 0,
    startedAt: Date.now(),
    playMs: 0,
    completedShelves: [],
    camX: 0,
  };
}

function sanitizeBooksState(raw) {
  const out = defaultBooksState();
  if (!raw || typeof raw !== "object") return out;
  for (const b of BOOKS) {
    const rec = raw[b.id];
    if (!rec || typeof rec !== "object") continue;
    const where = ["world", "basket", "shelf"].includes(rec.where) ? rec.where : "world";
    out[b.id] = {
      where,
      basketSlot: Number.isInteger(rec.basketSlot) ? rec.basketSlot : null,
      shelfSlot: Number.isInteger(rec.shelfSlot) ? rec.shelfSlot : null,
    };
  }
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 2) return defaultState();
    const fallback = defaultState();
    return {
      version: 2,
      seed: Number.isFinite(parsed.seed) ? parsed.seed : fallback.seed,
      books: sanitizeBooksState(parsed.books),
      dustCleared: Array.isArray(parsed.dustCleared) ? parsed.dustCleared : [],
      cobwebsCleared: Array.isArray(parsed.cobwebsCleared) ? parsed.cobwebsCleared : [],
      pagesFiled: Array.isArray(parsed.pagesFiled) ? parsed.pagesFiled : [],
      hideoutsOpened: { ...fallback.hideoutsOpened, ...(parsed.hideoutsOpened || {}) },
      ink: clamp(Number(parsed.ink) || 0, 0, 20),
      mistakes: Number(parsed.mistakes) || 0,
      startedAt: Number(parsed.startedAt) || Date.now(),
      playMs: Number(parsed.playMs) || 0,
      completedShelves: Array.isArray(parsed.completedShelves) ? parsed.completedShelves : [],
      camX: Number.isFinite(parsed.camX) ? clamp(parsed.camX, 0, MAX_CAMX) : 0,
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
let world = null;

// ---------------------------------------------------------------------------
// DOM — referencje
// ---------------------------------------------------------------------------

let sceneEl, rotateOverlayEl;
let orderPercentEl, inkCountEl;
let minimapTrackEl, minimapViewportEl, minimapMarkerEls;
let bookModalEl, bookCardCoverEl, bookCardGenreIconEl, bookCardTitleEl, bookCardAuthorEl;
let bookCardYearEl, bookCardSeriesEl, bookCardGenreEl, bookCardEpochEl, bookCardHintEl;
let confirmModalEl, menuModalEl, endModalEl, endMistakesEl, endTimeEl, endEpochEl;
let menuBtnEl, spellBtnEls, spellTipEl;

function cacheDom() {
  sceneEl = document.getElementById("scene");
  rotateOverlayEl = document.getElementById("rotate-overlay");
  orderPercentEl = document.getElementById("order-percent");
  inkCountEl = document.getElementById("ink-count");

  minimapTrackEl = document.getElementById("minimap-track");
  minimapViewportEl = document.getElementById("minimap-viewport");
  minimapMarkerEls = {};

  bookModalEl = document.getElementById("book-modal");
  bookCardCoverEl = document.getElementById("book-card-cover");
  bookCardGenreIconEl = document.getElementById("book-card-genre-icon");
  bookCardTitleEl = document.getElementById("book-card-title");
  bookCardAuthorEl = document.getElementById("book-card-author");
  bookCardYearEl = document.getElementById("book-card-year");
  bookCardSeriesEl = document.getElementById("book-card-series");
  bookCardGenreEl = document.getElementById("book-card-genre");
  bookCardEpochEl = document.getElementById("book-card-epoch");
  bookCardHintEl = document.getElementById("book-card-hint");

  confirmModalEl = document.getElementById("confirm-modal");
  menuModalEl = document.getElementById("menu-modal");
  endModalEl = document.getElementById("end-modal");
  endMistakesEl = document.getElementById("end-mistakes");
  endTimeEl = document.getElementById("end-time");
  endEpochEl = document.getElementById("end-epoch");

  menuBtnEl = document.getElementById("menu-btn");
  spellBtnEls = Array.from(document.querySelectorAll(".spell-btn"));
  spellTipEl = document.getElementById("spell-tip");
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
// Mini-mapa
// ---------------------------------------------------------------------------

function buildMinimap() {
  minimapTrackEl.innerHTML = "";
  for (const shelf of LAYOUT.shelves) {
    const marker = document.createElement("div");
    marker.className = "minimap-marker";
    const centerFrac = (shelf.x + shelf.w / 2) / WORLD_W;
    marker.style.left = `${centerFrac * 100}%`;
    minimapTrackEl.appendChild(marker);
    minimapMarkerEls[shelf.genre] = marker;
  }
}

function updateMinimapMarkers() {
  for (const shelf of LAYOUT.shelves) {
    const marker = minimapMarkerEls[shelf.genre];
    if (marker) marker.classList.toggle("complete", state.completedShelves.includes(shelf.genre));
  }
}

function updateMinimapViewport() {
  const fracLeft = state.camX / WORLD_W;
  const fracWidth = WORLD_VIEW_W / WORLD_W;
  minimapViewportEl.style.left = `${fracLeft * 100}%`;
  minimapViewportEl.style.width = `${fracWidth * 100}%`;
}

function wireMinimapInput() {
  let dragging = false;

  function setFromClientX(clientX) {
    const r = minimapTrackEl.getBoundingClientRect();
    const frac = clamp((clientX - r.left) / r.width, 0, 1);
    const targetWorldX = frac * WORLD_W - WORLD_VIEW_W / 2;
    world.setCamX(targetWorldX);
  }

  minimapTrackEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    try {
      minimapTrackEl.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
    setFromClientX(e.clientX);
  });
  minimapTrackEl.addEventListener("pointermove", (e) => {
    if (dragging) setFromClientX(e.clientX);
  });
  minimapTrackEl.addEventListener("pointerup", (e) => {
    dragging = false;
    try {
      minimapTrackEl.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  });
  minimapTrackEl.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

// ---------------------------------------------------------------------------
// Pasek atramentu i porządku
// ---------------------------------------------------------------------------

function updateInkUI() {
  inkCountEl.textContent = String(state.ink);
}

function updateOrderUI() {
  const stats = computeStats(state);
  orderPercentEl.textContent = `Porządek: ${stats.percent}%`;
  return stats;
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

function openBookModal(bookId) {
  const book = BOOKS.find((b) => b.id === bookId);
  if (!book) return;
  const epoch = EPOCH_BY_ID[book.epoch];
  const genre = GENRE_BY_ID[book.genre];

  bookCardCoverEl.style.background = shadeColor(epoch.baseColor, brightnessVariant(book.id));
  bookCardGenreIconEl.innerHTML = GENRE_ICONS[genre.icon];
  bookCardTitleEl.textContent = book.title;
  bookCardAuthorEl.textContent = book.author;
  bookCardYearEl.textContent = `Rok: ok. ${book.year}`;
  bookCardGenreEl.textContent = `Gatunek: ${genre.name}`;
  bookCardEpochEl.textContent = `Epoka: ${epoch.name}`;

  if (book.series) {
    bookCardSeriesEl.textContent = `Tom ${book.series.vol} z ${book.series.of} — seria «${book.series.name}»`;
    bookCardSeriesEl.classList.remove("hidden");
  } else {
    bookCardSeriesEl.classList.add("hidden");
  }

  bookCardHintEl.textContent = book.hint;
  showModal(bookModalEl);
}

function showEndModal() {
  const stats = computeStats(state);
  endMistakesEl.textContent = `Liczba pomyłek: ${state.mistakes}`;
  endTimeEl.textContent = `Czas gry: ${formatTime(currentPlayMs())}`;
  endEpochEl.textContent = `Dobra epoka: ${stats.goodEpoch} / ${stats.totalBooks}`;
  showModal(endModalEl);
}

let endShown = false;
function checkWinCondition(stats) {
  if (stats.percent >= 100 && !endShown) {
    endShown = true;
    flushPlayTime();
    showEndModal();
  }
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
// Dymek czaru (zablokowany w tym etapie)
// ---------------------------------------------------------------------------

let spellTipTimer = null;
function getLogicalRectSimple(el) {
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

function showSpellTip(btnEl) {
  const unlockN = btnEl.dataset.unlock;
  const spellKey = btnEl.dataset.spell;
  const desc = SPELL_INFO[spellKey] || "";
  const r = getLogicalRectSimple(btnEl);
  spellTipEl.innerHTML = `<strong>Odblokujesz po ukończeniu ${unlockN}. regału</strong><br>${desc}`;
  spellTipEl.style.left = `${r.x + r.width / 2}px`;
  spellTipEl.style.top = `${r.y + r.height + 12}px`;
  spellTipEl.classList.remove("hidden");
  clearTimeout(spellTipTimer);
  spellTipTimer = setTimeout(() => spellTipEl.classList.add("hidden"), 3500);
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

function onWorldChange() {
  saveState();
  updateInkUI();
  const stats = updateOrderUI();
  updateMinimapMarkers();
  updateMinimapViewport();
  checkWinCondition(stats);
}

function onWorldCameraChange() {
  updateMinimapViewport();
}

function init() {
  state = loadState();
  cacheDom();
  buildMinimap();
  wireMinimapInput();

  world = initWorld(state, {
    openBookModal,
    onChange: onWorldChange,
    onCameraChange: onWorldCameraChange,
  });

  updateInkUI();
  updateOrderUI();
  updateMinimapMarkers();
  updateMinimapViewport();

  wireGlobalEvents();
  updateScale();

  // Zabezpieczenie przed utratą czasu gry przy awaryjnym zamknięciu karty.
  setInterval(flushPlayTime, 15000);

  // Jeżeli zapis wczytał ukończoną salę (100%), pokaż od razu ekran końcowy.
  checkWinCondition(computeStats(state));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
