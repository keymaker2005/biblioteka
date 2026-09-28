// js/zadania.js
// Wersja 0.6 — więcej zadań w jednej sali (decyzja 14 w docs/PLAN.md):
//  • Prośby czytelników — rewersy na biurku przy kominku; kładziesz na nich właściwą książkę.
//  • Naprawa książek — każda luźna kartka wypadła z konkretnej książki (fragment z modułu wiedzy);
//    przeciągasz kartkę na tę książkę.
//  • Pieczęcie Załuskich — 6 ukrytych pieczęci; komplet odsłania kartę o historii biblioteki.
//  • Porządki w otoczeniu — przetrzyj lustro, szybę obrazu i okna, zamieć liście.
// Stan: state.zadania = { requestsDone, seals: [id], chores: [id] }; naprawy = state.pagesFiled.

import { LAYOUT } from "./layout.js";
import { BOOKS } from "./books.js";
import { wiedzaFor } from "./wiedza.js";
import { createWipeLayer } from "./dust.js";
import { registerDropHandler, setPageTapHandler, computeStats } from "./world.js";
import { playPaper, playDustGone, playEpochBonus, playChronologyStar, playWipe } from "./sound.js";
import { escapeHtml } from "./util.js";

const Z = LAYOUT.zadania;

const REQUESTS = [
  { who: "pani Zofia", text: "Poproszę jakąkolwiek książkę Bolesława Prusa.", ok: (b) => b.author === "Bolesław Prus" },
  { who: "pan Kazimierz", text: "Szukam dramatu z epoki romantyzmu — może być komedia.", ok: (b) => b.genre === "dramat" && b.epoch === "romantyzm" },
  { who: "panna Jadwiga", text: "Potrzebuję zimowego tomu „Chłopów”.", ok: (b) => b.id === "chlopi-2" },
  { who: "pani Helena", text: "Chciałabym poezję z dawnych wieków, sprzed rozbiorów.", ok: (b) => b.genre === "poezja" && b.epoch === "dawne" },
  { who: "pan Stefan", text: "Szukam powieści o kupcu zakochanym w arystokratce.", ok: (b) => b.id === "lalka" },
  { who: "pan Tadeusz", text: "Poproszę reportaż o dworze etiopskiego cesarza.", ok: (b) => b.id === "cesarz" },
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
  return z;
}

function addInk(n) {
  api.state.ink = Math.min(20, api.state.ink + n);
}

function save() {
  api.notifyChange();
}

function note(text, ms = 3200) {
  api.showMsgTip(text, 683, 130, ms);
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
  if (info.kind !== "book" || !trayHit(info.worldPt)) return null;
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

function bookUnderPointer(info) {
  const els = document.elementsFromPoint(info.clientX, info.clientY);
  for (const el of els) {
    const b = el.closest && el.closest(".book-item");
    if (b) return b.dataset.bookId;
  }
  return null;
}

function onPageDrop(info) {
  if (info.kind !== "page") return null;
  const bookId = bookUnderPointer(info);
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
  <p>Zgromadzono w niej około <strong>400 tysięcy</strong> druków, 20 tysięcy rękopisów i 40 tysięcy rycin — była największą publiczną książnicą XVIII-wiecznej Europy.</p>
  <p>Po upadku insurekcji kościuszkowskiej, na rozkaz Katarzyny II, zbiory wywieziono do Petersburga (grudzień 1794 – styczeń 1795). Po traktacie ryskim część wróciła do Polski — w latach 1922–1935 ponad 70 tysięcy tomów.</p>
  <p>W 1944 roku Niemcy spalili odzyskane zbiory w gmachu Biblioteki Ordynacji Krasińskich. Z książnicy Załuskich przetrwało w Polsce tylko około 2 tysięcy rękopisów i 3 tysięcy starych druków. Jej spadkobierczynią jest dziś Biblioteka Narodowa.</p>
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
      `</ul><p class="zk-rada">Bonus: książki na miejscach swojej epoki — ${s.goodEpoch}/${s.totalBooks}.</p>`
  );
}

// ---------------------------------------------------------------------------
// Podpowiedzi przy pierwszym pojawieniu się w kadrze
// ---------------------------------------------------------------------------

const HINTS = [
  { key: "rewersy", text: "Na biurku czytelnicy zostawiają rewersy z prośbami — stuknij je.", rect: () => LAYOUT.folder },
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
    if (cx < camX + 80 || cx > camX + 1366 - 80) continue;
    shown[h.key] = true;
    lastHintAt = t;
    setTimeout(() => api.showMsgTip(h.text, api.worldToScreenX(cx), Math.max(90, r.y + 60), 3800), 1500);
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
  markDamagedBooks();
  registerDropHandler(onBookDrop);
  registerDropHandler(onPageDrop);
  setPageTapHandler(onPageTap);
}
