// js/poziomy.js
// Wersja 1.0 — dwa poziomy trudności (decyzja 17 w docs/PLAN.md). Tylko dane, bez logiki.
//
// • Poziom podstawowy: szkoła podstawowa kl. VII–VIII + liceum, zakres podstawowy.
//   Dzisiejsza gra, ale 5 książek spoza zakresu zastąpionych obowiązkowymi z tego samego
//   gatunku (Dz.U. 2024 poz. 996 — szkoła podstawowa; lista liceum z 2024, sprawdzone 9.10.2026).
// • Poziom zaawansowany: liceum, zakres rozszerzony + lektury uzupełniające. Zbiór książek
//   jak do wersji 0.10 (z Odprawą, Nad Niemnem, Ludźmi bezdomnymi, Katarynką i Sklepami
//   cynamonowymi), 11 epok bez podpowiedzi koloru, ikona gatunku dopiero na karcie,
//   prośby czytelników po kontekście, kartki bez podpowiedzi autora, inne medaliony osi dziejów.
// Regały według gatunku na obu poziomach (decyzja 8).

export const POZIOMY = {
  podstawowy: {
    id: "podstawowy",
    nazwa: "Podstawowy",
    opis: "Lektury obowiązkowe: szkoła podstawowa (klasy VII–VIII) i liceum w zakresie podstawowym. Ikona gatunku na okładce, kolor oprawy podpowiada epokę.",
  },
  zaawansowany: {
    id: "zaawansowany",
    nazwa: "Zaawansowany",
    opis: "Liceum w zakresie rozszerzonym i lektury uzupełniające. Gatunek widać dopiero po wzięciu książki do ręki, 11 epok bez podpowiedzi koloru, czytelnicy proszą o książki po kontekście historycznym.",
  },
};

export const POZIOM_DOMYSLNY = "podstawowy";

// Zamiany książek na poziomie podstawowym: książka z poziomu zaawansowanego → jej zamiennik
// (ten sam gatunek). Zapisy sprzed 1.0 przenoszą się na poziom podstawowy według tej mapy,
// tak jak w wersji 0.8 (nowa książka przejmuje miejsce i nagrody starej).
export const ZAMIANY_PODSTAWOWY = {
  "odprawa-poslow-greckich": "balladyna",
  "nad-niemnem": "quo-vadis",
  "ludzie-bezdomni": "syzyfowe-prace",
  "katarynka": "artysta",
  "sklepy-cynamonowe": "profesor-andrews",
};

/** Id książek obecnych tylko na danym poziomie (pozostałe 25 są na obu). */
export const TYLKO_POZIOM = {
  podstawowy: Object.values(ZAMIANY_PODSTAWOWY),
  zaawansowany: Object.keys(ZAMIANY_PODSTAWOWY),
};

// ---------------------------------------------------------------------------
// Epoki na plakietkach regałów (bonus „dobra epoka”), w kolejności rzędów jak w js/layout.js
// (rows: [{ c, epochs }]). Poziom podstawowy: 5 epok z js/books.js (EPOCHS).
// ---------------------------------------------------------------------------

export const EPOKI_REGALOW = {
  podstawowy: {
    nowela: [["pozytywizm", "xx"], ["xx", "xx"]], // Latarnik | Artysta, Proszę państwa do gazu, Profesor Andrews
    poezja: [["dawne", "dawne"], ["dawne", "dawne"], ["romantyzm", "romantyzm"]],
    dramat: [["romantyzm", "romantyzm"], ["romantyzm", "romantyzm"], ["mloda", "xx"]], // Balladyna zamiast Odprawy
    powiesc: [["pozytywizm", "pozytywizm", "pozytywizm", "mloda"], ["mloda", "mloda", "mloda"], ["mloda", "xx", "xx"]],
    faktu: [["xx", "xx"], ["xx", "xx"]],
  },
  zaawansowany: {
    nowela: [["pozytywizm", "pozytywizm"], ["dwudziestolecie", "wojna"]],
    poezja: [["sredniowiecze", "sredniowiecze"], ["renesans", "oswiecenie"], ["romantyzm", "romantyzm"]],
    dramat: [["renesans", "romantyzm"], ["romantyzm", "romantyzm"], ["mloda", "po1945"]],
    powiesc: [["pozytywizm", "pozytywizm", "pozytywizm", "mloda"], ["mloda", "mloda", "mloda"], ["mloda", "dwudziestolecie", "dwudziestolecie"]],
    faktu: [["wojna", "wojna"], ["wojna", "wspolczesnosc"]],
  },
};

// 11 epok poziomu zaawansowanego — według podziału z podręczników liceum (bez starożytności,
// bo gra ma tylko polskich autorów). Barok nie ma dziś żadnej książki w sali — zostaje na
// tablicy dla porządku epok. Kolor oprawy na tym poziomie jest jednakowy (nie podpowiada).
export const EPOKI_ZAAWANSOWANE = [
  { id: "sredniowiecze", name: "Średniowiecze", range: "do ok. 1500", mark: "✠" },
  { id: "renesans", name: "Renesans", range: "XVI w.", mark: "☼" },
  { id: "barok", name: "Barok", range: "XVII w.", mark: "❦" },
  { id: "oswiecenie", name: "Oświecenie", range: "XVIII w.", mark: "✧" },
  { id: "romantyzm", name: "Romantyzm", range: "1822–1863", mark: "☾" },
  { id: "pozytywizm", name: "Pozytywizm", range: "1864–1890", mark: "⚙" },
  { id: "mloda", name: "Młoda Polska", range: "1890–1918", mark: "✿" },
  { id: "dwudziestolecie", name: "Dwudziestolecie", range: "1918–1939", mark: "◇" },
  { id: "wojna", name: "Wojna i okupacja", range: "1939–1945", mark: "✝" },
  { id: "po1945", name: "Po 1945 roku", range: "1945–1989", mark: "◆" },
  { id: "wspolczesnosc", name: "Współczesność", range: "po 1989", mark: "◎" },
];

// Epoka każdej książki na poziomie zaawansowanym. Literatura wojny i okupacji według tematu,
// jak w podręcznikach (Borowski, Herling-Grudziński, Krall), nie według roku wydania.
export const EPOKA_ZAAWANSOWANA = {
  "bogurodzica": "sredniowiecze",
  "lament-swietokrzyski": "sredniowiecze",
  "treny": "renesans",
  "bajki-krasicki": "oswiecenie",
  "sonety-krymskie": "romantyzm",
  "pan-tadeusz": "romantyzm",
  "odprawa-poslow-greckich": "renesans",
  "dziady-2": "romantyzm",
  "dziady-3": "romantyzm",
  "zemsta": "romantyzm",
  "wesele": "mloda",
  "tango": "po1945",
  "potop": "pozytywizm",
  "nad-niemnem": "pozytywizm",
  "lalka": "pozytywizm",
  "ludzie-bezdomni": "mloda",
  "chlopi-1": "mloda",
  "chlopi-2": "mloda",
  "chlopi-3": "mloda",
  "chlopi-4": "mloda",
  "przedwiosnie": "dwudziestolecie",
  "ferdydurke": "dwudziestolecie",
  "katarynka": "pozytywizm",
  "latarnik": "pozytywizm",
  "prosze-panstwa-do-gazu": "wojna",
  "sklepy-cynamonowe": "dwudziestolecie",
  "kamienie-na-szaniec": "wojna",
  "inny-swiat": "wojna",
  "zdazyc-przed-panem-bogiem": "wojna",
  "podroze-z-herodotem": "wspolczesnosc",
};

/** Atrament za dobrą epokę: +1 na podstawowym, +2 na zaawansowanym. */
export const BONUS_EPOKI = { podstawowy: 1, zaawansowany: 2 };

// ---------------------------------------------------------------------------
// Prośby czytelników (rewersy). `ok` dostaje obiekt książki z js/books.js.
// ---------------------------------------------------------------------------

export const PROSBY = {
  podstawowy: [
    { who: "pani Zofia", text: "Poproszę jakąkolwiek książkę Bolesława Prusa.", ok: (b) => b.author === "Bolesław Prus" },
    { who: "pan Kazimierz", text: "Szukam dramatu z epoki romantyzmu — może być komedia.", ok: (b) => b.genre === "dramat" && b.epoch === "romantyzm" },
    { who: "panna Jadwiga", text: "Potrzebuję zimowego tomu „Chłopów”.", ok: (b) => b.id === "chlopi-2" },
    { who: "pani Helena", text: "Chciałabym poezję z dawnych wieków, sprzed rozbiorów.", ok: (b) => b.genre === "poezja" && b.epoch === "dawne" },
    { who: "pan Stefan", text: "Szukam powieści o kupcu zakochanym w arystokratce.", ok: (b) => b.id === "lalka" },
    { who: "pan Tadeusz", text: "Poproszę reportaż o pierwszych podróżach reportera, który woził ze sobą Herodota.", ok: (b) => b.id === "podroze-z-herodotem" },
  ],
  zaawansowany: [
    { who: "pani Zofia", text: "Poproszę coś napisanego na emigracji po upadku powstania listopadowego.", ok: (b) => ["pan-tadeusz", "dziady-3"].includes(b.id) },
    { who: "pan Kazimierz", text: "Szukam dramatu, w którym na wesele przychodzi upiór przywódcy rabacji galicyjskiej.", ok: (b) => b.id === "wesele" },
    { who: "panna Jadwiga", text: "Potrzebuję wiosennego tomu powieści, za którą polski pisarz dostał Nagrodę Nobla w 1924 roku.", ok: (b) => b.id === "chlopi-3" },
    { who: "pani Helena", text: "Chciałabym utwór, który rycerstwo śpiewało przed bitwą z Krzyżakami.", ok: (b) => b.id === "bogurodzica" },
    { who: "pan Stefan", text: "Szukam książki o sowieckim łagrze, wydanej najpierw po angielsku.", ok: (b) => b.id === "inny-swiat" },
    { who: "pan Tadeusz", text: "Poproszę opowiadania o mieście naftowym w dawnej Galicji, o sklepach i ojcu-kupcu.", ok: (b) => b.id === "sklepy-cynamonowe" },
  ],
};

// ---------------------------------------------------------------------------
// Oś dziejów — 8 medalionów na każdym poziomie (tablica w galerii ma miejsce na 8).
// Na zaawansowanym wydarzenia z zakresu rozszerzonego historii i trudniejsze powiązania.
// ---------------------------------------------------------------------------

export const OS_ZAAWANSOWANA = [
  { id: "unia-lubelska", data: "1569", nazwa: "Unia lubelska i złoty wiek", ksiazki: ["treny", "odprawa-poslow-greckich"] },
  { id: "sarmatyzm", data: "XVII w.", nazwa: "Sarmatyzm", ksiazki: ["zemsta"] },
  { id: "ken", data: "1773", nazwa: "Komisja Edukacji Narodowej", ksiazki: ["bajki-krasicki"] },
  { id: "emigracja", data: "1831", nazwa: "Wielka Emigracja", ksiazki: ["pan-tadeusz", "dziady-3"] },
  { id: "rabacja", data: "1846", nazwa: "Rabacja galicyjska", ksiazki: ["wesele"] },
  { id: "uwlaszczenie", data: "1864", nazwa: "Uwłaszczenie chłopów", ksiazki: ["chlopi-1", "chlopi-2", "chlopi-3", "chlopi-4"] },
  { id: "ii-rp", data: "lata 30.", nazwa: "II Rzeczpospolita", ksiazki: ["ferdydurke", "sklepy-cynamonowe"] },
  { id: "zaglada", data: "1943", nazwa: "Zagłada Żydów", ksiazki: ["prosze-panstwa-do-gazu", "zdazyc-przed-panem-bogiem"] },
];

// ---------------------------------------------------------------------------
// Status lektury w podstawie programowej — dopisek na karcie „książka w ręku”.
// Źródła: docs/PLAN.md, sekcja „Podstawa programowa — weryfikacja” (8.10) i Dz.U. 2024 poz. 996.
// ---------------------------------------------------------------------------

export const STATUS_LEKTURY = {
  "bogurodzica": "Liceum, zakres podstawowy",
  "lament-swietokrzyski": "Liceum, zakres podstawowy (fragmenty)",
  "treny": "Szkoła podstawowa, kl. VII–VIII (treny VII i VIII); cały cykl — liceum, zakres rozszerzony",
  "bajki-krasicki": "Szkoła podstawowa, kl. IV–VI",
  "sonety-krymskie": "Liceum, zakres podstawowy (wybrane sonety)",
  "pan-tadeusz": "Szkoła podstawowa, kl. VII–VIII (księgi I, II, IV, X, XI, XII)",
  "odprawa-poslow-greckich": "Lektura uzupełniająca",
  "dziady-2": "Szkoła podstawowa, kl. VII–VIII",
  "dziady-3": "Liceum, zakres podstawowy",
  "zemsta": "Szkoła podstawowa, kl. VII–VIII",
  "wesele": "Liceum, zakres podstawowy",
  "tango": "Liceum, zakres podstawowy",
  "potop": "Liceum, zakres podstawowy (fragmenty)",
  "nad-niemnem": "Lektura uzupełniająca",
  "lalka": "Liceum, zakres podstawowy",
  "ludzie-bezdomni": "Lektura uzupełniająca",
  "chlopi-1": "Liceum, zakres podstawowy (fragmenty)",
  "chlopi-2": "Liceum, zakres podstawowy (fragmenty)",
  "chlopi-3": "Liceum, zakres podstawowy (fragmenty)",
  "chlopi-4": "Liceum, zakres podstawowy (fragmenty)",
  "przedwiosnie": "Liceum, zakres podstawowy",
  "ferdydurke": "Liceum, zakres podstawowy (fragmenty)",
  "katarynka": "Lektura uzupełniająca",
  "latarnik": "Szkoła podstawowa, kl. VII–VIII",
  "prosze-panstwa-do-gazu": "Liceum, zakres podstawowy",
  "sklepy-cynamonowe": "Liceum, zakres rozszerzony (wybrane opowiadania)",
  "kamienie-na-szaniec": "Szkoła podstawowa, kl. VII–VIII",
  "inny-swiat": "Liceum, zakres podstawowy (fragmenty)",
  "zdazyc-przed-panem-bogiem": "Liceum, zakres podstawowy",
  "podroze-z-herodotem": "Liceum, zakres podstawowy (fragmenty)",
  "balladyna": "Szkoła podstawowa, kl. VII–VIII",
  "quo-vadis": "Szkoła podstawowa, kl. VII–VIII (fragmenty)",
  "syzyfowe-prace": "Szkoła podstawowa, kl. VII–VIII (fragmenty)",
  "artysta": "Szkoła podstawowa, kl. VII–VIII",
  "profesor-andrews": "Liceum, zakres podstawowy",
};

// ===========================================================================
// Funkcje pomocnicze (dopisane w wersji 1.0 — dane powyżej bez zmian).
// Poziom jest ustawiany RAZ przed budową sali (js/game.js: ustawPoziom); zmiana poziomu
// w trakcie gry = przeładowanie strony, więc moduły mogą pytać o poziom w dowolnej chwili.
// ===========================================================================

import { BOOKS, EPOCHS } from "./books.js";
import { OS_DZIEJOW } from "./historia.js";
import { shadeColor, brightnessVariant } from "./util.js";

/** Jednakowy kolor oprawy na poziomie zaawansowanym — nie podpowiada epoki. */
export const KOLOR_OPRAWY_ZAAWANSOWANY = "#4a3423";
/** Tło plakietki epoki na regale (poziom zaawansowany nie używa kolorów epok). */
export const KOLOR_PLAKIETKI_ZAAWANSOWANY = "#5b4631";

let aktywnyPoziom = POZIOM_DOMYSLNY;

/** Ustawia poziom (id z POZIOMY); nieznane id zostawia bez zmian. Zwraca id aktywnego poziomu. */
export function ustawPoziom(id) {
  if (POZIOMY[id]) aktywnyPoziom = id;
  return aktywnyPoziom;
}

export function aktualnyPoziom() {
  return aktywnyPoziom;
}

export function czyZaawansowany(poziom = aktywnyPoziom) {
  return poziom === "zaawansowany";
}

/** Książki poziomu: BOOKS bez tych, które są tylko na drugim poziomie (30 na każdym; pomija nieistniejące). */
export function ksiazkiPoziomu(poziom = aktywnyPoziom) {
  const inny = poziom === "zaawansowany" ? "podstawowy" : "zaawansowany";
  const wykluczone = new Set(TYLKO_POZIOM[inny]);
  return BOOKS.filter((b) => !wykluczone.has(b.id));
}

/**
 * Id książki, która na danym poziomie zajmuje miejsce (stos, kryjówka, kurz, podłoga) książki
 * „bazowej” z zestawu zaawansowanego. Na podstawowym — jej zamiennik z ZAMIANY_PODSTAWOWY.
 */
export function idNaMiejscu(idBazowe, poziom = aktywnyPoziom) {
  return poziom === "podstawowy" && ZAMIANY_PODSTAWOWY[idBazowe] ? ZAMIANY_PODSTAWOWY[idBazowe] : idBazowe;
}

/** Zestaw bazowy (porządek z wersji 0.10): wszystkie książki z BOOKS bez nowych książek poziomu podstawowego. */
export function idBazowe() {
  const nowe = new Set(TYLKO_POZIOM.podstawowy);
  return BOOKS.filter((b) => !nowe.has(b.id)).map((b) => b.id);
}

/** Lista epok poziomu (z nazwą, zakresem i znakiem). */
export function epokiPoziomu(poziom = aktywnyPoziom) {
  return poziom === "zaawansowany" ? EPOKI_ZAAWANSOWANE : EPOCHS;
}

/** Id epoki książki na poziomie. */
export function epokaKsiazki(book, poziom = aktywnyPoziom) {
  return poziom === "zaawansowany" ? EPOKA_ZAAWANSOWANA[book.id] : book.epoch;
}

/** Opis epoki (id → {id, name, range, mark, ...}) na poziomie; nieznane id daje null. */
export function epokaInfo(epokaId, poziom = aktywnyPoziom) {
  return epokiPoziomu(poziom).find((e) => e.id === epokaId) || null;
}

/** Kolor oprawy: podstawowy — kolor epoki z lekką wariacją; zaawansowany — jeden dla wszystkich. */
export function kolorOprawy(book, poziom = aktywnyPoziom) {
  if (poziom === "zaawansowany") return KOLOR_OPRAWY_ZAAWANSOWANY;
  const epoka = epokaInfo(book.epoch, poziom);
  return shadeColor(epoka ? epoka.baseColor : "#2b2b2e", brightnessVariant(book.id));
}

/** Kolor plakietki epoki na regale. */
export function kolorPlakietki(epokaId, poziom = aktywnyPoziom) {
  if (poziom === "zaawansowany") return KOLOR_PLAKIETKI_ZAAWANSOWANY;
  const epoka = epokaInfo(epokaId, poziom);
  return epoka ? epoka.baseColor : "#2b2b2e";
}

export function bonusEpoki(poziom = aktywnyPoziom) {
  return BONUS_EPOKI[poziom];
}

export function prosbyPoziomu(poziom = aktywnyPoziom) {
  return PROSBY[poziom];
}

/** Medaliony „Osi dziejów” poziomu (podstawowy: OS_DZIEJOW z js/historia.js). */
export function osDziejowPoziomu(poziom = aktywnyPoziom) {
  return poziom === "zaawansowany" ? OS_ZAAWANSOWANA : OS_DZIEJOW;
}

/** Dopisek o statusie lektury w podstawie programowej (albo pusty napis). */
export function statusLektury(bookId) {
  return STATUS_LEKTURY[bookId] || "";
}

/** Epoki slotów regału gatunku, płasko (lewo→prawo, góra→dół — jak `slots` w js/layout.js). */
export function epokiSlotow(genre, poziom = aktywnyPoziom) {
  const rzedy = EPOKI_REGALOW[poziom][genre] || [];
  return rzedy.flat();
}

/**
 * Nadpisuje `epoch` slotów regałów w LAYOUT epokami poziomu. Liczba slotów musi się zgadzać
 * (pilnuje tego tools/check-layout.mjs); gdy się nie zgadza, nadpisuje tyle, ile jest wspólnych.
 */
export function zastosujEpokiRegalow(layout, poziom = aktywnyPoziom) {
  for (const shelf of layout.shelves) {
    const epoki = epokiSlotow(shelf.genre, poziom);
    shelf.slots.forEach((slot, i) => {
      if (epoki[i]) slot.epoch = epoki[i];
    });
  }
}
