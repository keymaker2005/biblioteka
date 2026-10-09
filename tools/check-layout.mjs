// tools/check-layout.mjs
// Sprawdza spójność js/layout.js względem js/books.js i js/poziomy.js — OBU poziomów trudności (bez sieci, bez DOM).
// Uruchomienie: node tools/check-layout.mjs

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    console.error(`  !!  ${label}`);
    failures++;
  }
}

function inWorldBounds(x, y, w = 0, h = 0, world) {
  return x >= 0 && y >= 0 && x + w <= world.width && y + h <= world.height;
}

async function main() {
  const { LAYOUT, WORLD_W, WORLD_H } = await import(pathToFileURL(path.join(ROOT, "js/layout.js")));
  const { BOOKS, GENRES } = await import(pathToFileURL(path.join(ROOT, "js/books.js")));
  const P = await import(pathToFileURL(path.join(ROOT, "js/poziomy.js")));

  console.log("== Świat ==");
  check("world.width === 4 × 1240 = 4960", LAYOUT.world.width === 4960 && WORLD_W === 4960);
  check("world.height === 804", LAYOUT.world.height === 804 && WORLD_H === 804);

  console.log("== Spots (30: 10 stack, 4 hidden, 16 pozostałych) ==");
  check("spots.length === 30", LAYOUT.spots.length === 30);
  const byKind = { floor: 0, table: 0, sill: 0, stairs: 0, stack: 0, hidden: 0 };
  for (const s of LAYOUT.spots) {
    if (byKind[s.kind] === undefined) byKind[s.kind] = 0;
    byKind[s.kind]++;
  }
  check(`kind=stack === 10 (jest ${byKind.stack})`, byKind.stack === 10);
  check(`kind=hidden === 4 (jest ${byKind.hidden})`, byKind.hidden === 4);
  const rest = byKind.floor + byKind.table + byKind.sill + byKind.stairs;
  check(`floor+table+sill+stairs === 16 (jest ${rest})`, rest === 16);
  const idSet = new Set(LAYOUT.spots.map((s) => s.id));
  check("spots.id są unikalne", idSet.size === LAYOUT.spots.length);
  for (const s of LAYOUT.spots) {
    check(`spot ${s.id} w granicach świata`, inWorldBounds(s.x, s.y, 0, 0, LAYOUT.world));
  }

  console.log("== Stosy (4+3+3 = 10) ==");
  check("stacks.length === 3", LAYOUT.stacks.length === 3);
  const stackTotal = LAYOUT.stacks.reduce((n, s) => n + s.size, 0);
  check(`suma rozmiarów stosów === 10 (jest ${stackTotal})`, stackTotal === 10);
  for (const st of LAYOUT.stacks) {
    check(`stos ${st.id} w granicach świata`, inWorldBounds(st.x, st.y, 0, 0, LAYOUT.world));
  }

  console.log("== Regały (5 gatunków, razem 30 slotów) ==");
  const genreIdsAll = GENRES.map((g) => g.id);
  check("shelves.length === 5", LAYOUT.shelves.length === 5);
  const genreIds = GENRES.map((g) => g.id).sort();
  const shelfGenreIds = LAYOUT.shelves.map((s) => s.genre).sort();
  check("każdy gatunek ma dokładnie jeden regał", JSON.stringify(genreIds) === JSON.stringify(shelfGenreIds));
  let totalSlots = 0;
  for (const shelf of LAYOUT.shelves) {
    totalSlots += shelf.slots.length;
    check(`regał ${shelf.genre} w granicach świata`, inWorldBounds(shelf.x, shelf.y, shelf.w, shelf.h, LAYOUT.world));
    for (const slot of shelf.slots) {
      check(
        `regał ${shelf.genre}: slot fx/fy w [0,1]`,
        slot.fx >= 0 && slot.fx <= 1 && slot.fy >= 0 && slot.fy <= 1
      );
    }
  }
  check(`suma slotów na regałach === 30 (jest ${totalSlots})`, totalSlots === 30);

  console.log("== Kryjówki (3, łącznie 4 miejsca) ==");
  check("hideouts.length === 3", LAYOUT.hideouts.length === 3);
  const hideoutTotal = LAYOUT.hideouts.reduce((n, h) => n + h.capacity, 0);
  check(`suma pojemności kryjówek === 4 (jest ${hideoutTotal})`, hideoutTotal === 4);
  for (const h of LAYOUT.hideouts) {
    check(`kryjówka ${h.id} w granicach świata`, inWorldBounds(h.x, h.y, h.w, h.h, LAYOUT.world));
  }

  console.log("== Kartki (6) + teczka ==");
  check("pages.length === 6", LAYOUT.pages.length === 6);
  for (const p of LAYOUT.pages) {
    check(`kartka ${p.id} w granicach świata`, inWorldBounds(p.x, p.y, 0, 0, LAYOUT.world));
  }
  check("folder w granicach świata", inWorldBounds(LAYOUT.folder.x, LAYOUT.folder.y, LAYOUT.folder.w, LAYOUT.folder.h, LAYOUT.world));

  console.log("== Kandelabry, żyrandol, pajęczyny ==");
  check("candles.length === 5", LAYOUT.candles.length === 5);
  for (const c of LAYOUT.candles) {
    check(`świeca ${c.genre} w granicach świata`, inWorldBounds(c.x, c.y, 0, 0, LAYOUT.world));
  }
  check("chandelier w granicach świata", inWorldBounds(LAYOUT.chandelier.x, LAYOUT.chandelier.y, 0, 0, LAYOUT.world));
  check("cobwebs.length === 5", LAYOUT.cobwebs.length === 5);

  console.log("== Meble zastępcze (fallback CSS) ==");
  for (const f of LAYOUT.furniture) {
    check(`meble ${f.id} w granicach świata`, inWorldBounds(f.x, f.y, f.w, f.h, LAYOUT.world));
  }

  console.log("== Oś dziejów (0.10) ==");
  const os = LAYOUT.zadania.os;
  for (const poz of Object.keys(P.POZIOMY)) {
    const medaliony = P.osDziejowPoziomu(poz);
    check(`[${poz}] osTotal === liczba medalionów (${medaliony.length})`, LAYOUT.zadania.osTotal === medaliony.length);
    check(`[${poz}] id medalionów są unikalne`, new Set(medaliony.map((m) => m.id)).size === medaliony.length);
    const idKsiazek = new Set(P.ksiazkiPoziomu(poz).map((b) => b.id));
    for (const m of medaliony) {
      check(`[${poz}] medalion ${m.id}: ma co najmniej jedną książkę z poziomu`, m.ksiazki.some((id) => idKsiazek.has(id)));
      for (const id of m.ksiazki) if (!idKsiazek.has(id)) console.log(`  ..  [${poz}] medalion ${m.id}: książka ${id} nie należy do poziomu (pomijana, nie błąd)`);
    }
  }
  check("tablica osi w granicach świata", inWorldBounds(os.x, os.y, os.w, os.h, LAYOUT.world));
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const sh of LAYOUT.shelves) check(`tablica osi nie nachodzi na regał ${sh.genre}`, !hit(os, sh));
  for (const w of LAYOUT.windows) check(`tablica osi nie nachodzi na okno ${w.id}`, !hit(os, w));
  for (const h of LAYOUT.hideouts) check(`tablica osi nie nachodzi na kryjówkę ${h.id}`, !hit(os, h));
  for (const c of LAYOUT.zadania.chores) check(`tablica osi nie nachodzi na porządek ${c.id}`, !hit(os, c));
  check("tablica osi nie nachodzi na obraz", !hit(os, LAYOUT.furniture.find((f) => f.id === "painting-2")));
  check("tablica osi nie nachodzi na teczkę", !hit(os, LAYOUT.folder));
  for (const c of LAYOUT.candles) check(`tablica osi nie zasłania kinkietu ${c.genre}`, !hit(os, { x: c.x - 14, y: c.y - 30, w: 28, h: 60 }));
  for (const sl of LAYOUT.zadania.seals) check(`tablica osi nie zasłania pieczęci ${sl.id}`, !hit(os, { x: sl.x - 15, y: sl.y - 15, w: 30, h: 30 }));
  for (const sp of LAYOUT.spots) check(`tablica osi nie zasłania miejsca ${sp.id}`, !hit(os, { x: sp.x - 36, y: sp.y - 50, w: 72, h: 100 }));

  console.log("== Bays ==");
  check("bays.length === 4", LAYOUT.bays.length === 4);
  const totalBayWidth = LAYOUT.bays.reduce((n, b) => n + b.width, 0);
  check(`suma szerokości wnęk === world.width (jest ${totalBayWidth})`, totalBayWidth === LAYOUT.world.width);

  console.log("== Książki ==");
  const bookIds = new Set(BOOKS.map((b) => b.id));
  check("BOOKS.id są unikalne", bookIds.size === BOOKS.length);
  for (const b of BOOKS) check(`książka ${b.id}: znany gatunek (${b.genre})`, genreIdsAll.includes(b.genre));
  for (const [stare, nowe] of Object.entries(P.ZAMIANY_PODSTAWOWY)) {
    check(`zamiana ${stare} → ${nowe}: obie książki są w BOOKS`, bookIds.has(stare) && bookIds.has(nowe));
    if (bookIds.has(stare) && bookIds.has(nowe)) {
      const a = BOOKS.find((b) => b.id === stare);
      const b = BOOKS.find((b2) => b2.id === nowe);
      check(`zamiana ${stare} → ${nowe}: ten sam gatunek (${a.genre})`, a.genre === b.genre);
    }
  }

  // Każdy poziom: 30 książek, pojemność regałów = liczba książek gatunku, epoki istnieją,
  // a liczba książek danej epoki w gatunku = liczba plakietek tej epoki na regale
  // (inaczej „Ład chronologiczny” byłby nieosiągalny).
  for (const poz of Object.keys(P.POZIOMY)) {
    console.log(`== Poziom ${poz} ==`);
    P.ustawPoziom(poz);
    P.zastosujEpokiRegalow(LAYOUT, poz);
    const ksiazki = P.ksiazkiPoziomu(poz);
    const epochIds = new Set(P.epokiPoziomu(poz).map((e) => e.id));
    check(`[${poz}] liczba książek === 30 (jest ${ksiazki.length})`, ksiazki.length === 30);
    check(`[${poz}] suma slotów === liczba książek`, totalSlots === ksiazki.length);
    check(`[${poz}] bonus epoki zdefiniowany`, Number.isInteger(P.bonusEpoki(poz)) && P.bonusEpoki(poz) > 0);
    check(`[${poz}] liczba próśb === requestsTotal`, P.prosbyPoziomu(poz).length === LAYOUT.zadania.requestsTotal);
    for (const stare of Object.keys(P.ZAMIANY_PODSTAWOWY)) {
      const nowe = P.ZAMIANY_PODSTAWOWY[stare];
      const obca = poz === "podstawowy" ? stare : nowe;
      check(`[${poz}] brak książki z drugiego poziomu (${obca})`, !ksiazki.some((b) => b.id === obca));
    }
    for (const b of ksiazki) {
      const epoka = P.epokaKsiazki(b, poz);
      check(`[${poz}] książka ${b.id}: epoka ${epoka} jest na liście epok poziomu`, epochIds.has(epoka));
      check(`[${poz}] książka ${b.id}: ma status lektury`, P.statusLektury(b.id) !== "");
    }
    for (const shelf of LAYOUT.shelves) {
      const epokiSlotow = P.epokiSlotow(shelf.genre, poz);
      check(`[${poz}] regał ${shelf.genre}: epoki z poziomy.js (${epokiSlotow.length}) = liczba slotów (${shelf.slots.length})`, epokiSlotow.length === shelf.slots.length);
      const dane = ksiazki.filter((b) => b.genre === shelf.genre);
      check(`[${poz}] regał ${shelf.genre}: ${shelf.slots.length} miejsc, ${dane.length} książek`, shelf.slots.length === dane.length);
      for (const slot of shelf.slots) check(`[${poz}] regał ${shelf.genre}: slot ma znaną epokę (${slot.epoch})`, epochIds.has(slot.epoch));
      for (const e of epochIds) {
        const ksiazekEpoki = dane.filter((b) => P.epokaKsiazki(b, poz) === e).length;
        const plakietek = shelf.slots.filter((sl) => sl.epoch === e).length;
        check(`[${poz}] regał ${shelf.genre}, epoka ${e}: ${ksiazekEpoki} książek, ${plakietek} plakietek`, ksiazekEpoki === plakietek);
      }
    }
  }
  P.ustawPoziom(P.POZIOM_DOMYSLNY);

  console.log("");
  if (failures > 0) {
    console.error(`ZNALEZIONO ${failures} BŁĘDÓW.`);
    process.exit(1);
  } else {
    console.log("Wszystko spójne — 0 błędów.");
  }
}

main().catch((err) => {
  console.error("Błąd sprawdzania layoutu:", err);
  process.exit(1);
});
