// js/game.js
// Etap 1b/2 — orchestrator: stan gry i zapis (localStorage, klucz biblioteka.v2),
// ustawienia (localStorage, klucz biblioteka.ustawienia), skalowanie sceny,
// pasek górny (mini-mapa) + pasek dolny (czary, koszyk, atrament, porządek),
// ekran powitalny, "Jak grać", menu, ustawienia, modale (karta książki,
// potwierdzenie restartu, ekran końcowy), czas gry.
// Cała reszta (sala, przeciąganie, kurz, pajęczyny, koszyk, kryjówki, regały)
// mieszka w js/world.js — ten plik tylko go inicjuje i reaguje na jego zmiany.

import { EPOCH_BY_ID, GENRE_BY_ID, GENRE_ICONS, BOOKS } from "./books.js";
import { LAYOUT, WORLD_W } from "./layout.js";
import { initWorld, computeStats } from "./world.js";
import { unlockAudio, setSoundsEnabled, setMusicSettings } from "./sound.js";
import { clamp, shadeColor, brightnessVariant, formatTime, positionFloatingTip } from "./util.js";

const LOGICAL_W = 1366;
const LOGICAL_H = 1024;
const STORAGE_KEY = "biblioteka.v2";
const SETTINGS_KEY = "biblioteka.ustawienia";
const WORLD_VIEW_W = 1366;
const MAX_CAMX = Math.max(0, WORLD_W - WORLD_VIEW_W);
const RING_R = 30;
const RING_CIRC = 2 * Math.PI * RING_R;

const SPELL_INFO = {
  wglad: "Każda książka w sali dostanie znak swojego regału i zaświeci jego kolorem — pomaga rozpoznać trudne tytuły (20 sekund).",
  przywolanie: "Wszystkie tomy tej samej serii (albo książki tego samego autora) zlecą się w jeden stos, który przeniesiesz jednym ruchem.",
  skrzat: "Skrzat biblioteczny sam odłoży kilka książek, przyspieszając porządkowanie (30 sekund).",
};

const HOWTO_SLIDES = [
  { icon: "🏛️", text: "Sala jest w nieładzie — posprzątaj ją. Przesuwaj salę palcem, mapa u góry pokazuje, gdzie jesteś." },
  { icon: "📚", text: "Zbieraj książki do koszyka i odnoś je na regały. Regały są według gatunków — ikona na okładce podpowiada gatunek." },
  { icon: "🧹", text: "Kurz i pajęczyny: pocieraj palcem lub rysikiem." },
  { icon: "🔍", text: "Szukaj kryjówek — szuflada, fotel i zasłona oznaczone lupą mogą coś skrywać. Stosy zdejmuj od góry." },
  { icon: "🗂️", text: "Luźne kartki zanieś do teczki na biurku." },
  { icon: "✦", text: "Bonus: plakietka pod miejscem na półce to epoka — dobra epoka daje ✦ i atrament. Porządek sali rośnie, a sala nabiera blasku." },
];

// ---------------------------------------------------------------------------
// Stan gry i zapis
// ---------------------------------------------------------------------------

function defaultHideoutsOpened() {
  return Object.fromEntries(LAYOUT.hideouts.map((h) => [h.id, false]));
}

function defaultHintsShown() {
  return { hideout: false, cobweb: false, page: false, dust: false, stack: false };
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
    hintsShown: defaultHintsShown(),
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
      hintsShown: { ...fallback.hintsShown, ...(parsed.hintsShown || {}) },
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
// Ustawienia (dźwięk, muzyka — zaczep, rozmiar napisów)
// ---------------------------------------------------------------------------

function defaultSettings() {
  return { musicOn: true, musicVolume: 70, soundsOn: true, textScale: 1 };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    const fb = defaultSettings();
    if (!parsed || typeof parsed !== "object") return fb;
    return {
      musicOn: typeof parsed.musicOn === "boolean" ? parsed.musicOn : fb.musicOn,
      musicVolume: Number.isFinite(parsed.musicVolume) ? clamp(parsed.musicVolume, 0, 100) : fb.musicVolume,
      soundsOn: typeof parsed.soundsOn === "boolean" ? parsed.soundsOn : fb.soundsOn,
      textScale: [1, 1.2, 1.4].includes(parsed.textScale) ? parsed.textScale : fb.textScale,
    };
  } catch (err) {
    console.warn("Nie udało się wczytać ustawień — używam domyślnych.", err);
    return defaultSettings();
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Nie udało się zapisać ustawień.", err);
  }
}

function applySettings() {
  document.documentElement.style.setProperty("--text-scale", String(settings.textScale));
  setSoundsEnabled(settings.soundsOn);
  setMusicSettings({ on: settings.musicOn, volume: settings.musicVolume / 100 });
}

let settings = defaultSettings();

// ---------------------------------------------------------------------------
// DOM — referencje
// ---------------------------------------------------------------------------

let sceneEl, rotateOverlayEl;
let inkCountEl, inkwellFillEl, inkwellBtnEl;
let orderRingFillEl, orderRingPercentEl, orderRingBtnEl;
let minimapTrackEl, minimapViewportEl, minimapMarkerEls;
let bookModalEl, bookCardCoverEl, bookCardGenreIconEl, bookCardTitleEl, bookCardAuthorEl;
let bookCardYearEl, bookCardSeriesEl, bookCardGenreEl, bookCardEpochEl, bookCardHintEl;
let confirmModalEl, menuModalEl, endModalEl, endMistakesEl, endTimeEl, endEpochEl;
let menuBtnEl, spellBtnEls, spellTipEl;
let welcomeModalEl, welcomeContinueBtnEl, welcomeNewGameBtnEl, welcomeHowtoBtnEl, welcomeSettingsBtnEl;
let howtoModalEl, howtoCardEl, howtoIconEl, howtoTextEl, howtoDotsEl, howtoBackBtnEl, howtoNextBtnEl;
let settingsModalEl, settingMusicOnEl, settingMusicVolumeEl, settingSoundsOnEl, textScaleBtnEls;

function cacheDom() {
  sceneEl = document.getElementById("scene");
  rotateOverlayEl = document.getElementById("rotate-overlay");

  inkCountEl = document.getElementById("ink-count");
  inkwellFillEl = document.getElementById("inkwell-fill");
  inkwellBtnEl = document.getElementById("inkwell");

  orderRingFillEl = document.getElementById("order-ring-fill");
  orderRingPercentEl = document.getElementById("order-ring-percent");
  orderRingBtnEl = document.getElementById("order-ring");

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

  welcomeModalEl = document.getElementById("welcome-modal");
  welcomeContinueBtnEl = document.getElementById("welcome-continue-btn");
  welcomeNewGameBtnEl = document.getElementById("welcome-newgame-btn");
  welcomeHowtoBtnEl = document.getElementById("welcome-howto-btn");
  welcomeSettingsBtnEl = document.getElementById("welcome-settings-btn");

  howtoModalEl = document.getElementById("howto-modal");
  howtoCardEl = document.getElementById("howto-card");
  howtoIconEl = document.getElementById("howto-icon");
  howtoTextEl = document.getElementById("howto-text");
  howtoDotsEl = document.getElementById("howto-dots");
  howtoBackBtnEl = document.getElementById("howto-back-btn");
  howtoNextBtnEl = document.getElementById("howto-next-btn");

  settingsModalEl = document.getElementById("settings-modal");
  settingMusicOnEl = document.getElementById("setting-music-on");
  settingMusicVolumeEl = document.getElementById("setting-music-volume");
  settingSoundsOnEl = document.getElementById("setting-sounds-on");
  textScaleBtnEls = Array.from(document.querySelectorAll("#setting-text-scale .segmented-btn"));
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
  minimapTrackEl.querySelectorAll(".minimap-marker").forEach((el) => el.remove());
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
    if (!world) return;
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
// Pasek dolny: atrament (kałamarz) i porządek (pierścień)
// ---------------------------------------------------------------------------

function updateInkUI() {
  inkCountEl.textContent = String(state.ink);
  if (inkwellFillEl) inkwellFillEl.style.width = `${clamp((state.ink / 20) * 100, 0, 100)}%`;
}

function updateOrderUI() {
  const stats = computeStats(state);
  if (orderRingPercentEl) orderRingPercentEl.textContent = `${stats.percent}%`;
  if (orderRingFillEl) {
    orderRingFillEl.style.strokeDasharray = `${RING_CIRC}`;
    orderRingFillEl.style.strokeDashoffset = `${RING_CIRC * (1 - stats.percent / 100)}`;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Dymki informacyjne HUD (czary, atrament, porządek) — dzielą jeden element
// (#spell-tip), zawsze dociskany do wnętrza sceny (patrz positionFloatingTip).
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

function showHudTip(anchorEl, html) {
  const r = getLogicalRectSimple(anchorEl);
  spellTipEl.innerHTML = html;
  spellTipEl.classList.remove("hidden");
  positionFloatingTip(spellTipEl, r.x + r.width / 2, r.y, { preferAbove: true, gap: 10, boundsW: LOGICAL_W, boundsH: LOGICAL_H });
  clearTimeout(spellTipTimer);
  spellTipTimer = setTimeout(() => spellTipEl.classList.add("hidden"), 3500);
}

function showSpellTip(btnEl) {
  const unlockN = btnEl.dataset.unlock;
  const spellKey = btnEl.dataset.spell;
  const desc = SPELL_INFO[spellKey] || "";
  showHudTip(btnEl, `<strong>Odblokujesz po ukończeniu ${unlockN}. regału</strong><br>${desc}`);
}

function showInkTip() {
  showHudTip(inkwellBtnEl, `<strong>Atrament: ${state.ink} z 20 kropli</strong><br>Zdobywasz go za odłożone książki; w przyszłości zasila czary.`);
}

function showOrderTip() {
  const stats = computeStats(state);
  showHudTip(
    orderRingBtnEl,
    `<strong>Porządek sali: ${stats.percent}%</strong><br>Liczy odłożone książki, starty kurz, zdjęte pajęczyny i odniesione kartki.`
  );
}

function wireHudInfoTooltips() {
  inkwellBtnEl.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    showInkTip();
  });
  inkwellBtnEl.addEventListener("click", showInkTip);
  orderRingBtnEl.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    showOrderTip();
  });
  orderRingBtnEl.addEventListener("click", showOrderTip);
  spellBtnEls.forEach((btn) => btn.addEventListener("click", () => showSpellTip(btn)));
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

/** Zaczep: JEDNO miejsce, które otwiera szczegóły książki po stuknięciu. Moduł
 * „weź do ręki” (kolejna fala) podmieni wnętrze tej funkcji, nie wywołania. */
function openBookDetails(bookId) {
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
// Restart / powrót do ekranu tytułowego
// ---------------------------------------------------------------------------

function restartGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Nie udało się wyczyścić zapisu.", err);
  }
  location.reload();
}

function goToTitleScreen() {
  flushPlayTime();
  location.reload();
}

// ---------------------------------------------------------------------------
// Ekran powitalny
// ---------------------------------------------------------------------------

function computeHasProgress(st) {
  const stats = computeStats(st);
  return stats.percent > 0 || st.mistakes > 0 || st.playMs > 1000;
}

function showWelcomeScreen() {
  const saved = loadState();
  welcomeContinueBtnEl.classList.toggle("hidden", !computeHasProgress(saved));
  showModal(welcomeModalEl);
}

function wireWelcomeUI() {
  welcomeContinueBtnEl.addEventListener("click", () => {
    state = loadState();
    hideModal(welcomeModalEl);
    startGame();
  });
  welcomeNewGameBtnEl.addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Nie udało się wyczyścić zapisu.", err);
    }
    state = defaultState();
    hideModal(welcomeModalEl);
    openHowToPlay("auto");
  });
  welcomeHowtoBtnEl.addEventListener("click", () => {
    hideModal(welcomeModalEl);
    openHowToPlay("welcome");
  });
  welcomeSettingsBtnEl.addEventListener("click", () => {
    showModal(settingsModalEl);
  });
}

// ---------------------------------------------------------------------------
// "Jak grać" — 6 kart, Dalej/Wstecz + przeciągnięcie palcem
// ---------------------------------------------------------------------------

let howToIndex = 0;
let howToContext = "menu"; // "welcome" | "menu" | "auto" (po "Nowa gra")

function openHowToPlay(context) {
  howToContext = context;
  howToIndex = 0;
  renderHowToSlide();
  showModal(howtoModalEl);
}

function renderHowToSlide() {
  const slide = HOWTO_SLIDES[howToIndex];
  howtoIconEl.textContent = slide.icon;
  howtoTextEl.textContent = slide.text;
  howtoDotsEl.innerHTML = HOWTO_SLIDES.map((_, i) => `<span class="howto-dot${i === howToIndex ? " active" : ""}"></span>`).join("");
  howtoBackBtnEl.disabled = howToIndex === 0 && howToContext !== "welcome";
  const isLast = howToIndex === HOWTO_SLIDES.length - 1;
  howtoNextBtnEl.textContent = isLast ? (howToContext === "auto" ? "Zacznij grać" : "Zamknij") : "Dalej";
}

function howToGoNext() {
  if (howToIndex < HOWTO_SLIDES.length - 1) {
    howToIndex++;
    renderHowToSlide();
    return;
  }
  closeHowToPlay();
}

function howToGoBack() {
  if (howToIndex > 0) {
    howToIndex--;
    renderHowToSlide();
    return;
  }
  if (howToContext === "welcome") {
    hideModal(howtoModalEl);
    showWelcomeScreen();
  }
}

function closeHowToPlay() {
  hideModal(howtoModalEl);
  if (howToContext === "auto") startGame();
  else if (howToContext === "welcome") showWelcomeScreen();
  // context "menu": gra już działa pod spodem — po prostu wracamy do niej
}

function wireHowToUI() {
  howtoNextBtnEl.addEventListener("click", howToGoNext);
  howtoBackBtnEl.addEventListener("click", howToGoBack);
  document.querySelectorAll('[data-close="howto"]').forEach((el) => el.addEventListener("click", closeHowToPlay));

  let dragStartX = null;
  howtoCardEl.addEventListener("pointerdown", (e) => {
    dragStartX = e.clientX;
  });
  howtoCardEl.addEventListener("pointerup", (e) => {
    if (dragStartX == null) return;
    const dx = e.clientX - dragStartX;
    dragStartX = null;
    if (dx < -40) howToGoNext();
    else if (dx > 40) howToGoBack();
  });
  howtoCardEl.addEventListener("pointercancel", () => {
    dragStartX = null;
  });
}

// ---------------------------------------------------------------------------
// Menu (☰)
// ---------------------------------------------------------------------------

function wireMenuUI() {
  menuBtnEl.addEventListener("click", () => showModal(menuModalEl));
  document.querySelectorAll('[data-close="menu"]').forEach((el) => el.addEventListener("click", () => hideModal(menuModalEl)));

  document.getElementById("menu-resume-btn").addEventListener("click", () => hideModal(menuModalEl));
  document.getElementById("menu-howto-btn").addEventListener("click", () => {
    hideModal(menuModalEl);
    openHowToPlay("menu");
  });
  document.getElementById("menu-settings-btn").addEventListener("click", () => {
    hideModal(menuModalEl);
    showModal(settingsModalEl);
  });
  document.getElementById("menu-restart-btn").addEventListener("click", () => {
    hideModal(menuModalEl);
    showModal(confirmModalEl);
  });
  document.getElementById("menu-title-btn").addEventListener("click", () => {
    hideModal(menuModalEl);
    goToTitleScreen();
  });
}

// ---------------------------------------------------------------------------
// Ustawienia
// ---------------------------------------------------------------------------

function updateTextScaleButtons() {
  textScaleBtnEls.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.scale) === settings.textScale));
}

function refreshSettingsUI() {
  settingMusicOnEl.checked = settings.musicOn;
  settingMusicVolumeEl.value = String(settings.musicVolume);
  settingSoundsOnEl.checked = settings.soundsOn;
  updateTextScaleButtons();
}

function wireSettingsUI() {
  refreshSettingsUI();

  document.querySelectorAll('[data-close="settings"]').forEach((el) => el.addEventListener("click", () => hideModal(settingsModalEl)));

  settingMusicOnEl.addEventListener("change", () => {
    settings.musicOn = settingMusicOnEl.checked;
    applySettings();
    saveSettings();
  });
  settingMusicVolumeEl.addEventListener("input", () => {
    settings.musicVolume = Number(settingMusicVolumeEl.value);
    applySettings();
    saveSettings();
  });
  settingSoundsOnEl.addEventListener("change", () => {
    settings.soundsOn = settingSoundsOnEl.checked;
    applySettings();
    saveSettings();
  });
  textScaleBtnEls.forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.textScale = Number(btn.dataset.scale);
      applySettings();
      saveSettings();
      updateTextScaleButtons();
    });
  });
}

// ---------------------------------------------------------------------------
// Zdarzenia globalne
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

  document.querySelectorAll('[data-close="book"]').forEach((el) => el.addEventListener("click", () => hideModal(bookModalEl)));
  document.querySelectorAll('[data-close="confirm"]').forEach((el) => el.addEventListener("click", () => hideModal(confirmModalEl)));

  document.getElementById("confirm-cancel").addEventListener("click", () => hideModal(confirmModalEl));
  document.getElementById("confirm-restart").addEventListener("click", restartGame);
  document.getElementById("end-restart-btn").addEventListener("click", restartGame);
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

function startGame() {
  world = initWorld(state, {
    openBookModal: openBookDetails,
    onChange: onWorldChange,
    onCameraChange: onWorldCameraChange,
  });

  updateInkUI();
  updateOrderUI();
  updateMinimapMarkers();
  updateMinimapViewport();

  // Zabezpieczenie przed utratą czasu gry przy awaryjnym zamknięciu karty.
  setInterval(flushPlayTime, 15000);

  // Jeżeli zapis wczytał ukończoną salę (100%), pokaż od razu ekran końcowy.
  checkWinCondition(computeStats(state));
}

function boot() {
  cacheDom();
  buildMinimap();
  wireMinimapInput();
  wireGlobalEvents();
  wireMenuUI();
  wireSettingsUI();
  wireWelcomeUI();
  wireHowToUI();
  wireHudInfoTooltips();
  updateScale();

  settings = loadSettings();
  applySettings();

  const params = new URLSearchParams(location.search);
  if (params.get("bez-intro") === "1") {
    state = loadState();
    startGame();
  } else {
    showWelcomeScreen();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
