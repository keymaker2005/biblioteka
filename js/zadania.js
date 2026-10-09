// js/zadania.js
// Wersja 0.6 — więcej zadań w jednej sali (decyzja 14 w docs/PLAN.md):
//  • Prośby czytelników — rewersy na biurku przy kominku; kładziesz na nich właściwą książkę.
//  • Naprawa książek — każda luźna kartka wypadła z konkretnej książki (fragment z modułu wiedzy);
//    przeciągasz kartkę na tę książkę.
//  • Pieczęcie Załuskich — 6 ukrytych pieczęci; komplet odsłania kartę o historii biblioteki.
//  • Porządki w otoczeniu — przetrzyj lustro, szybę obrazu i okna, zamieć liście.
//  • Oś dziejów (0.10) — 8 medalionów w galerii; kładziesz na nich książkę związaną z wydarzeniem.
// Stan: state.zadania = { requestsDone, seals: [id], chores: [id], os: [id] }; naprawy = state.pagesFiled.

import { LAYOUT } from "./layout.js";
import { BOOKS } from "./books.js";
import { wiedzaFor } from "./wiedza.js";
import { createWipeLayer } from "./dust.js";
import { registerDropHandler, setPageTapHandler, computeStats } from "./world.js";
import { playPaper, playDustGone, playEpochBonus, playChronologyStar, playWipe } from "./sound.js";
import { escapeHtml, view } from "./util.js";
import { historiaFor, OS_DZIEJOW, WEDROWKA_ZALUSKICH } from "./historia.js";

const Z = LAYOUT.zadania;

const REQUESTS = [
  { who: "pani Zofia", text: "Poproszę jakąkolwiek książkę Bolesława Prusa.", ok: (b) => b.author === "Bolesław Prus" },
  { who: "pan Kazimierz", text: "Szukam dramatu z epoki romantyzmu — może być komedia.", ok: (b) => b.genre === "dramat" && b.epoch === "romantyzm" },
  { who: "panna Jadwiga", text: "Potrzebuję zimowego tomu „Chłopów”.", ok: (b) => b.id === "chlopi-2" },
  { who: "pani Helena", text: "Chciałabym poezję z dawnych wieków, sprzed rozbiorów.", ok: (b) => b.genre === "poezja" && b.epoch === "dawne" },
  { who: "pan Stefan", text: "Szukam powieści o kupcu zakochanym w arystokratce.", ok: (b) => b.id === "lalka" },
  { who: "pan Tadeusz", text: "Poproszę reportaż o pierwszych podróżach reportera, który woził ze sobą Herodota.", ok: (b) => b.id === "podroze-z-herodotem" },
];

const INK_REQUEST = 3;
const INK_REPAIR = 2;
const INK_SEALS_ALL = 5;
const NEXT_REQUEST_MS = 20000;

let api = null; // getWorldApi()
let card = null;
let trayEl = null;
let requestReady = true;
let lastHintAt = 0;

function zs() {
  const s = api.state;
  if (!s.zadania || typeof s.zadania !== "object") s.zadania = {};
  const z = s.zadania;
  if (!Number.isInteger(z.requestsDone)) z.requestsDone = 0;
  if (!Array.isArray(z.seals)) z.seals = [];
  if (!Array.isArray(z.chores)) z.chores = [];
  if (!Array.isArray(z.os)) z.os = []; // od 0.10: Oś dziejów (id medalionów z książką)
  return z;
}

function addInk(n) {
  api.state.ink = Math.min(20, api.state.ink + n);
}

function save() {
  api.notifyChange();
}

function note(text, ms = 3200) {
  api.showMsgTip(text, view.w / 2, 130, ms);
}

function bookById(id) {
  return BOOKS.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Karta (pergaminowe okienko) — wspólna dla rewersów, kartek, pieczęci i listy zadań
// ---------------------------------------------------------------------------

function ensureCard() {
  if (card) return card;
  const root = document.createElement("div");
  root.className = "zadania-karta hidden";
  root.innerHTML = `
    <div class="zk-tlo" data-zk-close="1"></div>
    <div class="zk-pergamin">
      <button type="button" class="zk-x" data-zk-close="1" aria-label="Zamknij">✕</button>
      <h2 class="zk-tytul"></h2>
      <div class="zk-tresc"></div>
      <button type="button" class="btn btn-primary zk-ok" data-zk-close="1">Dobrze</button>
    </div>`;
  document.getElementById("scene").appendChild(root);
  root.addEventListener("pointerdown", (e) => e.stopPropagation());
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-zk-close]")) hideCard();
  });
  card = { root, title: root.querySelector(".zk-tytul"), body: root.querySelector(".zk-tresc") };
  return card;
}

function showCard(title, html) {
  const c = ensureCard();
  c.title.textContent = title;
  c.body.innerHTML = html;
  c.root.classList.remove("hidden");
}

function hideCard() {
  if (card) card.root.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Prośby czytelników — rewersy na biurku (dawna „teczka”)
// ---------------------------------------------------------------------------

function activeRequest() {
  const z = zs();
  if (z.requestsDone >= REQUESTS.length || !requestReady) return null;
  return REQUESTS[z.requestsDone];
}

function renderTray() {
  if (!trayEl) return;
  const z = zs();
  const req = activeRequest();
  const done = z.requestsDone >= REQUESTS.length;
  trayEl.classList.toggle("czeka", !!req);
  trayEl.innerHTML =
    `<span class="folder-label">Rewersy</span>` +
    `<span class="rewers-licznik">${Math.min(z.requestsDone, REQUESTS.length)}/${REQUESTS.length}</span>` +
    (req ? `<span class="rewers-znak" aria-hidden="true">!</span>` : "") +
    (done ? `<span class="rewers-znak gotowe" aria-hidden="true">✓</span>` : "");
}

function showRequest() {
  const z = zs();
  const req = activeRequest();
  if (z.requestsDone >= REQUESTS.length) {
    showCard("Rewersy", `<p>Wszyscy czytelnicy obsłużeni — dziękują za pomoc! (${REQUESTS.length}/${REQUESTS.length})</p>`);
    return;
  }
  if (!req) {
    showCard("Rewersy", `<p>Na razie nikt nie czeka. Kolejny czytelnik zaraz zostawi rewers.</p>`);
    return;
  }
  showCard(
    `Rewers ${z.requestsDone + 1} z ${REQUESTS.length}`,
    `<p class="zk-rewers">„${escapeHtml(req.text)}”</p><p class="zk-podpis">— ${escapeHtml(req.who)}</p>` +
      `<p class="zk-rada">Znajdź pasującą książkę i połóż ją na rewersach na biurku. Czytelnik przejrzy ją i odda do koszyka. Nagroda: ${INK_REQUEST} krople atramentu.</p>`
  );
}

function buildTray() {
  trayEl = document.getElementById("folder");
  if (!trayEl) return;
  trayEl.classList.add("rewersy");
  renderTray();
  trayEl.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  trayEl.addEventListener("click", showRequest);
}

function trayHit(worldPt) {
  const f = LAYOUT.folder;
  const pad = 40;
  return worldPt.x >= f.x - pad && worldPt.x <= f.x + f.w + pad && worldPt.y >= f.y - pad - 40 && worldPt.y <= f.y + f.h + pad;
}

function onBookDrop(info) {
  if (info.kind !== "book") return null;
  const osHit = osMedalionAt(info.worldPt);
  if (osHit) return onOsDrop(info, osHit);
  if (!trayHit(info.worldPt)) return null;
  const z = zs();
  const req = activeRequest();
  if (!req) {
    return { reject: z.requestsDone >= REQUESTS.length ? "Wszyscy czytelnicy są już obsłużeni." : "Nikt teraz nie czeka na książkę." };
  }
  const book = bookById(info.id);
  if (!req.ok(book)) {
    return { reject: `${req.who.charAt(0).toUpperCase() + req.who.slice(1)} prosił(a) o coś innego: „${req.text}”` };
  }
  z.requestsDone++;
  addInk(INK_REQUEST);
  playEpochBonus();
  note(`${req.who.charAt(0).toUpperCase() + req.who.slice(1)} dziękuje! +${INK_REQUEST} atramentu`);
  requestReady = false;
  if (z.requestsDone < REQUESTS.length) {
    setTimeout(() => {
      requestReady = true;
      renderTray();
      note("Na biurku czeka nowy rewers.");
    }, NEXT_REQUEST_MS);
  }
  renderTray();
  save();
  return { then: "basket" };
}

// ---------------------------------------------------------------------------
// Naprawa książek — kartki z fragmentami
// ---------------------------------------------------------------------------

function markDamagedBooks() {
  const filed = new Set(api.state.pagesFiled);
  for (const [pageId, bookId] of Object.entries(Z.pageBooks)) {
    const el = document.querySelector(`.book-item[data-book-id="${bookId}"]`);
    if (el) el.classList.toggle("uszkodzona", !filed.has(pageId));
  }
}

function fragmentFor(pageId) {
  const w = wiedzaFor(Z.pageBooks[pageId]);
  if (!w || !w.cytat) return "";
  const lines = w.cytat.tekst.split("\n").slice(0, 3).join("\n");
  return lines.length > 220 ? lines.slice(0, 217) + "…" : lines;
}

function onPageTap(pageId) {
  const frag = fragmentFor(pageId);
  showCard(
    "Luźna kartka",
    `<p class="zk-fragment">${escapeHtml(frag).replace(/\n/g, "<br>")}</p>` +
      `<p class="zk-rada">Ta kartka wypadła z jednej z książek w sali (uszkodzone mają naderwany róg). Rozpoznajesz fragment? Przeciągnij kartkę na tę książkę.</p>`
  );
}

// Od 0.6.2 z zapasem: grzbiet na regale ma ~30 px szerokości, więc liczy się też książka
// tuż obok palca. Gdy w zasięgu jest książka, z której kartka wypadła — wygrywa ona.
const TOL_SPINE_X = 40;
const TOL_COVER = 20;

function bookUnderPointer(info, pageId) {
  const scale = document.getElementById("scene").getBoundingClientRect().width / view.w || 1;
  let nearest = null;
  let nearestD = Infinity;
  for (const el of document.querySelectorAll(".book-item")) {
    if (el.classList.contains("dragging")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const dx = Math.max(r.left - info.clientX, 0, info.clientX - r.right) / scale;
    const dy = Math.max(r.top - info.clientY, 0, info.clientY - r.bottom) / scale;
    const tolX = el.classList.contains("book-spine") ? TOL_SPINE_X : TOL_COVER;
    if (dx > tolX || dy > TOL_COVER) continue;
    const id = el.dataset.bookId;
    if (id === Z.pageBooks[pageId]) return id;
    const d = Math.hypot(dx, dy);
    if (d < nearestD) {
      nearestD = d;
      nearest = id;
    }
  }
  return nearest;
}

function onPageDrop(info) {
  if (info.kind !== "page") return null;
  const bookId = bookUnderPointer(info, info.id);
  if (!bookId) return null;
  if (Z.pageBooks[info.id] !== bookId) {
    return { reject: "Ta kartka pochodzi z innej książki." };
  }
  addInk(INK_REPAIR);
  playChronologyStar();
  const book = bookById(bookId);
  note(`Kartka wróciła na miejsce — „${book.title}” naprawiona! +${INK_REPAIR} atramentu`);
  setTimeout(markDamagedBooks, 50);
  return { consumed: true };
}

// ---------------------------------------------------------------------------
// Pieczęcie Załuskich
// ---------------------------------------------------------------------------

const ZALUSKI_HTML = `
  <p>Biblioteka Załuskich — założona przez braci <strong>Józefa Andrzeja</strong> i <strong>Andrzeja Stanisława Załuskich</strong> — została otwarta dla czytelników <strong>8 sierpnia 1747 roku</strong> w Pałacu Daniłowiczowskim w Warszawie. Była jedną z pierwszych bibliotek publicznych w Europie i pierwszą polską biblioteką narodową.</p>
  <ul class="zk-os-czasu">${WEDROWKA_ZALUSKICH.map((w) => `<li><strong>${escapeHtml(w.data)}</strong><span>${escapeHtml(w.tekst)}</span></li>`).join("")}</ul>
  <p class="zk-zrodla">Źródła: pl.wikipedia.org (Biblioteka Załuskich), bn.org.pl</p>`;

function buildSeals() {
  const z = zs();
  for (const s of Z.seals) {
    if (z.seals.includes(s.id)) continue;
    const el = document.createElement("div");
    el.className = "pieczec";
    el.style.left = `${s.x - 15}px`;
    el.style.top = `${s.y - 15}px`;
    el.innerHTML = `<img src="assets/pieczec.png" alt="" draggable="false">`;
    api.worldLayerEl.appendChild(el);
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    el.addEventListener("click", () => {
      if (z.seals.includes(s.id)) return;
      z.seals.push(s.id);
      el.classList.add("znaleziona");
      setTimeout(() => el.remove(), 900);
      playEpochBonus();
      if (z.seals.length === Z.seals.length) {
        addInk(INK_SEALS_ALL);
        playChronologyStar();
        setTimeout(() => showCard("Pieczęcie Załuskich — komplet!", ZALUSKI_HTML), 700);
      } else {
        note(`Pieczęć Załuskich ${z.seals.length}/${Z.seals.length}`);
      }
      save();
    });
  }
}

// ---------------------------------------------------------------------------
// Porządki w otoczeniu
// ---------------------------------------------------------------------------

const CHORE_DONE_TEXT = {
  grime: "lśni czystością!",
  leaves: "— liście zamiecione!",
};

function buildChores() {
  const z = zs();
  for (const ch of Z.chores) {
    if (z.chores.includes(ch.id)) continue;
    const host = document.createElement("div");
    host.className = `porzadek porzadek-${ch.texture}`;
    host.style.left = `${ch.x}px`;
    host.style.top = `${ch.y}px`;
    host.style.width = `${ch.w}px`;
    host.style.height = `${ch.h}px`;
    if (ch.round) host.style.borderRadius = "50%";
    if (ch.arch) host.style.borderRadius = `${ch.arch}px ${ch.arch}px 0 0`;
    api.worldLayerEl.appendChild(host);
    let lastSound = 0;
    createWipeLayer(host, {
      width: ch.w,
      height: ch.h,
      cols: 5,
      rows: ch.h > ch.w * 1.5 ? 8 : 4,
      threshold: 0.55,
      radius: ch.texture === "leaves" ? 22 : 26,
      texture: ch.texture,
      onCleared: () => {
        if (!z.chores.includes(ch.id)) z.chores.push(ch.id);
        playDustGone();
        note(`${ch.label} ${CHORE_DONE_TEXT[ch.texture]}`);
        setTimeout(() => host.remove(), 500);
        save();
      },
      onWipeTick: () => {
        const t = performance.now();
        if (t - lastSound > 110) {
          lastSound = t;
          playWipe();
        }
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Oś dziejów (0.10) — tablica medalionów w galerii
// ---------------------------------------------------------------------------

const INK_OS = 2;
const OS_R = 20; // promień krążka (px świata)
const OS_ZAPAS = 30; // zapas przy trafianiu w medalion (px świata) — wygoda palca i rysika
let osDropAt = 0; // chwila ostatniego upuszczenia książki na tablicę (hover nie przykrywa wtedy komunikatu)
const osEls = new Map(); // id medalionu -> element

/** Środek krążka i-tego medalionu (współrzędne świata). */
function osCenter(i) {
  const o = Z.os;
  const cellW = o.w / o.cols;
  const rows = Math.ceil(OS_DZIEJOW.length / o.cols);
  const cellH = o.h / rows;
  return { x: o.x + cellW * ((i % o.cols) + 0.5), y: o.y + cellH * Math.floor(i / o.cols) + 9 + OS_R };
}

/** Medalion najbliżej punktu świata (w granicach krążka + zapas), albo null. */
function osMedalionAt(worldPt) {
  let best = null;
  let bestD = Infinity;
  OS_DZIEJOW.forEach((m, i) => {
    const c = osCenter(i);
    if (Math.abs(worldPt.x - c.x) > OS_R + OS_ZAPAS || Math.abs(worldPt.y - c.y) > OS_R + OS_ZAPAS) return;
    const d = Math.hypot(worldPt.x - c.x, worldPt.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  });
  return best;
}

function osDate(m) {
  const p = m.data.split("–");
  return p.length === 2 ? `${p[0]}–${p[1].slice(-2)}` : m.data;
}

function renderOsMedalion(m) {
  const el = osEls.get(m.id);
  if (!el) return;
  const done = zs().os.includes(m.id);
  el.classList.toggle("zrobiony", done);
  const b = done ? bookById(zs().osBooks && zs().osBooks[m.id]) : null;
  el.querySelector(".os-ksiazka").textContent = done && b ? b.title : "";
}

function osInfoTip(m) {
  const i = OS_DZIEJOW.indexOf(m);
  const c = osCenter(i);
  const done = zs().os.includes(m.id);
  api.showMsgTip(
    `${m.data} — ${m.nazwa}. ${done ? "To wydarzenie ma już swoją książkę." : "Przyłóż książkę, która się z tym wiąże"}`,
    api.worldToScreenX(c.x),
    Math.max(90, api.worldToScreenY(c.y + OS_R + 6)),
    3600
  );
}

function buildOs() {
  const o = Z.os;
  const board = document.createElement("div");
  board.className = "os-tablica";
  board.style.left = `${o.x}px`;
  board.style.top = `${o.y}px`;
  board.style.width = `${o.w}px`;
  board.style.height = `${o.h}px`;
  board.innerHTML = `<div class="os-napis">Oś dziejów</div>`;
  api.worldLayerEl.appendChild(board);
  const cellW = o.w / o.cols;
  OS_DZIEJOW.forEach((m, i) => {
    const c = osCenter(i);
    const el = document.createElement("div");
    el.className = "os-medalion";
    el.style.left = `${c.x - o.x - cellW / 2}px`; // względem tablicy
    el.style.top = `${c.y - o.y - OS_R}px`;
    el.style.width = `${cellW}px`;
    el.dataset.osId = m.id;
    el.innerHTML =
      `<div class="os-krazek"><span>${escapeHtml(osDate(m))}</span></div>` +
      `<div class="os-podpis">${escapeHtml(m.nazwa)}</div><div class="os-ksiazka"></div>`;
    board.appendChild(el);
    osEls.set(m.id, el);
    // Stuknięcie/kliknięcie i najechanie myszą/rysikiem: data, nazwa i podpowiedź.
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    el.addEventListener("click", () => osInfoTip(m));
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch" && !api.isDragging() && performance.now() - osDropAt > 3000) osInfoTip(m);
    });
    renderOsMedalion(m);
  });
}

function onOsDrop(info, m) {
  osDropAt = performance.now();
  const z = zs();
  if (z.os.includes(m.id)) return { reject: "To wydarzenie ma już swoją książkę." };
  if (!m.ksiazki.includes(info.id)) {
    return { reject: "Ta książka nie wiąże się z tym wydarzeniem. Weź ją do ręki i zajrzyj do „Tła historycznego”." };
  }
  z.os.push(m.id);
  if (!z.osBooks || typeof z.osBooks !== "object") z.osBooks = {};
  z.osBooks[m.id] = info.id;
  addInk(INK_OS);
  playEpochBonus();
  renderOsMedalion(m);
  const book = bookById(info.id);
  const h = historiaFor(info.id);
  showCard(
    `Oś dziejów: ${m.data} ${m.nazwa}`,
    `<p><strong>${escapeHtml(book.title)}</strong> — ${escapeHtml(book.author)}</p>` +
      (h ? `<p>${escapeHtml(h.zdanie)}</p>` : "") +
      `<p class="zk-rada">Medalion zaświecił. Nagroda: ${INK_OS} krople atramentu. (${z.os.length}/${OS_DZIEJOW.length})</p>`
  );
  save();
  return { then: "basket" };
}

// ---------------------------------------------------------------------------
// Panel „Zadania” — wszystko w jednym miejscu
// ---------------------------------------------------------------------------

export function showTaskList() {
  const s = computeStats(api.state);
  const row = (label, a, b) =>
    `<li class="${a >= b ? "zrobione" : ""}"><span>${label}</span><strong>${a}/${b}</strong></li>`;
  showCard(
    `Porządek sali: ${s.percent}%`,
    `<ul class="zk-lista">` +
      row("Książki na regałach", s.placedBooks, s.totalBooks) +
      row("Przetarty kurz z książek", s.dustCleared, s.totalDusty) +
      row("Zmiecione pajęczyny", s.cobwebsCleared, s.totalCobwebs) +
      row("Naprawione książki (kartki)", s.pagesFiled, s.totalPages) +
      row("Prośby czytelników", s.requestsDone, s.totalRequests) +
      row("Pieczęcie Załuskich", s.sealsFound, s.totalSeals) +
      row("Porządki (lustro, obraz, okna, liście)", s.choresDone, s.totalChores) +
      row("Oś dziejów", s.osDone, s.totalOs) +
      `</ul><p class="zk-rada">Bonus: książki na miejscach swojej epoki — ${s.goodEpoch}/${s.totalBooks}.</p>`
  );
}

// ---------------------------------------------------------------------------
// Podpowiedzi przy pierwszym pojawieniu się w kadrze
// ---------------------------------------------------------------------------

const HINTS = [
  { key: "rewersy", text: "Na biurku czytelnicy zostawiają rewersy z prośbami — stuknij je.", rect: () => LAYOUT.folder },
  { key: "os", text: "Na ścianie galerii wisi „Oś dziejów” — przyłóż do medalionu książkę, która wiąże się z tym wydarzeniem.", rect: () => Z.os },
  { key: "lustro", text: "Lustro jest zakurzone — przetrzyj je palcem lub rysikiem.", rect: () => Z.chores[0] },
  { key: "liscie", text: "Wiatr nawiał liści — zamieć je, pocierając palcem.", rect: () => Z.chores[4] },
];

export function onCameraChangeZadania() {
  if (!api) return;
  const t = performance.now();
  if (t - lastHintAt < 5000) return;
  const shown = api.state.hintsShown || (api.state.hintsShown = {});
  const camX = api.getCamX();
  for (const h of HINTS) {
    if (shown[h.key]) continue;
    const r = h.rect();
    const cx = r.x + (r.w || 0) / 2;
    if (cx < camX + 80 || cx > camX + api.getVisibleW() - 80) continue;
    shown[h.key] = true;
    lastHintAt = t;
    setTimeout(() => api.showMsgTip(h.text, api.worldToScreenX(cx), Math.max(90, api.worldToScreenY(r.y) - 10), 3800), 1500);
    save();
    return;
  }
}

// ---------------------------------------------------------------------------

export function initZadania(worldApi) {
  api = worldApi;
  zs();
  buildTray();
  buildSeals();
  buildChores();
  buildOs();
  markDamagedBooks();
  registerDropHandler(onBookDrop);
  registerDropHandler(onPageDrop);
  setPageTapHandler(onPageTap);
}
