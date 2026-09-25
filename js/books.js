// js/books.js
// Dane gry: definicje epok literackich oraz lista 30 książek (Sala Załuskich).
// Ten plik nie zawiera logiki gry — tylko dane, żeby łatwo je rozbudować w Etapie 2.

/**
 * Epoka literacka = jeden regał w sali.
 * id          — identyfikator używany w danych książek i w stanie gry
 * name        — nazwa wyświetlana na mosiężnej tabliczce
 * range       — zakres lat jako tekst (dla gracza, poglądowo)
 * mark        — znak epoki (symbol na okładce i tabliczce)
 * baseColor   — bazowy kolor oprawy książek tej epoki
 * accentColor — kolor akcentu (poświata, obwódka, detale)
 */
export const EPOCHS = [
  {
    id: "dawne",
    name: "Dawne wieki",
    range: "do 1795",
    mark: "❦",
    baseColor: "#5c1a24",
    accentColor: "#c9a227",
  },
  {
    id: "romantyzm",
    name: "Romantyzm",
    range: "1822–1863",
    mark: "☾",
    baseColor: "#16233f",
    accentColor: "#c9a227",
  },
  {
    id: "pozytywizm",
    name: "Pozytywizm",
    range: "1864–1890",
    mark: "⚙",
    baseColor: "#1f3d2e",
    accentColor: "#c9a227",
  },
  {
    id: "mloda",
    name: "Młoda Polska",
    range: "1890–1918",
    mark: "✿",
    baseColor: "#3a1f3d",
    accentColor: "#c9a227",
  },
  {
    id: "xx",
    name: "XX wiek",
    range: "od 1918",
    mark: "◆",
    baseColor: "#2b2b2e",
    accentColor: "#b3312c",
  },
];

// Szybki dostęp epoka po id.
export const EPOCH_BY_ID = Object.fromEntries(EPOCHS.map((e) => [e.id, e]));

/**
 * Książka.
 * id         — unikalny identyfikator (używany w zapisie stanu)
 * title      — tytuł wyświetlany
 * author     — autor (dla anonimowych: "Autor nieznany")
 * authorSort — nazwisko używane do sortowania na regale
 * year       — przybliżony rok powstania / wydania
 * epoch      — id epoki (właściwy regał)
 * series     — null albo {name, vol, of} dla książek wieloczęściowych
 * hint       — jedno zachęcające zdanie, bez cytatów i bez spoilerów
 */
export const BOOKS = [
  // --- Dawne wieki (do 1795) -------------------------------------------------
  {
    id: "bogurodzica",
    title: "Bogurodzica",
    author: "Autor nieznany",
    authorSort: "Nieznany",
    year: 1400,
    epoch: "dawne",
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
    series: null,
    hint: "Cykl poruszających wierszy żałobnych po stracie ukochanej córki.",
  },
  {
    id: "odprawa-poslow-greckich",
    title: "Odprawa posłów greckich",
    author: "Jan Kochanowski",
    authorSort: "Kochanowski",
    year: 1578,
    epoch: "dawne",
    series: null,
    hint: "Pierwszy polski dramat, o trudnej decyzji przed wybuchem wielkiej wojny.",
  },
  {
    id: "bajki-krasicki",
    title: "Bajki",
    author: "Ignacy Krasicki",
    authorSort: "Krasicki",
    year: 1779,
    epoch: "dawne",
    series: null,
    hint: "Zbiór krótkich, dowcipnych bajek uczących mądrości życiowej.",
  },
  {
    id: "powrot-posla",
    title: "Powrót posła",
    author: "Julian Ursyn Niemcewicz",
    authorSort: "Niemcewicz",
    year: 1791,
    epoch: "dawne",
    series: null,
    hint: "Komedia polityczna kibicująca reformom w przededniu Konstytucji 3 maja.",
  },

  // --- Romantyzm (1822–1863) --------------------------------------------------
  {
    id: "pan-tadeusz",
    title: "Pan Tadeusz",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1834,
    epoch: "romantyzm",
    series: null,
    hint: "Barwna opowieść o szlacheckim zaścianku i sporze o stary zamek.",
  },
  {
    id: "dziady-2",
    title: "Dziady cz. II",
    author: "Adam Mickiewicz",
    authorSort: "Mickiewicz",
    year: 1823,
    epoch: "romantyzm",
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
    series: { name: "Dziady", vol: 2, of: 2 },
    hint: "Dramat o cierpieniu, buncie i sile ducha w czasach niewoli.",
  },
  {
    id: "kordian",
    title: "Kordian",
    author: "Juliusz Słowacki",
    authorSort: "Słowacki",
    year: 1834,
    epoch: "romantyzm",
    series: null,
    hint: "Historia młodzieńca szukającego sensu życia i odwagi do wielkiego czynu.",
  },
  {
    id: "balladyna",
    title: "Balladyna",
    author: "Juliusz Słowacki",
    authorSort: "Słowacki",
    year: 1839,
    epoch: "romantyzm",
    series: null,
    hint: "Mroczna baśniowa opowieść o siostrzanej rywalizacji i cenie władzy.",
  },
  {
    id: "zemsta",
    title: "Zemsta",
    author: "Aleksander Fredro",
    authorSort: "Fredro",
    year: 1834,
    epoch: "romantyzm",
    series: null,
    hint: "Komedia o sąsiedzkim sporze o mur, pełna intryg i zalotów.",
  },

  // --- Pozytywizm (1864–1890) --------------------------------------------------
  {
    id: "lalka",
    title: "Lalka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1890,
    epoch: "pozytywizm",
    series: null,
    hint: "Historia kupca zakochanego bez pamięci w arystokratce z warszawskich salonów.",
  },
  {
    id: "kamizelka",
    title: "Kamizelka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1882,
    epoch: "pozytywizm",
    series: null,
    hint: "Krótka, wzruszająca opowieść o miłości i trosce w cieniu choroby.",
  },
  {
    id: "katarynka",
    title: "Katarynka",
    author: "Bolesław Prus",
    authorSort: "Prus",
    year: 1880,
    epoch: "pozytywizm",
    series: null,
    hint: "Ciepła nowela o niewidomym dziecku i sile drobnego gestu dobroci.",
  },
  {
    id: "nad-niemnem",
    title: "Nad Niemnem",
    author: "Eliza Orzeszkowa",
    authorSort: "Orzeszkowa",
    year: 1888,
    epoch: "pozytywizm",
    series: null,
    hint: "Opowieść o miłości i pamięci rodowej na tle nadniemeńskich krajobrazów.",
  },
  {
    id: "potop",
    title: "Potop",
    author: "Henryk Sienkiewicz",
    authorSort: "Sienkiewicz",
    year: 1886,
    epoch: "pozytywizm",
    series: null,
    hint: "Wielka powieść o obronie ojczyzny w czasie szwedzkiego najazdu.",
  },
  {
    id: "latarnik",
    title: "Latarnik",
    author: "Henryk Sienkiewicz",
    authorSort: "Sienkiewicz",
    year: 1881,
    epoch: "pozytywizm",
    series: null,
    hint: "Nowela o samotnym strażniku latarni i sile tęsknoty za krajem.",
  },

  // --- Młoda Polska (1890–1918) --------------------------------------------------
  {
    id: "wesele",
    title: "Wesele",
    author: "Stanisław Wyspiański",
    authorSort: "Wyspiański",
    year: 1901,
    epoch: "mloda",
    series: null,
    hint: "Symboliczny dramat o weselu w krakowskiej chacie, gdzie zjawiają się widma przeszłości.",
  },
  {
    id: "chlopi-1",
    title: "Chłopi. Tom I: Jesień",
    author: "Władysław Reymont",
    authorSort: "Reymont",
    year: 1904,
    epoch: "mloda",
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
    series: { name: "Chłopi", vol: 4, of: 4 },
    hint: "Ostatnia część epopei wieńcząca losy wiejskiej rodziny.",
  },
  {
    id: "ludzie-bezdomni",
    title: "Ludzie bezdomni",
    author: "Stefan Żeromski",
    authorSort: "Żeromski",
    year: 1899,
    epoch: "mloda",
    series: null,
    hint: "Losy młodego lekarza rozdartego między ideałem a rzeczywistością.",
  },

  // --- XX wiek (od 1918) --------------------------------------------------
  {
    id: "przedwiosnie",
    title: "Przedwiośnie",
    author: "Stefan Żeromski",
    authorSort: "Żeromski",
    year: 1924,
    epoch: "xx",
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
    series: null,
    hint: "Prowokacyjna powieść o ucieczce przed formą i powrocie do dzieciństwa.",
  },
  {
    id: "kamienie-na-szaniec",
    title: "Kamienie na szaniec",
    author: "Aleksander Kamiński",
    authorSort: "Kamiński",
    year: 1943,
    epoch: "xx",
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
    series: null,
    hint: "Reporterska rozmowa o dramatycznych dniach powstania w getcie.",
  },
  {
    id: "tango",
    title: "Tango",
    author: "Sławomir Mrożek",
    authorSort: "Mrożek",
    year: 1964,
    epoch: "xx",
    series: null,
    hint: "Absurdalna komedia o buncie syna przeciw rodzinnemu bałaganowi.",
  },
];
