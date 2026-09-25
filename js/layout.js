// js/layout.js
// Etap 1b — WSZYSTKIE współrzędne świata sali w jednym pliku.
// Świat to pas 4960×804 px (4 wnęki po 1240 px), przewijany w poziomie pod oknem sceny (patrz js/world.js).
// Ten plik nie ma żadnej logiki gry — tylko dane geometrii.
//
// Układ współrzędnych: x liczone od lewej krawędzi świata (0..4960),
// y liczone od górnej krawędzi OKNA ŚWIATA (0..804 — górne 70 px paska
// i dolne 150 px koszyka są poza tym układem).
//
// Współrzędne są wymierzone na ilustracjach (assets/sala-1..4.jpg, 2048×1360,
// wyświetlane jako `cover` w 1240×804): x_świata = x_obrazu × 0,6055 + początek wnęki,
// y_świata = y_obrazu × 0,6055 − 10. Styk ściany z podłogą wypada ok. y = 610.
// Punkty książek, stosów i kartek to ŚRODEK okładki (okładka 72×100).
//
// Regały są według GATUNKU; epoka jest BONUSEM chronologii (`slot.epoch`), nie warunkiem.

export const WORLD_W = 4960;
export const WORLD_H = 804;
export const BAY_W = 1240;

const BAY1_X = 0; // Czytelnia: okno, stół z lampą, fotel
const BAY2_X = 1240; // Galeria: dwie puste ściany, obraz, taboret
const BAY3_X = 2480; // Kominek: biurko z szufladą, kominek, żyrandol, dywan
const BAY4_X = 3720; // Okno z zasłoną, parapet, schody na antresolę

const bays = [
  { id: "bay-1", x: BAY1_X, width: BAY_W, image: "assets/sala-1.jpg", label: "Czytelnia" },
  { id: "bay-2", x: BAY2_X, width: BAY_W, image: "assets/sala-2.jpg", label: "Galeria" },
  { id: "bay-3", x: BAY3_X, width: BAY_W, image: "assets/sala-3.jpg", label: "Przy kominku" },
  { id: "bay-4", x: BAY4_X, width: BAY_W, image: "assets/sala-4.jpg", label: "Pod antresolą" },
];

const pilasterWidth = 40;

// ---------------------------------------------------------------------------
// Regały (5) — jeden regał = jeden GATUNEK. Wszystkie używają assets/regal.png
// (3 przegródki). Ułamki wymierzone na obrazku regału:
//   wnętrze w poziomie 0,185–0,817; górne krawędzie półek (tu stoją grzbiety):
//   przegródka 1 → 0,400, przegródka 2 → 0,571, przegródka 3 → 0,772.
// Plakietki epok leżą chronologicznie: lewo→prawo, góra→dół.
// spineW/spineH — rozmiar grzbietu na TYM regale (musi się zmieścić w przegródce).
// ---------------------------------------------------------------------------

const FLOOR_FY = [0.4, 0.571, 0.772];
const COLS = {
  2: [0.36, 0.64],
  3: [0.3, 0.5, 0.7],
  4: [0.27, 0.42, 0.58, 0.73],
};

// rows: [{ c: numer przegródki 0..2, epochs: [...] }]
function slotsFor(rows) {
  const out = [];
  for (const row of rows) {
    const xs = COLS[row.epochs.length];
    row.epochs.forEach((epoch, i) => out.push({ fx: xs[i], fy: FLOOR_FY[row.c], epoch }));
  }
  return out;
}

const REGAL_IMG = "assets/regal.png";
const REGAL_RATIO = 843 / 560; // wysokość / szerokość obrazka regału
const SHELF_FOOT_Y = 648; // dół regału (stoi na podłodze tuż przed ścianą)

function shelf(genre, x, w, spineW, spineH, rows) {
  const h = Math.round(w * REGAL_RATIO);
  return { genre, x, y: SHELF_FOOT_Y - h, w, h, image: REGAL_IMG, spineW, spineH, slots: slotsFor(rows) };
}

const shelves = [
  // Nowela (4): pozytywizm×3, XX — czytelnia, między oknem a stołem (ciasno, więc mniejszy regał)
  shelf("nowela", BAY1_X + 262, 290, 30, 62, [
    { c: 1, epochs: ["pozytywizm", "pozytywizm"] },
    { c: 2, epochs: ["pozytywizm", "xx"] },
  ]),
  // Poezja (6): dawne×4, romantyzm×2 — galeria, lewa ściana
  shelf("poezja", BAY2_X + 52, 380, 38, 80, [
    { c: 0, epochs: ["dawne", "dawne"] },
    { c: 1, epochs: ["dawne", "dawne"] },
    { c: 2, epochs: ["romantyzm", "romantyzm"] },
  ]),
  // Dramat (6): dawne, romantyzm×3, Młoda Polska, XX — galeria, prawa ściana
  shelf("dramat", BAY2_X + 808, 380, 38, 80, [
    { c: 0, epochs: ["dawne", "romantyzm"] },
    { c: 1, epochs: ["romantyzm", "romantyzm"] },
    { c: 2, epochs: ["mloda", "xx"] },
  ]),
  // Powieść (10): pozytywizm×3, Młoda Polska×5, XX×2 — na prawo od kominka
  shelf("powiesc", BAY3_X + 810, 420, 42, 88, [
    { c: 0, epochs: ["pozytywizm", "pozytywizm", "pozytywizm", "mloda"] },
    { c: 1, epochs: ["mloda", "mloda", "mloda"] },
    { c: 2, epochs: ["mloda", "xx", "xx"] },
  ]),
  // Literatura faktu (4): XX×4 — między zasłoną a schodami
  shelf("faktu", BAY4_X + 545, 330, 34, 70, [
    { c: 1, epochs: ["xx", "xx"] },
    { c: 2, epochs: ["xx", "xx"] },
  ]),
];

const shelfByGenre = Object.fromEntries(shelves.map((s) => [s.genre, s]));

// Kinkiet ze świecą obok każdego regału (zgaszony na start, zapala się po ukończeniu).
const candles = shelves.map((s) => ({
  genre: s.genre,
  x: s.x + s.w + 12,
  y: Math.round(s.y + s.h * 0.3),
}));

// Żyrandol namalowany na sala-3.jpg — przy 100% porządku zapalają się płomienie na jego świecach.
// x/y = środek (poświata); flames = czubki świec w współrzędnych świata.
const chandelier = {
  x: BAY3_X + 620,
  y: 70,
  painted: true,
  flames: [
    { x: BAY3_X + 526, y: 10 },
    { x: BAY3_X + 552, y: 24 },
    { x: BAY3_X + 578, y: 3 },
    { x: BAY3_X + 663, y: 3 },
    { x: BAY3_X + 690, y: 24 },
    { x: BAY3_X + 713, y: 10 },
  ],
};

// Pajęczyna w rogu każdego regału.
const cobwebs = [
  { genre: "nowela", corner: "tr" },
  { genre: "poezja", corner: "tl" },
  { genre: "dramat", corner: "tr" },
  { genre: "powiesc", corner: "tl" },
  { genre: "faktu", corner: "tr" },
];

// ---------------------------------------------------------------------------
// Meble zastępcze (CSS), rysowane tylko gdy obraz wnęki się nie wczyta.
// Pozycje odpowiadają meblom namalowanym na ilustracjach.
// ---------------------------------------------------------------------------

const furniture = [
  { id: "window-1", label: "Okno", x: BAY1_X + 50, y: 52, w: 210, h: 434 },
  { id: "table-1", label: "Stół z lampą", x: BAY1_X + 542, y: 508, w: 503, h: 155 },
  { id: "armchair-1", label: "Fotel", x: BAY1_X + 1060, y: 396, w: 171, h: 239 },
  { id: "painting-2", label: "Obraz", x: BAY2_X + 549, y: 189, w: 139, h: 211 },
  { id: "stool-2", label: "Taboret", x: BAY2_X + 561, y: 514, w: 118, h: 124 },
  { id: "desk-3", label: "Biurko z szufladą", x: BAY3_X, y: 514, w: 409, h: 233 },
  { id: "fireplace-3", label: "Kominek", x: BAY3_X + 450, y: 396, w: 340, h: 230 },
  { id: "rug-3", label: "Dywan", x: BAY3_X + 149, y: 638, w: 924, h: 133 },
  { id: "window-4", label: "Okno", x: BAY4_X + 217, y: 58, w: 198, h: 428 },
  { id: "curtain-4", label: "Zasłona", x: BAY4_X + 363, y: 9, w: 164, h: 611 },
  { id: "stairs-4", label: "Schody na antresolę", x: BAY4_X + 856, y: 226, w: 384, h: 420 },
];

// Teczka na biurku (na luźne kartki) — leży na namalowanej teczce.
const folder = { x: BAY3_X + 160, y: 490, w: 124, h: 36 };

// ---------------------------------------------------------------------------
// Kryjówki — niewidoczne książki. Łączna pojemność = 4 (2+1+1).
// ---------------------------------------------------------------------------

const hideouts = [
  { id: "drawer", type: "drawer", label: "Szuflada biurka", x: BAY3_X + 84, y: 551, w: 195, h: 44, capacity: 2 },
  { id: "armchair", type: "armchair", label: "Fotel", x: BAY1_X + 1075, y: 470, w: 140, h: 150, capacity: 1 },
  { id: "curtain", type: "curtain", label: "Zasłona", x: BAY4_X + 375, y: 330, w: 140, h: 280, capacity: 1 },
];

// ---------------------------------------------------------------------------
// Stosy — 3 stosy (4 + 3 + 3 = 10 miejsc). Górna książka (i = size-1) jest
// jedyną dostępną; niższe trzeba najpierw zdjąć.
// ---------------------------------------------------------------------------

const stacks = [
  { id: "stack-a", x: BAY1_X + 420, y: 738, size: 4 },
  { id: "stack-b", x: BAY2_X + 750, y: 738, size: 3 },
  { id: "stack-c", x: BAY3_X + 750, y: 738, size: 3 },
];

// ---------------------------------------------------------------------------
// 16 „zwykłych” miejsc: podłoga, stół, parapety, gzyms kominka, taboret, schody.
// Na meblach środek okładki = blat − 45 (książka stoi oparta o ścianę).
// ---------------------------------------------------------------------------

const looseSpots = [
  // podłoga (9)
  { id: "floor-1", x: BAY1_X + 130, y: 740, rot: -10, kind: "floor" },
  { id: "floor-2", x: BAY1_X + 820, y: 735, rot: 14, kind: "floor" }, // pod stołem
  { id: "floor-3", x: BAY2_X + 210, y: 745, rot: -12, kind: "floor" },
  { id: "floor-4", x: BAY2_X + 1010, y: 742, rot: 8, kind: "floor" },
  { id: "floor-5", x: BAY3_X + 220, y: 752, rot: -9, kind: "floor" }, // pod biurkiem
  { id: "floor-6", x: BAY3_X + 960, y: 745, rot: 11, kind: "floor" },
  { id: "floor-7", x: BAY4_X + 70, y: 740, rot: -5, kind: "floor" },
  { id: "floor-8", x: BAY4_X + 700, y: 745, rot: 7, kind: "floor" },
  { id: "floor-9", x: BAY4_X + 1140, y: 738, rot: -7, kind: "floor" },

  // stół czytelni (2), gzyms kominka (1), taboret (1) — kind "table"
  { id: "table-1a", x: BAY1_X + 640, y: 463, rot: -6, kind: "table" },
  { id: "table-1b", x: BAY1_X + 770, y: 466, rot: 10, kind: "table" },
  { id: "mantel-3", x: BAY3_X + 500, y: 352, rot: -3, kind: "table" },
  { id: "stool-2", x: BAY2_X + 620, y: 469, rot: 4, kind: "table" },

  // parapety (2)
  { id: "sill-1", x: BAY1_X + 150, y: 447, rot: 3, kind: "sill" },
  { id: "sill-4", x: BAY4_X + 280, y: 449, rot: -5, kind: "sill" },

  // schody (1) — najniższy stopień
  { id: "stairs-4a", x: BAY4_X + 890, y: 536, rot: 6, kind: "stairs" },
];

// ---------------------------------------------------------------------------
// Generowanie 10 miejsc "stack" i 4 miejsc "hidden" z definicji wyżej,
// żeby nie duplikować liczb w dwóch miejscach.
// ---------------------------------------------------------------------------

function buildStackSpots() {
  const out = [];
  for (const stack of stacks) {
    for (let i = 0; i < stack.size; i++) {
      out.push({
        id: `${stack.id}-${i}`,
        x: stack.x,
        y: stack.y - i * 6,
        rot: i % 2 === 0 ? -4 - i * 0.6 : 4 + i * 0.6,
        kind: "stack",
        stackId: stack.id,
        stackIndex: i,
      });
    }
  }
  return out;
}

function buildHiddenSpots() {
  const out = [];
  for (const hideout of hideouts) {
    for (let i = 0; i < hideout.capacity; i++) {
      out.push({
        id: `hideout-${hideout.id}-${i}`,
        x: hideout.x,
        y: hideout.y,
        rot: 0,
        kind: "hidden",
        hideoutId: hideout.id,
        hideoutIndex: i,
      });
    }
  }
  return out;
}

const spots = [...looseSpots, ...buildStackSpots(), ...buildHiddenSpots()];

// ---------------------------------------------------------------------------
// Kurz — tylko LICZBA (12). Które książki są zakurzone wybiera się w game.js
// deterministycznie z ziarna gry, spośród książek NIE przypisanych do kryjówek.
// ---------------------------------------------------------------------------

const dustyCount = 12;

// ---------------------------------------------------------------------------
// Luźne kartki (6) rozrzucone po podłodze + teczka (patrz wyżej).
// ---------------------------------------------------------------------------

const pages = [
  { id: "page-1", x: BAY1_X + 240, y: 758, rot: -15 },
  { id: "page-2", x: BAY1_X + 980, y: 761, rot: 10 },
  { id: "page-3", x: BAY2_X + 330, y: 756, rot: -8 },
  { id: "page-4", x: BAY3_X + 80, y: 758, rot: 20 },
  { id: "page-5", x: BAY3_X + 1100, y: 761, rot: -12 },
  { id: "page-6", x: BAY4_X + 480, y: 756, rot: 5 },
];

// ---------------------------------------------------------------------------
// Eksport
// ---------------------------------------------------------------------------

export const LAYOUT = {
  world: { width: WORLD_W, height: WORLD_H },
  pilasterWidth,
  bays,
  furniture,
  shelves,
  shelfByGenre,
  candles,
  chandelier,
  cobwebs,
  hideouts,
  stacks,
  spots,
  dusty: dustyCount,
  pages,
  folder,
};
