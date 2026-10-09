// js/ksiazka.js
// Fala 4 — "Weź książkę do ręki": moduł edukacyjny. Buduje własną nakładkę na
// całą scenę (wewnątrz #scene, żeby skalowała się razem z grą) i pokazuje
// rozkładówkę dwóch kartek pergaminu z wiedzą o książce (js/wiedza.js).
//
// Świadomie NIE dotyka js/world.js, js/sound.js, css/styles.css (równolegle
// pracuje nad nimi fala 3) — całą swoją logikę i wygląd trzyma w tym pliku
// i w css/ksiazka.css. Jedyny punkt styku z resztą gry to funkcja
// openBookInHand(bookId, ctx) wołana z js/game.js::openBookDetails.
//
// Interfejs ctx (ustalony przez ten moduł, patrz js/game.js):
//   ctx.location       — "world" | "basket" | "shelf" (state.books[id].where)
//   ctx.basketHasRoom  — bool, czy koszyk ma jeszcze miejsce
//   ctx.addToBasket()  — wywołaj, żeby przenieść książkę do koszyka (grę
//                         prowadzi wywołujący — patrz simulateDragToBasket
//                         w game.js, które odtwarza prawdziwe przeciągnięcie,
//                         żeby ponownie użyć logiki world.js bez jej ruszania)
//   ctx.onClose()       — wywoływane, gdy rozkładówka się zamyka (opcjonalne)

import { BOOKS, GENRE_BY_ID, GENRE_ICONS } from "./books.js";
import { epokaKsiazki, epokaInfo, kolorOprawy, statusLektury } from "./poziomy.js";
import { wiedzaFor } from "./wiedza.js";
import { historiaFor } from "./historia.js";
import { view } from "./util.js";
import { playPaper } from "./sound.js";

const FLY_W = 260;
const FLY_H = 364;
const LIFT_MS = 350;
const OPEN_FLIP_MS = 300;
const CLOSE_FLIP_MS = 260;
const DROP_MS = 350;
const SWIPE_CLOSE_DY = 60;

const SECTION_FIELDS = [
  { key: "sectionAutor", field: "autorFakt" },
  { key: "sectionPremiera", field: "przyjeciePremiera" },
  { key: "sectionDzis", field: "przyjecieDzis" },
  { key: "sectionInterpretacja", field: "interpretacja" },
  { key: "sectionWplyw", field: "wplyw" },
];

let dom = null;
let overlayState = "closed"; // "closed" | "opening" | "open" | "closing"
let currentCtx = null;
let currentBookId = null;
let phaseTimer = null;

// ---------------------------------------------------------------------------
// Geometria — konwersja realnych pikseli na logiczne współrzędne #scene
// (ten sam wzór co w js/game.js i js/world.js, powielony celowo: moduł ma
// być samodzielny i nie importować niczego z tamtych plików).
// ---------------------------------------------------------------------------

function logicalRectOf(el) {
  const scene = document.getElementById("scene");
  const sceneRect = scene.getBoundingClientRect();
  const scale = sceneRect.width / view.w || 1;
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - sceneRect.left) / scale,
    y: (r.top - sceneRect.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

function fallbackOriginRect() {
  const w = 84;
  const h = 118;
  return { x: view.w / 2 - w / 2, y: view.h / 2 - h / 2, width: w, height: h };
}

function clampScale(s) {
  if (!Number.isFinite(s) || s <= 0) return 84 / FLY_W;
  return Math.min(1.4, Math.max(0.15, s));
}

function findBookEl(bookId) {
  return document.querySelector(`.book-item[data-book-id="${bookId}"]`);
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (err) {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Budowa DOM (raz), wewnątrz #scene
// ---------------------------------------------------------------------------

function ensureDom() {
  if (dom) return;
  const scene = document.getElementById("scene");
  if (!scene) return;

  const root = document.createElement("div");
  root.id = "ksiazka-overlay";
  root.className = "ksiazka-overlay hidden";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.innerHTML = `
    <div class="ksiazka-backdrop" data-k-close="1"></div>
    <div class="ksiazka-stage">
      <div class="ksiazka-fly" id="ksiazka-fly">
        <div class="ksiazka-fly-inner">
          <span class="ksiazka-fly-icon" id="ksiazka-fly-icon"></span>
        </div>
      </div>
      <div class="ksiazka-spread" id="ksiazka-spread">
        <div class="ksiazka-drag-handle" id="ksiazka-drag-handle" aria-hidden="true"></div>
        <button type="button" class="ksiazka-close" aria-label="Odłóż" data-k-close="1">✕</button>
        <div class="ksiazka-page ksiazka-page-left">
          <div class="ksiazka-page-scroll">
            <div class="ksiazka-mini-cover" id="ksiazka-mini-cover">
              <span class="ksiazka-mini-genre-icon" id="ksiazka-mini-genre-icon"></span>
            </div>
            <h2 class="ksiazka-title" id="ksiazka-title"></h2>
            <p class="ksiazka-author" id="ksiazka-author"></p>
            <p class="ksiazka-year" id="ksiazka-year"></p>
            <p class="ksiazka-series hidden" id="ksiazka-series"></p>
            <p class="ksiazka-genre" id="ksiazka-genre"></p>
            <p class="ksiazka-epoch" id="ksiazka-epoch"></p>
            <p class="ksiazka-status hidden" id="ksiazka-status"></p>
            <h3 class="ksiazka-heading">O czym jest</h3>
            <p class="ksiazka-text" id="ksiazka-oczym"></p>
            <div class="ksiazka-quote hidden" id="ksiazka-quote">
              <span class="ksiazka-quote-mark" aria-hidden="true">„</span>
              <p class="ksiazka-quote-text" id="ksiazka-quote-text"></p>
              <p class="ksiazka-quote-source" id="ksiazka-quote-source"></p>
            </div>
            <section class="ksiazka-tlo hidden" id="ksiazka-tlo">
              <h3 class="ksiazka-tlo-naglowek"><span class="ksiazka-section-icon" aria-hidden="true">🕰</span>Tło historyczne<span class="ksiazka-tlo-plakietka hidden" id="ksiazka-tlo-plakietka">zakres rozszerzony</span></h3>
              <div class="ksiazka-tlo-wydarzenie">
                <span class="ksiazka-tlo-data" id="ksiazka-tlo-data"></span>
                <span class="ksiazka-tlo-nazwa" id="ksiazka-tlo-nazwa"></span>
              </div>
              <p class="ksiazka-tlo-zdanie" id="ksiazka-tlo-zdanie"></p>
              <p class="ksiazka-tlo-uwaga hidden" id="ksiazka-tlo-uwaga">odczytanie, nie fakt z książki</p>
              <p class="ksiazka-tlo-przypis" id="ksiazka-tlo-przypis"></p>
            </section>
          </div>
        </div>
        <div class="ksiazka-spine" aria-hidden="true"></div>
        <div class="ksiazka-page ksiazka-page-right">
          <div class="ksiazka-page-scroll">
            <section class="ksiazka-section" id="ksiazka-sec-autor">
              <h3><span class="ksiazka-section-icon" aria-hidden="true">🖋</span>O autorze</h3>
              <p></p>
            </section>
            <section class="ksiazka-section" id="ksiazka-sec-premiera">
              <h3><span class="ksiazka-section-icon" aria-hidden="true">📰</span>Przyjęcie w dniu premiery</h3>
              <p></p>
            </section>
            <section class="ksiazka-section" id="ksiazka-sec-dzis">
              <h3><span class="ksiazka-section-icon" aria-hidden="true">👁</span>Jak czytamy ją dziś</h3>
              <p></p>
            </section>
            <section class="ksiazka-section" id="ksiazka-sec-interpretacja">
              <h3><span class="ksiazka-section-icon" aria-hidden="true">🔍</span>Najważniejsza interpretacja</h3>
              <p></p>
            </section>
            <section class="ksiazka-section" id="ksiazka-sec-wplyw">
              <h3><span class="ksiazka-section-icon" aria-hidden="true">✦</span>Wpływ na Polskę</h3>
              <p></p>
            </section>
            <details class="ksiazka-sources hidden" id="ksiazka-sources">
              <summary>Źródła</summary>
              <ul class="ksiazka-sources-list" id="ksiazka-sources-list"></ul>
            </details>
          </div>
        </div>
      </div>
      <div class="ksiazka-actions" id="ksiazka-actions">
        <button type="button" class="btn btn-primary ksiazka-btn-basket hidden" id="ksiazka-btn-basket">Do koszyka</button>
        <button type="button" class="btn ksiazka-btn-putback" id="ksiazka-btn-putback">Odłóż</button>
      </div>
    </div>
  `;
  scene.appendChild(root);

  dom = {
    root,
    stage: root.querySelector(".ksiazka-stage"),
    fly: root.querySelector("#ksiazka-fly"),
    flyIcon: root.querySelector("#ksiazka-fly-icon"),
    spread: root.querySelector("#ksiazka-spread"),
    dragHandle: root.querySelector("#ksiazka-drag-handle"),
    miniCover: root.querySelector("#ksiazka-mini-cover"),
    miniGenreIcon: root.querySelector("#ksiazka-mini-genre-icon"),
    title: root.querySelector("#ksiazka-title"),
    author: root.querySelector("#ksiazka-author"),
    year: root.querySelector("#ksiazka-year"),
    series: root.querySelector("#ksiazka-series"),
    genre: root.querySelector("#ksiazka-genre"),
    epoch: root.querySelector("#ksiazka-epoch"),
    status: root.querySelector("#ksiazka-status"),
    oCzym: root.querySelector("#ksiazka-oczym"),
    quoteBlock: root.querySelector("#ksiazka-quote"),
    quoteText: root.querySelector("#ksiazka-quote-text"),
    quoteSource: root.querySelector("#ksiazka-quote-source"),
    tlo: root.querySelector("#ksiazka-tlo"),
    tloData: root.querySelector("#ksiazka-tlo-data"),
    tloNazwa: root.querySelector("#ksiazka-tlo-nazwa"),
    tloZdanie: root.querySelector("#ksiazka-tlo-zdanie"),
    tloPlakietka: root.querySelector("#ksiazka-tlo-plakietka"),
    tloUwaga: root.querySelector("#ksiazka-tlo-uwaga"),
    tloPrzypis: root.querySelector("#ksiazka-tlo-przypis"),
    sectionAutor: root.querySelector("#ksiazka-sec-autor"),
    sectionPremiera: root.querySelector("#ksiazka-sec-premiera"),
    sectionDzis: root.querySelector("#ksiazka-sec-dzis"),
    sectionInterpretacja: root.querySelector("#ksiazka-sec-interpretacja"),
    sectionWplyw: root.querySelector("#ksiazka-sec-wplyw"),
    sourcesBlock: root.querySelector("#ksiazka-sources"),
    sourcesList: root.querySelector("#ksiazka-sources-list"),
    basketBtn: root.querySelector("#ksiazka-btn-basket"),
    putbackBtn: root.querySelector("#ksiazka-btn-putback"),
  };

  // Zamknięcie: ✕ i tło (delegacja przez data-k-close), przycisk "Odłóż",
  // stuknięcie poza kartkami. Wszystkie trzy tylko gdy rozkładówka jest
  // w pełni otwarta (patrz closeBookInHand) — w trakcie animacji ignorujemy,
  // żeby nie łapać stanu w połowie przejścia.
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-k-close]")) closeBookInHand();
  });
  dom.putbackBtn.addEventListener("click", closeBookInHand);
  dom.basketBtn.addEventListener("click", () => {
    if (overlayState !== "open") return;
    if (currentCtx && typeof currentCtx.addToBasket === "function") currentCtx.addToBasket();
    closeBookInHand();
  });

  wireDragToClose(dom.dragHandle);

  // Nakładka leży wewnątrz #scene, obok #world-viewport — bez tego stuknięcia
  // w nią mogłyby (w zależności od celu) bąbelkować do reszty gry pod spodem.
  root.addEventListener("pointerdown", (e) => e.stopPropagation());
}

function wireDragToClose(handleEl) {
  let startY = null;
  let pointerId = null;
  handleEl.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    pointerId = e.pointerId;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignorowane */
    }
  });
  handleEl.addEventListener("pointerup", (e) => {
    if (startY == null || e.pointerId !== pointerId) return;
    const dy = e.clientY - startY;
    startY = null;
    if (dy > SWIPE_CLOSE_DY) closeBookInHand();
  });
  handleEl.addEventListener("pointercancel", () => {
    startY = null;
  });
}

// ---------------------------------------------------------------------------
// Wypełnianie treścią
// ---------------------------------------------------------------------------

function setSection(sectionEl, text) {
  const p = sectionEl.querySelector("p");
  if (p) p.textContent = text || "";
  sectionEl.classList.toggle("hidden", !text);
}

function fillContent(book, wiedza, ctx) {
  const epoch = epokaInfo(epokaKsiazki(book));
  const genre = GENRE_BY_ID[book.genre];

  dom.miniCover.style.background = kolorOprawy(book);
  dom.miniGenreIcon.innerHTML = GENRE_ICONS[genre.icon];
  dom.flyIcon.innerHTML = GENRE_ICONS[genre.icon];
  dom.fly.style.background = kolorOprawy(book);

  dom.title.textContent = book.title;
  dom.author.textContent = book.author;
  dom.year.textContent = `Rok: ok. ${book.year}`;
  dom.genre.textContent = `Gatunek: ${genre.name}`;
  dom.epoch.textContent = `Epoka: ${epoch ? epoch.name : "—"}`;
  const status = statusLektury(book.id);
  dom.status.textContent = status ? `Lektura: ${status}` : "";
  dom.status.classList.toggle("hidden", !status);

  if (book.series) {
    dom.series.textContent = `Tom ${book.series.vol} z ${book.series.of} — seria «${book.series.name}»`;
    dom.series.classList.remove("hidden");
  } else {
    dom.series.classList.add("hidden");
  }

  dom.oCzym.textContent = (wiedza && wiedza.oCzym) || "";

  // Cytat jeszcze nieustalony (tekst w nawiasie kwadratowym) — nie pokazujemy bloku cytatu.
  const cytat = wiedza && wiedza.cytat && !String(wiedza.cytat.tekst || "").trim().startsWith("[") ? wiedza.cytat : null;
  dom.quoteBlock.classList.toggle("hidden", !cytat);
  if (cytat) {
    dom.quoteText.textContent = cytat.tekst || "";
    dom.quoteSource.textContent = cytat.skad ? `— ${cytat.skad}` : "";
  }

  // Wersja 0.10: tło historyczne (js/historia.js).
  const hist = historiaFor(book.id);
  dom.tlo.classList.toggle("hidden", !hist);
  if (hist) {
    dom.tloData.textContent = hist.data;
    dom.tloNazwa.textContent = hist.wydarzenie;
    dom.tloZdanie.textContent = hist.zdanie;
    dom.tloPlakietka.classList.toggle("hidden", hist.poziom !== "R");
    dom.tloUwaga.classList.toggle("hidden", !hist.interpretacja);
    dom.tloPrzypis.textContent = hist.dzial ? `podstawa programowa historii, dział ${hist.dzial}` : "";
  }

  for (const { key, field } of SECTION_FIELDS) {
    setSection(dom[key], wiedza && wiedza[field]);
  }

  dom.sourcesList.innerHTML = "";
  const zrodla = (wiedza && Array.isArray(wiedza.zrodla)) ? wiedza.zrodla : [];
  if (zrodla.length) {
    for (const url of zrodla) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = domainOf(url);
      li.appendChild(a);
      dom.sourcesList.appendChild(li);
    }
    dom.sourcesBlock.classList.remove("hidden");
  } else {
    dom.sourcesBlock.classList.add("hidden");
  }

  // Pola `doSprawdzenia` celowo nigdy nie trafiają na kartkę (patrz specyfikacja fali 4).

  // "Do koszyka" tylko, gdy książka leży w świecie i koszyk ma jeszcze miejsce.
  // Kurz nie wchodzi w grę: zakurzonej książki w ogóle nie da się otworzyć
  // (world.js przechwytuje stuknięcie wcześniej, patrz onScenePointerDown).
  // Od 0.6.3 także z regału: „Zdejmij do koszyka”.
  const showBasketBtn = (ctx.location === "world" || ctx.location === "shelf") && ctx.basketHasRoom !== false;
  dom.basketBtn.classList.toggle("hidden", !showBasketBtn);
  dom.basketBtn.textContent = ctx.location === "shelf" ? "Zdejmij do koszyka" : "Do koszyka";

  // Przewiń obie kartki na górę przy każdym nowym otwarciu.
  resetPageScroll();
}

function resetPageScroll() {
  dom.root.querySelectorAll(".ksiazka-page-scroll").forEach((el) => {
    el.scrollTop = 0;
  });
}

// ---------------------------------------------------------------------------
// Animacja: podniesienie -> otwarcie (i odwrotnie przy zamknięciu)
// ---------------------------------------------------------------------------

function nextFrame(cb) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
}

function playOpenAnimation(originRect) {
  const { fly, spread } = dom;
  clearTimeout(phaseTimer);

  const originCX = originRect.x + originRect.width / 2;
  const originCY = originRect.y + originRect.height / 2;
  const dx = originCX - view.w / 2;
  const dy = originCY - view.h / 2;
  const scale = clampScale(originRect.width / FLY_W);

  dom.root.classList.remove("hidden");
  // Zmuszamy przeglądarkę do policzenia layoutu z "hidden" zdjętym, zanim
  // ustawimy stan startowy — inaczej pierwsza klatka animacji mogłaby się zgubić.
  void dom.root.offsetWidth;
  dom.root.classList.add("visible");

  spread.style.pointerEvents = "none";
  spread.style.transition = "none";
  spread.style.opacity = "0";
  spread.style.transform = "scale(0.94)";

  fly.style.transition = "none";
  fly.style.visibility = "visible";
  fly.style.opacity = "1";
  fly.style.transformOrigin = "center center";
  fly.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

  overlayState = "opening";

  nextFrame(() => {
    fly.style.transition = `transform ${LIFT_MS}ms cubic-bezier(0.19, 0.82, 0.34, 1)`;
    fly.style.transform = "translate(0px, 0px) scale(1)";
  });

  phaseTimer = setTimeout(() => {
    fly.style.transformOrigin = "left center";
    fly.style.transition = `transform ${OPEN_FLIP_MS}ms ease-in`;
    fly.style.transform = "translate(0px, 0px) scale(1) rotateY(-130deg)";

    spread.style.transition = `opacity ${OPEN_FLIP_MS}ms ease-out, transform ${OPEN_FLIP_MS}ms ease-out`;
    spread.style.opacity = "1";
    spread.style.transform = "scale(1)";

    phaseTimer = setTimeout(() => {
      fly.style.visibility = "hidden";
      spread.style.pointerEvents = "auto";
      overlayState = "open";
    }, OPEN_FLIP_MS);
  }, LIFT_MS);
}

function playCloseAnimation(originRect) {
  const { fly, spread } = dom;
  clearTimeout(phaseTimer);
  overlayState = "closing";
  spread.style.pointerEvents = "none";

  fly.style.transition = "none";
  fly.style.visibility = "visible";
  fly.style.transformOrigin = "left center";
  fly.style.transform = "translate(0px, 0px) scale(1) rotateY(-130deg)";

  spread.style.transition = `opacity ${CLOSE_FLIP_MS}ms ease-in, transform ${CLOSE_FLIP_MS}ms ease-in`;
  spread.style.opacity = "0";
  spread.style.transform = "scale(0.94)";

  nextFrame(() => {
    fly.style.transition = `transform ${CLOSE_FLIP_MS}ms ease-in`;
    fly.style.transform = "translate(0px, 0px) scale(1) rotateY(0deg)";
  });

  phaseTimer = setTimeout(() => {
    const originCX = originRect.x + originRect.width / 2;
    const originCY = originRect.y + originRect.height / 2;
    const dx = originCX - view.w / 2;
    const dy = originCY - view.h / 2;
    const scale = clampScale(originRect.width / FLY_W);

    fly.style.transformOrigin = "center center";
    fly.style.transition = `transform ${DROP_MS}ms cubic-bezier(0.5, 0, 0.7, 0.3), opacity ${DROP_MS}ms ease-in`;
    fly.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    fly.style.opacity = "0.5";

    phaseTimer = setTimeout(finishClose, DROP_MS);
  }, CLOSE_FLIP_MS);
}

function finishClose() {
  dom.root.classList.remove("visible");
  dom.root.classList.add("hidden");
  overlayState = "closed";
  const ctx = currentCtx;
  currentCtx = null;
  currentBookId = null;
  if (ctx && typeof ctx.onClose === "function") ctx.onClose();
}

function closeBookInHand() {
  if (!dom || overlayState !== "open") return;
  const bookEl = currentBookId ? findBookEl(currentBookId) : null;
  const originRect = bookEl ? logicalRectOf(bookEl) : fallbackOriginRect();
  playCloseAnimation(originRect);
}

// ---------------------------------------------------------------------------
// Publiczne API
// ---------------------------------------------------------------------------

/**
 * Otwiera rozkładówkę książki `bookId` (patrz js/books.js) z animacją
 * "wzięcia do ręki". `ctx` patrz komentarz na górze pliku.
 */
export function openBookInHand(bookId, ctx = {}) {
  const book = BOOKS.find((b) => b.id === bookId);
  if (!book) return;
  if (overlayState !== "closed") return; // rozkładówka już otwarta/animuje się — ignorujemy ponowne wywołanie

  ensureDom();
  if (!dom) return;

  const wiedza = wiedzaFor(bookId);
  fillContent(book, wiedza, ctx);

  currentCtx = ctx;
  currentBookId = bookId;

  const bookEl = findBookEl(bookId);
  const originRect = bookEl ? logicalRectOf(bookEl) : fallbackOriginRect();

  playPaper();
  playOpenAnimation(originRect);
}
