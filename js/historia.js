// js/historia.js
// Wersja 0.10 — „Tło historyczne” (propozycja z docs/PLAN.md, sekcja „Kontekst historyczny”).
// Dla każdej książki: wydarzenie, data, jedno-dwa zdania wiążące lekturę z historią,
// poziom (P = zakres podstawowy historii, R = tylko rozszerzony) i dział podstawy
// programowej historii (Dz.U. 2024 poz. 1019, liceum). Daty i fakty sprawdzone
// w pl.wikipedia.org, zpe.gov.pl, dzieje.pl i tekstach Wolnych Lektur (9.10.2026).
// Zdania wiążące fabułę z wydarzeniem to interpretacje — oznaczone w polu `interpretacja`.

export const HISTORIA = {
  "bogurodzica": {
    data: "1410",
    wydarzenie: "Bitwa pod Grunwaldem",
    zdanie: "Według kronikarza Jana Długosza rycerstwo polskie śpiewało Bogurodzicę przed bitwą pod Grunwaldem (15 lipca 1410), w której wojska Władysława Jagiełły pokonały zakon krzyżacki.",
    poziom: "P",
    dzial: "XII",
  },
  "lament-swietokrzyski": {
    data: "1470",
    wydarzenie: "Polska Kazimierza Jagiellończyka",
    zdanie: "Najstarszy odpis Lamentu powstał w 1470 roku w klasztorze na Świętym Krzyżu — za panowania Kazimierza Jagiellończyka, kilka lat po pokoju toruńskim (1466), który zwrócił Polsce Pomorze Gdańskie.",
    poziom: "P",
    dzial: "XII",
    interpretacja: true,
  },
  "treny": {
    data: "1580",
    wydarzenie: "Złoty wiek Rzeczypospolitej",
    zdanie: "Treny ukazały się w Krakowie w 1580 roku, w złotym wieku kultury polskiej: za panowania Stefana Batorego, gdy Rzeczpospolita Obojga Narodów (unia lubelska, 1569) była jednym z największych państw Europy.",
    poziom: "P",
    dzial: "XXI",
  },
  "bajki-krasicki": {
    data: "1773",
    wydarzenie: "Oświecenie i Komisja Edukacji Narodowej",
    zdanie: "Bajki i przypowieści wyszły w 1779 roku, w czasach Stanisława Augusta, gdy Komisja Edukacji Narodowej (1773) — pierwszy w Europie urząd do spraw oświaty — przebudowywała szkoły. Krasicki był biskupem warmińskim, a Warmia po I rozbiorze (1772) znalazła się w granicach Prus.",
    poziom: "P",
    dzial: "XXVIII",
  },
  "sonety-krymskie": {
    data: "1825",
    wydarzenie: "Zesłanie filomatów w głąb Rosji",
    zdanie: "Mickiewicz poznał Krym jako zesłaniec: po procesie filomatów i filaretów (1823–1824) władze rosyjskie wysłały go z Wilna w głąb Rosji. Na Krym pojechał w 1825 roku, a sonety wydał w Moskwie w 1826.",
    poziom: "P",
    dzial: "XXXI",
  },
  "pan-tadeusz": {
    data: "1812",
    wydarzenie: "Wyprawa Napoleona na Moskwę",
    zdanie: "Akcja toczy się na Litwie w latach 1811–1812, w przededniu wyprawy Napoleona na Rosję, z którą Polacy po utworzeniu Księstwa Warszawskiego (1807) wiązali nadzieję na odbudowę państwa. Mickiewicz pisał epopeję na emigracji w Paryżu, po upadku powstania listopadowego.",
    poziom: "P",
    dzial: "XXIX",
  },
  "odprawa-poslow-greckich": {
    data: "1578",
    wydarzenie: "Batory przed wojną o Inflanty",
    zdanie: "Tragedię wystawiono w styczniu 1578 roku w Jazdowie na weselu Jana Zamoyskiego, gdy Stefan Batory szykował wojnę z Moskwą o Inflanty. Spór Trojan o to, czy oddać Helenę, czytano jako przestrogę dla polskiego sejmu.",
    poziom: "P",
    dzial: "XX",
    interpretacja: true,
  },
  "dziady-2": {
    data: "1823",
    wydarzenie: "Wilno filomatów",
    zdanie: "Część II ukazała się w Wilnie w 1823 roku, w ostatnim roku działania tajnych związków filomatów i filaretów. Ludowy obrzęd dziadów, który opisuje, był wtedy wciąż żywy na Litwie i Białorusi.",
    poziom: "P",
    dzial: "XXXI",
  },
  "dziady-3": {
    data: "1830",
    wydarzenie: "Powstanie listopadowe",
    zdanie: "Mickiewicz napisał część III w Dreźnie w 1832 roku, po upadku powstania listopadowego (1830–1831). Akcja cofa się do Wilna 1823 roku — do śledztwa senatora Nowosilcowa przeciw filomatom, w którym poeta sam był więziony.",
    poziom: "P",
    dzial: "XXXI",
  },
  "zemsta": {
    data: "XVIII w.",
    wydarzenie: "Sarmatyzm i obyczaj szlachecki",
    zdanie: "Fredro napisał komedię w 1833 roku w Galicji pod zaborem austriackim. Spór Cześnika z Rejentem o mur graniczny pokazuje obyczaj sarmackiej szlachty z czasów dawnej Rzeczypospolitej.",
    poziom: "R",
    dzial: "XXIII",
    interpretacja: true,
  },
  "wesele": {
    data: "1846 / 1900",
    wydarzenie: "Rabacja galicyjska",
    zdanie: "Dramat wyrósł z prawdziwego wesela w Bronowicach w listopadzie 1900 roku: poeta Lucjan Rydel żenił się z chłopką. Nad weselem wisi pamięć rabacji galicyjskiej (1846), gdy chłopi mordowali szlachtę — jej przywódca Jakub Szela przychodzi w dramacie jako Upiór.",
    poziom: "P",
    dzial: "XXXI",
  },
  "tango": {
    data: "1964",
    wydarzenie: "PRL lat sześćdziesiątych",
    zdanie: "Tango ukazało się w 1964 roku w PRL. Bunt Artura przeciw domowi, w którym wszystko już wolno, czytano jako przypowieść o tym, jak pustkę po zburzonych wartościach wypełnia przemoc.",
    poziom: "P",
    dzial: "LVII",
    interpretacja: true,
  },
  "potop": {
    data: "1655",
    wydarzenie: "Potop szwedzki",
    zdanie: "Akcja toczy się w czasie najazdu szwedzkiego (1655–1660), a jej kulminacją jest obrona Jasnej Góry jesienią 1655 roku. Sienkiewicz pisał Trylogię pod zaborami, „ku pokrzepieniu serc”.",
    poziom: "P",
    dzial: "XXII",
  },
  "nad-niemnem": {
    data: "1863",
    wydarzenie: "Powstanie styczniowe",
    zdanie: "Orzeszkowa wydała powieść w 1888 roku pod zaborem rosyjskim, gdy o powstaniu styczniowym (1863–1864) nie wolno było pisać wprost. Jego pamięć przechowują w powieści mogiła powstańców w lesie i opowieść Anzelma Bohatyrowicza.",
    poziom: "P",
    dzial: "XXXII",
  },
  "lalka": {
    data: "1878",
    wydarzenie: "Warszawa w zaborze rosyjskim",
    zdanie: "Akcja toczy się w Warszawie w latach 1878–1879. Wokulski za udział w powstaniu styczniowym był zesłany na Syberię, a teraz szuka miejsca w mieście, w którym rodzą się przemysł, kolej i nowe mieszczaństwo.",
    poziom: "P",
    dzial: "XXXV",
  },
  "ludzie-bezdomni": {
    data: "ok. 1900",
    wydarzenie: "Industrializacja i nędza robotników",
    zdanie: "Powieść ukazała się w 1899 roku. Doktor Judym ogląda warszawskie suteryny, zagłębie przemysłowe i uzdrowisko — ziemie polskie przełomu wieków, w których rosnące fabryki szły w parze z nędzą robotników.",
    poziom: "P",
    dzial: "XXXV",
  },
  "chlopi-1": {
    data: "1864",
    wydarzenie: "Uwłaszczenie chłopów",
    zdanie: "Lipce to wieś w zaborze rosyjskim kilkadziesiąt lat po uwłaszczeniu (1864): chłopi mają już własną ziemię, ale o las wciąż spierają się z dworem. Reymont dostał za Chłopów Nagrodę Nobla w 1924 roku.",
    poziom: "P",
    dzial: "XXXII",
  },
  "przedwiosnie": {
    data: "1920",
    wydarzenie: "Rewolucja w Rosji i wojna polsko-bolszewicka",
    zdanie: "Cezary Baryka przeżywa w Baku rewolucję i rzeź (1917–1918), a potem przyjeżdża do odrodzonej Polski i walczy w wojnie z bolszewikami (1920). Powieść z 1924 roku pyta, jakie reformy są potrzebne nowemu państwu.",
    poziom: "P",
    dzial: "XLI",
  },
  "ferdydurke": {
    data: "1937",
    wydarzenie: "II Rzeczpospolita lat trzydziestych",
    zdanie: "Powieść ukazała się w 1937 roku. Szkoła, nowoczesny dom pensjonarki i dwór ziemiański to trzy oblicza II Rzeczypospolitej, z których Gombrowicz drwi jako z gotowych „form”.",
    poziom: "P",
    dzial: "XLIII",
    interpretacja: true,
  },
  "katarynka": {
    data: "1880",
    wydarzenie: "Pozytywizm warszawski",
    zdanie: "Nowela z 1880 roku pokazuje Warszawę pozytywistów: hasło pracy u podstaw każe dostrzec biednych i słabszych — tu niewidomą dziewczynkę z sąsiedztwa.",
    poziom: "P",
    dzial: "XXXVI",
    interpretacja: true,
  },
  "latarnik": {
    data: "1830",
    wydarzenie: "Tułacze po powstaniu listopadowym",
    zdanie: "Skawiński dostał krzyż „w roku trzydziestym”, potem bił się w Hiszpanii, we francuskiej Legii Cudzoziemskiej, na Węgrzech i w Ameryce. To los wielu Polaków, którzy po upadku powstania listopadowego zostali na emigracji.",
    poziom: "P",
    dzial: "XXXI",
    interpretacja: true,
  },
  "prosze-panstwa-do-gazu": {
    data: "1943",
    wydarzenie: "Zagłada Żydów",
    zdanie: "Opowiadanie pokazuje przyjęcie transportu z Sosnowca i Będzina na rampie Auschwitz-Birkenau w 1943 roku. Borowski był więźniem Auschwitz od 1943 roku i pisał z własnego doświadczenia.",
    poziom: "P",
    dzial: "XLIX",
  },
  "sklepy-cynamonowe": {
    data: "1934",
    wydarzenie: "II Rzeczpospolita lat trzydziestych",
    zdanie: "Zbiór ukazał się w 1934 roku. Drohobycz Schulza to wielokulturowe miasto II Rzeczypospolitej w dawnej Galicji, przemieniane przez przemysł naftowy i nowoczesny handel.",
    poziom: "P",
    dzial: "XLIV",
  },
  "kamienie-na-szaniec": {
    data: "1943",
    wydarzenie: "Szare Szeregi i akcja pod Arsenałem",
    zdanie: "Książka opowiada o harcerzach Szarych Szeregów; jej kulminacją jest akcja pod Arsenałem (26 marca 1943), w której odbito Jana Bytnara „Rudego”. Kamiński wydał ją w konspiracji jeszcze w 1943 roku.",
    poziom: "P",
    dzial: "L",
  },
  "inny-swiat": {
    data: "1940",
    wydarzenie: "Sowieckie łagry",
    zdanie: "Herling-Grudziński spędził w łagrze w Jercewie lata 1940–1942. Wyszedł dzięki amnestii po układzie Sikorski–Majski (1941) i dołączył do armii Andersa. Książkę wydał na emigracji: po angielsku w 1951, po polsku w 1953 roku.",
    poziom: "P",
    dzial: "XLVIII",
  },
  "zdazyc-przed-panem-bogiem": {
    data: "1943",
    wydarzenie: "Powstanie w getcie warszawskim",
    zdanie: "Marek Edelman, jeden z dowódców powstania w getcie warszawskim (od 19 kwietnia 1943), opowiada o nim Hannie Krall. Książka ukazała się w 1977 roku.",
    poziom: "P",
    dzial: "XLIX",
  },
  "podroze-z-herodotem": {
    data: "1956",
    wydarzenie: "Odwilż 1956",
    zdanie: "Kapuściński wspomina pierwszy wyjazd za granicę — do Indii w 1956 roku, w czasie odwilży, gdy z PRL znów można było wyjechać na Zachód i na Wschód.",
    poziom: "P",
    dzial: "LVI",
    interpretacja: true,
  },
  // --- od 1.0: pięć książek poziomu podstawowego (fakty sprawdzone 9.10.2026) ---
  "balladyna": {
    data: "1839",
    wydarzenie: "Wielka Emigracja po powstaniu listopadowym",
    zdanie: "Słowacki napisał Balladynę w 1834 roku w Genewie, na emigracji po klęsce powstania listopadowego (1830–1831). Drukiem ukazała się w Paryżu w 1839 roku.",
    poziom: "P",
    dzial: "XXXI",
  },
  "quo-vadis": {
    data: "1896",
    wydarzenie: "Polska pod zaborami i Nobel dla Sienkiewicza",
    zdanie: "Powieść drukowano w warszawskiej „Gazecie Polskiej” w latach 1895–1896, w zaborze rosyjskim, a książkowo wydano w Krakowie w 1896 roku. Sienkiewicz dostał w 1905 roku Nagrodę Nobla za całokształt twórczości epickiej. Czytelnicy pod zaborami mogli widzieć w losie prześladowanych chrześcijan obraz własnej sytuacji.",
    poziom: "P",
    dzial: "XXXV",
    interpretacja: true,
  },
  "syzyfowe-prace": {
    data: "po 1864",
    wydarzenie: "Rusyfikacja szkół w Królestwie Polskim",
    zdanie: "Po powstaniu styczniowym (1863–1864) władze rosyjskie rusyfikowały szkoły Królestwa Polskiego. Żeromski chodził do gimnazjum w Kielcach (1874–1886), a w powieści ukrył je pod nazwą Klerykowa.",
    poziom: "P",
    dzial: "XXXV",
  },
  "artysta": {
    data: "1956",
    wydarzenie: "PRL po odwilży",
    zdanie: "Mrożek zdobył popularność w PRL w latach pięćdziesiątych satyrycznymi opowiadaniami i rysunkami; po odwilży 1956 roku satyra mogła mówić śmielej. Opowiadanie o kogucie, który chce występować w cyrku, nie opisuje wydarzeń historycznych — to przypowieść o ambicji większej niż możliwości.",
    poziom: "P",
    dzial: "LVI",
    interpretacja: true,
  },
  "profesor-andrews": {
    data: "13 grudnia 1981",
    wydarzenie: "Stan wojenny",
    zdanie: "Brytyjski profesor przyjeżdża do Warszawy 12 grudnia 1981 roku, w przeddzień wprowadzenia stanu wojennego (13 grudnia), i następnego dnia trafia do miasta z czołgami na ulicach, godziną policyjną i pustymi sklepami.",
    poziom: "P",
    dzial: "LVIII",
  },
};

// Tomy serii dzielą tło z pierwszym tomem.
for (const n of [2, 3, 4]) HISTORIA[`chlopi-${n}`] = HISTORIA["chlopi-1"];

/** Zwraca tło historyczne książki o danym id (patrz js/books.js), albo null. */
export function historiaFor(id) {
  return HISTORIA[id] || null;
}

// ---------------------------------------------------------------------------
// Zadanie „Oś dziejów” — tablica medalionów w galerii. Na poziomie podstawowym
// 8 wydarzeń; każdy medalion przyjmuje jedną z pasujących książek.
// ---------------------------------------------------------------------------

export const OS_DZIEJOW = [
  { id: "grunwald", data: "1410", nazwa: "Grunwald", ksiazki: ["bogurodzica"] },
  { id: "potop", data: "1655", nazwa: "Potop szwedzki", ksiazki: ["potop"] },
  { id: "ken", data: "1773", nazwa: "Komisja Edukacji Narodowej", ksiazki: ["bajki-krasicki"] },
  { id: "napoleon", data: "1812", nazwa: "Wyprawa Napoleona", ksiazki: ["pan-tadeusz"] },
  { id: "listopadowe", data: "1830", nazwa: "Powstanie listopadowe", ksiazki: ["dziady-3", "latarnik"] },
  { id: "styczniowe", data: "1863", nazwa: "Powstanie styczniowe", ksiazki: ["nad-niemnem", "lalka"] },
  { id: "bolszewicka", data: "1920", nazwa: "Wojna z bolszewikami", ksiazki: ["przedwiosnie"] },
  {
    id: "okupacja",
    data: "1939–1945",
    nazwa: "II wojna światowa",
    ksiazki: ["kamienie-na-szaniec", "zdazyc-przed-panem-bogiem", "prosze-panstwa-do-gazu", "inny-swiat"],
  },
];

// Opowieść sali — wędrówka zbiorów Załuskich (karta po skompletowaniu pieczęci).
export const WEDROWKA_ZALUSKICH = [
  { data: "1747", tekst: "Bracia Józef Andrzej i Andrzej Stanisław Załuscy otwierają bibliotekę dla czytelników (8 sierpnia) w Pałacu Daniłowiczowskim w Warszawie." },
  { data: "1774", tekst: "Po śmierci Józefa Andrzeja bibliotekę przejmuje Komisja Edukacji Narodowej — jako Biblioteka Publiczna Rzeczypospolitej." },
  { data: "1794–1795", tekst: "Po upadku insurekcji kościuszkowskiej, na rozkaz Katarzyny II, zbiory zostają wywiezione do Petersburga." },
  { data: "1921", tekst: "Na mocy traktatu ryskiego Rosja sowiecka zwraca część zbiorów; wracają do Warszawy w latach dwudziestych i trzydziestych." },
  { data: "1944", tekst: "Po powstaniu warszawskim Niemcy podpalają odzyskane zbiory. Ocalały tylko nieliczne rękopisy i stare druki." },
];
