// js/books.js
// Dane gry: epoki literackie (kolor oprawy + BONUS chronologii), gatunki (regały)
// i lista 30 książek (Sala Załuskich).
// Ten plik nie zawiera logiki gry — tylko dane.
//
// ⚠ Etap 1b, zmiana wymagań (feedback graczki, testerki-żony): regały są teraz
// według GATUNKU, bo epoki były za trudne do rozpoznania. Epoka zostaje jako
// kolor oprawy i jako BONUS „dobra epoka” — patrz js/layout.js (pole `epoch`
// na każdym slocie regału) i js/world.js (logika przyjmowania książek).

/**
 * Epoka literacka. Steruje kolorem oprawy książki i plakietkami chronologii
 * na regałach (bonus, nie warunek przyjęcia).
 */
export const EPOCHS = [
  { id: "dawne", name: "Dawne wieki", range: "do 1795", mark: "❦", baseColor: "#5c1a24", accentColor: "#c9a227" },
  { id: "romantyzm", name: "Romantyzm", range: "1822–1863", mark: "☾", baseColor: "#16233f", accentColor: "#c9a227" },
  { id: "pozytywizm", name: "Pozytywizm", range: "1864–1890", mark: "⚙", baseColor: "#1f3d2e", accentColor: "#c9a227" },
  { id: "mloda", name: "Młoda Polska", range: "1890–1918", mark: "✿", baseColor: "#3a1f3d", accentColor: "#c9a227" },
  { id: "xx", name: "XX wiek", range: "od 1918", mark: "◆", baseColor: "#2b2b2e", accentColor: "#b3312c" },
];

export const EPOCH_BY_ID = Object.fromEntries(EPOCHS.map((e) => [e.id, e]));

/**
 * Gatunek literacki = jeden regał. Pojemność regału (liczba slotów) jest
 * zdefiniowana w js/layout.js (shelf.slots.length), nie tutaj — tu tylko
 * nazwa i ikona.
 * icon — klucz do GENRE_ICONS (prosta ikona SVG, jeden styl, złota kreska).
 */
export const GENRES = [
  { id: "poezja", name: "Poezja", icon: "lira" },
  { id: "dramat", name: "Dramat", icon: "masks" },
  { id: "powiesc", name: "Powieść", icon: "book" },
  { id: "nowela", name: "Nowela i opowiadanie", icon: "scroll" },
  { id: "faktu", name: "Literatura faktu", icon: "magnifier" },
];

export const GENRE_BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));

/**
 * Proste ikony gatunków — inline SVG, jeden styl (złota kreska, stroke="currentColor",
 * bez wypełnienia). Kolor ustawia się przez CSS `color` na elemencie-rodzicu.
 * viewBox 0 0 24 24, żeby łatwo skalować przez `width`/`height` w CSS.
 */
export const GENRE_ICONS = {
  // Poezja — lira
  lira: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 20V9c0-3 1.5-5 2.5-6" />
    <path d="M18 20V9c0-3-1.5-5-2.5-6" />
    <path d="M6 20h12" />
    <path d="M9 8c1 1.5 1 3.5 0 5M15 8c-1 1.5-1 3.5 0 5" />
    <line x1="10.2" y1="7" x2="10.2" y2="18" />
    <line x1="12" y1="6.4" x2="12" y2="18.6" />
    <line x1="13.8" y1="7" x2="13.8" y2="18" />
  </svg>`,
  // Dramat — maski teatralne
  masks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 8c0-2.2 1.8-4 4-4s4 1.8 4 4v3c0 3-1.8 5-4 5s-4-2-4-5V8z" />
    <path d="M12 9c0-2.2 1.8-4 4-4s4 1.8 4 4v2c0 3-1.8 6-4 6s-4-3-4-6V9z" />
    <path d="M6.5 8.5h.01M9.5 8.5h.01" />
    <path d="M6 12c1 1 3 1 4 0" />
    <path d="M14.5 8.8h.01M17.5 8.8h.01" />
    <path d="M14.5 12.5c1-1 3-1 4 0" />
  </svg>`,
  // Powieść — gruba, otwarta księga
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 6.5c-1.6-1.1-4-1.5-8-1.5v13c4 0 6.4.4 8 1.5" />
    <path d="M12 6.5c1.6-1.1 4-1.5 8-1.5v13c-4 0-6.4.4-8 1.5" />
    <line x1="12" y1="6.5" x2="12" y2="19.5" />
    <path d="M6 8.3h3M6 11h3M15 8.3h3M15 11h3" />
  </svg>`,
  // Nowela — zwój / list
  scroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 5.5a2 2 0 100 4h1V5.5H6z" />
    <path d="M18 18.5a2 2 0 100-4h-1v4h1z" />
    <path d="M7 5.5h10v4a2 2 0 002 2H7" />
    <path d="M17 18.5H7v-4a2 2 0 00-2-2h12" />
    <line x1="9.5" y1="9.7" x2="14.5" y2="9.7" />
  </svg>`,
  // Literatura faktu — lupa
  magnifier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10.5" cy="10.5" r="5.5" />
    <line x1="14.6" y1="14.6" x2="20" y2="20" />
  </svg>`,
};

/**
 * Książka.
 * id         — unikalny identyfikator (używany w zapisie stanu)
 * title      — tytuł wyświetlany
 * author     — autor (dla anonimowych: "Autor nieznany")
 * authorSort — nazwisko używane przy sortowaniu / porządkowaniu wewnątrz danych
 * year       — przybliżony rok powstania / wydania
 * epoch      — id epoki (kolor oprawy + bonus chronologii)
 * genre      — id gatunku (WŁAŚCIWY regał — warunek przyjęcia)
 * series     — null albo {name, vol, of} dla książek wieloczęściowych
 * hint       — jedno krótkie, zachęcające zdanie, bez cytatów i bez spoilerów
 */
export const BOOKS = [
  // --- POEZJA (6) -------------------------------------------------------
  {
    id: "bogurodzica",
    title: "Bogurodzica",
    author: "Autor nieznany",
    authorSort: "Nieznany",
    year: 1407,
    epoch: "dawne",
    genre: "poezja",
    series: null,
    hint: "Najstarsza znana polska pieśń religijna i bojowy hymn rycerstwa.",
  },
  {
    id: "lament-swietokrzyski",
    title: "Lament świętokrzyski",
    author: "Autor nieznany",
    authorSort: "Nieznany",
    year: 1470,
    epoch: "dawne",
    genre: "poezja",
    series: null,
    hint: "Wzruszający głos matki żegnającej się z umierającym synem, spisany w średniowieczu.",
  },
  {
    id: "treny",
    title: "Treny",
    author: "Jan Kochanowski",
    authorSort: "Kochanowski",
    year: 1580,
    epoch: "dawne",
    genre: "poezja",
    series: null,
    hint: "Cykl poruszających wierszy żałobnych po stracie ukochanej córki.",
  },
  {
    id: "bajki-krasicki",
    title: "Bajki",
    author: "Ignacy Krasicki",
    authorSort: "Krasicki",
    year: 1779,
    epoch: "dawne",
    genre: "poezja",
    series: null,
    hint: "Zbiór krótkich, dowcipnych bajek uczących mądrości życiowej.",
  },
  {
    id: "sonety-krymskie",
    title: "Sonety krymskie",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1826,
    epoch: "romantyzm",
    genre: "poezja",
    series: null,
    hint: "Cykl wierszy pełnych orientalnych krajobrazów i tęsknoty za ojczyzną.",
  },
  {
    id: "pan-tadeusz",
    title: "Pan Tadeusz",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1834,
    epoch: "romantyzm",
    genre: "poezja",
    series: null,
    hint: "Barwna opowieść o szlacheckim zaścianku i sporze o stary zamek.",
  },

  // --- DRAMAT (6) ---------------------------------------------------------
  {
    id: "odprawa-poslow-greckich",
    title: "Odprawa posłów greckich",
    author: "Jan Kochanowski",
    authorSort: "Kochanowski",
    year: 1578,
    epoch: "dawne",
    genre: "dramat",
    series: null,
    hint: "Pierwszy polski dramat, o trudnej decyzji przed wybuchem wielkiej wojny.",
  },
  {
    id: "dziady-2",
    title: "Dziady cz. II",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1823,
    epoch: "romantyzm",
    genre: "dramat",
    series: { name: "Dziady", vol: 1, of: 2 },
    hint: "Tajemniczy obrzęd przywołujący duchy, osnuty wokół ludowych wierzeń.",
  },
  {
    id: "dziady-3",
    title: "Dziady cz. III",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1832,
    epoch: "romantyzm",
    genre: "dramat",
    series: { name: "Dziady", vol: 2, of: 2 },
    hint: "Dramat o cierpieniu, buncie i sile ducha w czasach niewoli.",
  },
  {
    id: "zemsta",
    title: "Zemsta",
    author: "Aleksander Fredro",
    authorSort: "Fredro",
    year: 1834,
    epoch: "romantyzm",
    genre: "dramat",
    series: null,
    hint: "Komedia o sąsiedzkim sporze o mur, pełna intryg i zalotów.",
  },
  {
    id: "wesele",
    title: "Wesele",
    author: "Stanisław Wyspiański",
    authorSort: "Wyspiański",
    year: 1901,
    epoch: "mloda",
    genre: "dramat",
    series: null,
    hint: "Symboliczny dramat o weselu w krakowskiej chacie, gdzie zjawiają się widma przeszłości.",
  },
  {
    id: "tango",
    title: "Tango",
    author: "Sławomir Mrożek",
    authorSort: "Mrożek",
    year: 1964,
    epoch: "xx",
    genre: "dramat",
    series: null,
    hint: "Absurdalna komedia o buncie syna przeciw rodzinnemu bałaganowi.",
  },

  // --- POWIEŚĆ (10) --------------------------------------------------------
  {
    id: "potop",
    title: "Potop",
    author: "Henryk Sienkiewicz",
    authorSort: "Sienkiewicz",
    year: 1886,
    epoch: "pozytywizm",
    genre: "powiesc",
    series: null,
    hint: "Wielka powieść o obronie ojczyzny w czasie szwedzkiego najazdu.",
  },
  {
    id: "nad-niemnem",
    title: "Nad Niemnem",
    author: "Eliza Orzeszkowa",
    authorSort: "Orzeszkowa",
    year: 1888,
    epoch: "pozytywizm",
    genre: "powiesc",
    series: null,
    hint: "Opowieść o miłości i pamięci rodowej na tle nadniemeńskich krajobrazów.",
  },
  {
    id: "lalka",
    title: "Lalka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1890,
    epoch: "pozytywizm",
    genre: "powiesc",
    series: null,
    hint: "Historia kupca zakochanego bez pamięci w arystokratce z warszawskich salonów.",
  },
  {
    id: "ludzie-bezdomni",
    title: "Ludzie bezdomni",
    author: "Stefan Żeromski",
    authorSort: "Żeromski",
    year: 1900,
    epoch: "mloda",
    genre: "powiesc",
    series: null,
    hint: "Losy młodego lekarza rozdartego między ideałem a rzeczywistością.",
  },
  {
    id: "chlopi-1",
    title: "Chłopi. Tom I: Jesień",
    author: "Władysław Reymont",
    authorSort: "Reymont",
    year: 1904,
    epoch: "mloda",
    genre: "powiesc",
    series: { name: "Chłopi", vol: 1, of: 4 },
    hint: "Pierwsza część wiejskiej epopei o życiu i namiętnościach chłopskiej gromady.",
  },
  {
    id: "chlopi-2",
    title: "Chłopi. Tom II: Zima",
    author: "Władysław Reymont",
    authorSort: "Reymont",
    year: 1904,
    epoch: "mloda",
    genre: "powiesc",
    series: { name: "Chłopi", vol: 2, of: 4 },
    hint: "Zimowa odsłona wiejskiej społeczności, jej obyczajów i konfliktów.",
  },
  {
    id: "chlopi-3",
    title: "Chłopi. Tom III: Wiosna",
    author: "Władysław Reymont",
    authorSort: "Reymont",
    year: 1906,
    epoch: "mloda",
    genre: "powiesc",
    series: { name: "Chłopi", vol: 3, of: 4 },
    hint: "Wiosenna część opowieści o rytmie wsi i ludzkich namiętnościach.",
  },
  {
    id: "chlopi-4",
    title: "Chłopi. Tom IV: Lato",
    author: "Władysław Reymont",
    authorSort: "Reymont",
    year: 1909,
    epoch: "mloda",
    genre: "powiesc",
    series: { name: "Chłopi", vol: 4, of: 4 },
    hint: "Ostatnia część epopei wieńcząca losy wiejskiej rodziny.",
  },
  {
    id: "przedwiosnie",
    title: "Przedwiośnie",
    author: "Stefan Żeromski",
    authorSort: "Żeromski",
    year: 1924,
    epoch: "xx",
    genre: "powiesc",
    series: null,
    hint: "Powieść o młodzieńczych złudzeniach wobec odradzającej się ojczyzny.",
  },
  {
    id: "ferdydurke",
    title: "Ferdydurke",
    author: "Witold Gombrowicz",
    authorSort: "Gombrowicz",
    year: 1937,
    epoch: "xx",
    genre: "powiesc",
    series: null,
    hint: "Prowokacyjna powieść o ucieczce przed formą i powrocie do dzieciństwa.",
  },

  // --- NOWELA I OPOWIADANIE (4) --------------------------------------------
  {
    id: "katarynka",
    title: "Katarynka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1880,
    epoch: "pozytywizm",
    genre: "nowela",
    series: null,
    hint: "Ciepła nowela o niewidomym dziecku i sile drobnego gestu dobroci.",
  },
  {
    id: "latarnik",
    title: "Latarnik",
    author: "Henryk Sienkiewicz",
    authorSort: "Sienkiewicz",
    year: 1881,
    epoch: "pozytywizm",
    genre: "nowela",
    series: null,
    hint: "Nowela o samotnym strażniku latarni i sile tęsknoty za krajem.",
  },
  {
    id: "kamizelka",
    title: "Kamizelka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1882,
    epoch: "pozytywizm",
    genre: "nowela",
    series: null,
    hint: "Krótka, wzruszająca opowieść o miłości i trosce w cieniu choroby.",
  },
  {
    id: "sklepy-cynamonowe",
    title: "Sklepy cynamonowe",
    author: "Bruno Schulz",
    authorSort: "Schulz",
    year: 1934,
    epoch: "xx",
    genre: "nowela",
    series: null,
    hint: "Baśniowe, pełne wyobraźni wspomnienia z dzieciństwa w małym miasteczku.",
  },

  // --- LITERATURA FAKTU (4) -------------------------------------------------
  {
    id: "kamienie-na-szaniec",
    title: "Kamienie na szaniec",
    author: "Aleksander Kamiński",
    authorSort: "Kamiński",
    year: 1943,
    epoch: "xx",
    genre: "faktu",
    series: null,
    hint: "Prawdziwa historia młodych harcerzy w konspiracji czasu wojny.",
  },
  {
    id: "inny-swiat",
    title: "Inny świat",
    author: "Gustaw Herling-Grudziński",
    authorSort: "Herling-Grudziński",
    year: 1951,
    epoch: "xx",
    genre: "faktu",
    series: null,
    hint: "Wstrząsające wspomnienia z pobytu w sowieckim łagrze.",
  },
  {
    id: "zdazyc-przed-panem-bogiem",
    title: "Zdążyć przed Panem Bogiem",
    author: "Hanna Krall",
    authorSort: "Krall",
    year: 1977,
    epoch: "xx",
    genre: "faktu",
    series: null,
    hint: "Reporterska rozmowa o dramatycznych dniach powstania w getcie.",
  },
  {
    id: "cesarz",
    title: "Cesarz",
    author: "Ryszard Kapuściński",
    authorSort: "Kapuściński",
    year: 1978,
    epoch: "xx",
    genre: "faktu",
    series: null,
    hint: "Reporterska opowieść o upadku władcy dalekiego afrykańskiego cesarstwa.",
  },
];
