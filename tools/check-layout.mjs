// tools/check-layout.mjs
// Sprawdza spójność js/layout.js względem js/books.js (bez sieci, bez DOM).
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
  const { BOOKS, GENRES, EPOCHS } = await import(pathToFileURL(path.join(ROOT, "js/books.js")));

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
  check("shelves.length === 5", LAYOUT.shelves.length === 5);
  const genreIds = GENRES.map((g) => g.id).sort();
  const shelfGenreIds = LAYOUT.shelves.map((s) => s.genre).sort();
  check("każdy gatunek ma dokładnie jeden regał", JSON.stringify(genreIds) === JSON.stringify(shelfGenreIds));
  let totalSlots = 0;
  const epochIds = new Set(EPOCHS.map((e) => e.id));
  for (const shelf of LAYOUT.shelves) {
    totalSlots += shelf.slots.length;
    check(`regał ${shelf.genre} w granicach świata`, inWorldBounds(shelf.x, shelf.y, shelf.w, shelf.h, LAYOUT.world));
    for (const slot of shelf.slots) {
      check(`regał ${shelf.genre}: slot ma znaną epokę (${slot.epoch})`, epochIds.has(slot.epoch));
      check(
        `regał ${shelf.genre}: slot fx/fy w [0,1]`,
        slot.fx >= 0 && slot.fx <= 1 && slot.fy >= 0 && slot.fy <= 1
      );
    }
  }
  check(`suma slotów na regałach === 30 (jest ${totalSlots})`, totalSlots === 30);

  console.log("== Pojemność regału === liczba książek tego gatunku ==");
  for (const shelf of LAYOUT.shelves) {
    const n = BOOKS.filter((b) => b.genre === shelf.genre).length;
    check(`regał ${shelf.genre}: ${shelf.slots.length} miejsc, ${n} książek`, shelf.slots.length === n);
  }

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

  console.log("== Bays ==");
  check("bays.length === 4", LAYOUT.bays.length === 4);
  const totalBayWidth = LAYOUT.bays.reduce((n, b) => n + b.width, 0);
  check(`suma szerokości wnęk === world.width (jest ${totalBayWidth})`, totalBayWidth === LAYOUT.world.width);

  console.log("== Książki (30) ==");
  check("BOOKS.length === 30", BOOKS.length === 30);
  const bookIds = new Set(BOOKS.map((b) => b.id));
  check("BOOKS.id są unikalne", bookIds.size === BOOKS.length);
  for (const b of BOOKS) {
    check(`książka ${b.id}: znany gatunek (${b.genre})`, genreIds.includes(b.genre));
    check(`książka ${b.id}: znana epoka (${b.epoch})`, epochIds.has(b.epoch));
  }

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
