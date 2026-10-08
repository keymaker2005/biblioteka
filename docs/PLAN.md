# Biblioteka — plan gry

Prywatny projekt: gra w porządkowanie biblioteki dla żony Zbigniewa, na iPada Air 13" (M3) z Apple Pencil Pro.
Wzór: *Librarian: Tidy Up the Arcane Library!* (Steam, ArtRising, 2026). Nie robimy kopii, tylko własną grę w polskim klimacie.

## Decyzje (25.09.2026)

| # | Decyzja |
|---|---|
| 1 | **Widok 2D**, projektowany pod dotyk i Pencil. Wersja 3D wraca tylko wtedy, gdy 2D się nie sprawdzi |
| 2 | **Język polski.** Książki to **lektury szkolne polskich autorów** (kanon), na start 30 tytułów, z możliwością rozbudowy |
| 3 | **Klimat polski:** ma być podobnie do oryginału, ale osadzone w Polsce (biblioteka, muzyka, folklor) |
| 4 | **Gra przeglądarkowa** (HTML, CSS, JavaScript) **bez silnika i bez zależności.** To zmiana względem pierwszej propozycji (Phaser): przy przeciąganiu książek zwykła strona daje ostrzejsze polskie litery, natywną obsługę Pencila (także unoszenia rysika nad ekranem) i prostą pracę bez internetu |
| 5 | **Dystrybucja:** link otwierany w Safari → „Dodaj do ekranu początkowego”. Nie korzystamy z App Store, konta Apple Developer ani Maca |
| 6 | Grafika i dźwięk w etapie 4, z pomocą Higgsfield / Adobe for Creativity (zgoda właściciela) |
| 7 | **Rdzeniem jest sprzątanie**, nie sortowanie (etap 1b): przesuwana sala w bałaganie, koszyk, kurz, stosy, kryjówki |
| 8 | **Regały według gatunków**, a epoka jest tylko bonusem. Po opinii graczki, bo epoki były za trudne |
| 9 | **Pora dnia zgodna z zegarem iPada** (wschód/zachód słońca w Warszawie): wieczorem ilustracje zmierzchu i ciepłe światła, nie ciemność. W ustawieniach można wymusić dzień lub wieczór (25.09) |
| 10 | **Muzyka:** nokturny Chopina z Musopen (CC0), przepuszczone przez warstwę lo-fi w kodzie; rytm lo-fi można wyłączyć (25.09) |
| 11 | **„Weź książkę do ręki”:** stuknięcie otwiera rozkładówkę dwóch kartek (o czym jest, cytat, autor, przyjęcie wtedy i dziś, interpretacja, wpływ na Polskę). Treści ze źródeł, cytaty pełne także z utworów chronionych, bo gra jest prywatna (decyzja właściciela, 25.09) |
| 12 | **Interaktywne otoczenie z prostą fizyką:** lampa, kinkiety, kominek, zegar, żyrandol (wahadło), zasłona (sprężyna) (25.09) |
| 13 | **Czary według planu** (Wgląd 3 / Przywołanie 5 / Skrzat 8 kropli; odblokowanie kolejnymi regałami). Przywołanie przenosi książki do koszyka; Skrzat wybiera miejsce z pasującą epoką. Ukończony regał jest matowy, bez ramki (28.09) |
| 14 | **Więcej zadań w sali (wersja 0.6):** prośby czytelników, naprawa książek, pieczęcie Załuskich (ukryte przedmioty), porządki w otoczeniu — wybór właściciela, wszystkie cztery (28.09) |
| 15 | **Książki z regału można zdejmować i przestawiać** (do koszyka, na inne miejsce regału — zamiana miejsc, na rewersy). Każda nagroda atramentu wypłaca się tylko raz, żeby odkładanie w kółko nie „drukowało” atramentu (wersja 0.7, prośba właściciela, 29.09) |
| 16 | **Cienie i światło jako nakładka na ilustrację — odrzucone.** „Ray tracing” w wariancie 2D (cienie od ognia na podłodze) zrobiony w 0.7 i usunięty w 0.7.1 po teście na iPadzie: *„Cienie są warstwami nakładanymi na obraz, nie wygląda to dobrze.”* Wraca tylko z namalowanymi wariantami ilustracji (np. kominek zapalony/zgaszony), nie jako rysunek kodem (29.09) |
| 17 | **Dwa poziomy trudności według podstawy programowej:** podstawowy (szkoła podstawowa kl. VII–VIII + liceum, zakres podstawowy) i zaawansowany (liceum, zakres rozszerzony + lektury uzupełniające). Poziom podstawowy to dzisiejsza gra; decyzja 8 obowiązuje na obu poziomach. Kształt — sekcja „Dwa poziomy trudności” (8.10) |
| 18 | **Książki spoza podstawy programowej wymienione** w tym samym gatunku: *Kamizelka* → *Proszę państwa do gazu* (Borowski), *Cesarz* → *Podróże z Herodotem* (Kapuściński). Nowa książka przejmuje w zapisie miejsce i nagrody starej. Wybór Borowskiego zamiast „Artysty” Mrożka: liceum, zakres podstawowy, i tekst w domenie publicznej, więc cytat sprawdzony w oryginale (wersja 0.8, 8.10) |

## Urządzenie docelowe

- **iPad Air 13" M3**: ekran logiczny 1366 × 1024 (proporcje 4:3). Gramy **poziomo**.
- **Apple Pencil Pro** w przeglądarce (Safari):
  - ✅ precyzyjne wskazywanie i przeciąganie;
  - ✅ **unoszenie rysika nad ekranem (hover)**: gra pokazuje podgląd książki, zanim rysik jej dotknie;
  - ✅ siła nacisku (na razie jej nie używamy);
  - ❌ ściśnięcie rysika, obrót i wibracja **nie są dostępne dla stron internetowych**, tylko dla aplikacji z App Store. Wszystko musi więc dać się zrobić stuknięciem.
- Palec działa zawsze tak samo jak rysik, a pola do stuknięcia są duże.

## Rdzeń gry (od 25.09: sprzątanie, patrz etap 1b)

1. **Sprzątanie jest rdzeniem:** zbierasz rozrzucone książki, przecierasz kurz, zmiatasz pajęczyny, odkrywasz kryjówki i odnosisz kartki.
2. **Regały są według GATUNKÓW** (decyzja 25.09, po opinii graczki: epoki były za trudne, bo trzeba je znać). Gatunek widać od razu na okładce (duża ikona) i na karcie książki.
3. **Epoka jest tylko bonusem:** każde miejsce na półce ma kolorową plakietkę epoki (kolor = kolor oprawy), ułożone chronologicznie. Książka na miejscu swojej epoki daje „✦ Dobra epoka!” i +1 atramentu. Cały regał w dobrych epokach daje gwiazdkę „Ład chronologiczny” i +5 atramentu. Bonus nie wlicza się do procentu porządku sali.
4. Zły gatunek: książka wraca z łagodnym komunikatem. **Nie ma kar.**
5. W miarę porządkowania **sala jaśnieje**, a przy ukończonych regałach zapalają się kinkiety. Postęp **zapisuje się sam**.

### Sala 1: „Sala Załuskich”

Nazwa pochodzi od Biblioteki Załuskich w Warszawie (1747), jednej z pierwszych publicznych bibliotek w Europie.

| Regał (gatunek) | Ikona | Miejsc | Książki (epoka w nawiasie) |
|---|---|---|---|
| **Poezja** | lira | 6 | Bogurodzica · Lament świętokrzyski · Treny · Bajki Krasickiego (dawne) · Sonety krymskie · Pan Tadeusz (romantyzm) |
| **Dramat** | maski | 6 | Odprawa posłów greckich (dawne) · Dziady cz. II · Dziady cz. III · Zemsta (romantyzm) · Wesele (Młoda Polska) · Tango (XX w.) |
| **Powieść** | księga | 10 | Potop · Nad Niemnem · Lalka (pozytywizm) · Ludzie bezdomni · Chłopi t. I–IV (Młoda Polska) · Przedwiośnie · Ferdydurke (XX w.) |
| **Nowela i opowiadanie** | zwój | 4 | Latarnik · Katarynka (pozytywizm) · Sklepy cynamonowe · Proszę państwa do gazu (XX w.) |
| **Literatura faktu** | lupa | 4 | Kamienie na szaniec · Inny świat · Zdążyć przed Panem Bogiem · Podróże z Herodotem (XX w.) |

Epoki i kolory opraw: dawne wieki (bordo), romantyzm (granat), pozytywizm (butelkowa zieleń), Młoda Polska (śliwka), XX wiek (grafit).
Serie, na których działa czar Przywołanie: **Dziady** (2 części), **Chłopi** (4 tomy).
Zmiana listy 25.09: wypadły Kordian, Balladyna i Powrót posła, doszły Sonety krymskie, Sklepy cynamonowe i Cesarz, żeby gatunki miały sensowne liczebności. Zmiana 8.10 (decyzja 18): Kamizelka → Proszę państwa do gazu, Cesarz → Podróże z Herodotem.
⚠ Lista jest robocza. **Sprawdzona z podstawą programową 8.10.2026** — wynik i poprawki w sekcji „Podstawa programowa” niżej. Wcześniejsza notatka („kanon zmienia się od 2026/27, nowa podstawa z 11.03.2026”) była nieścisła: rozporządzenie z 11.03.2026 dotyczy tylko przedszkola i szkoły podstawowej, a liceum dalej czyta według listy z 2024.
Tytuł można podmienić bez zmian w kodzie **tylko w obrębie tego samego gatunku**. Liczbę miejsc na regale i plakietki epok ustawia `js/layout.js`, więc zmiana liczebności gatunku wymaga zmiany układu.

## Etap 1b: sala w bałaganie (decyzja 25.09)

Powód: szkic z etapu 1 był układanką. Książki leżały równo na wózku, więc nie było czego sprzątać. Istotą oryginału jest **sprzątanie zabałaganionej sali**, a samo sortowanie to tylko jeden z jej elementów.

| Element | Działanie |
|---|---|
| **Panorama** | Sala ma 4 części (czytelnia, galeria, kominek, okno ze schodami), razem ok. 3,6 szerokości ekranu, i przesuwa się palcem. Mini-mapa na górze pokazuje, gdzie jesteś. Przy krawędzi ekranu sala sama przewija się pod niesioną książką |
| **Rozrzucone książki** | Leżą na podłodze, stołach, parapecie i schodach, obrócone i czasem otwarte |
| **Stosy** | Książkę spod spodu weźmiesz dopiero po zdjęciu tych z wierzchu |
| **Kryjówki** | Szuflada biurka, fotel, zasłona. Stuknięcie odkrywa to, co ukryte |
| **Kurz** | Zakurzonej książki nie widać i nie da się jej podnieść, dopóki jej nie przetrzesz palcem albo rysikiem |
| **Pajęczyny** | Po jednej na regale. Zmiatasz je tym samym gestem przecierania |
| **Luźne kartki** | Rozsypane po podłodze. Odnosisz je do teczki na biurku |
| **Koszyk** | 6 miejsc na dole ekranu. Rytm gry: zbierz → przesuń salę → odłóż na regał |
| **Świece** | Kinkiet przy regale zapala się, gdy regał jest uporządkowany. Przy 100% zapala się żyrandol |
| **Porządek sali (%)** | Liczy wszystko razem: odłożone książki, kurz, pajęczyny i kartki |
| **Ilustracja** | Tło sali z Higgsfield (barokowa biblioteka w duchu Biblioteki Załuskich). Książki, kurz i kryjówki są w kodzie, na wierzchu ilustracji |

## Czary

**Zasób: Atrament** (kałamarz w rogu ekranu)
- +1 za każdą dobrze odłożoną książkę;
- +5 za ukończony regał;
- pomyłka nic nie odbiera;
- kałamarz mieści najwyżej 20 kropli, więc czarów nie da się „chomikować”.

Kolejny czar **odblokowuje się po ukończeniu kolejnego regału**. W sali są 3 czary, a regałów 5.

| Czar | Odblokowanie | Koszt | Jak rzucić | Czas działania | Na co wpływa |
|---|---|---|---|---|---|
| **Wgląd** | 1. ukończony regał | 3 krople | Stuknij ikonę oka | **20 sekund** | Każda książka w sali i w koszyku dostaje znak swojego regału i świeci jego kolorem. Pomaga rozpoznać trudne tytuły |
| **Przywołanie** | 2. ukończony regał | 5 kropli | Stuknij ikonę, potem jedną książkę | Natychmiast, jednorazowo | Wszystkie tomy tej samej serii (albo książki tego samego autora) zlatują się w jeden stos, który przenosisz jednym ruchem |
| **Skrzat biblioteczny** | 3. ukończony regał | 8 kropli | Stuknij ikonę skrzata | **30 sekund** | Skrzat (z baśni Konopnickiej) co 3 sekundy sam odkłada jedną książkę, czyli około 10 na jedno rzucenie. Przyspiesza końcówkę sali. Odpowiednik „Auto-Shelving” z oryginału |

Czary mają osobne czasy odnowienia (Wgląd 10 s, Skrzat 60 s), żeby nie rzucać ich bez przerwy.
Liczby są startowe i dostroimy je po pierwszych testach żony.

## Polski klimat (etap 4)

- **Wnętrze:** ciemne drewno, parkiet w jodełkę, mosiężne tabliczki na regałach, światło świec i lampy z zielonym kloszem, za oknem polska jesień (deszcz, liście).
- **Ornament:** motywy wycinanki łowickiej na zwieńczeniach regałów, w ramkach i przy ukończonym regale.
- **Muzyka:** Chopin (nokturny, mazurki). Sama muzyka jest w domenie publicznej, ale nagrania już nie zawsze, więc bierzemy tylko wolne nagrania (np. Musopen).
- **Dźwięki:** stuk książki o półkę, skrzypienie podłogi, tykanie zegara, deszcz za oknem.
- **Skrzat:** mała postać z polskiego folkloru, która biega po półkach.

## Podstawa programowa — weryfikacja (8.10.2026)

Źródła: teksty rozporządzeń z Dziennika Ustaw (eli.gov.pl), serwis MEN zpe.gov.pl, Informator CKE. Najważniejsze punkty sprawdzone dwa razy, u źródła.

### Co dziś obowiązuje

| Szkoła | Język polski (lektury) | Historia | Zakresy |
|---|---|---|---|
| **Liceum i technikum**, wszystkie klasy | Lista z 2024 („odchudzona”, Dz.U. 2024 poz. 1019) | Podstawa z 2024, **59 działów (I–LIX)**, ta sama ustawa | **Podstawowy i rozszerzony.** Rozszerzony = wszystko z podstawowego „a ponadto…” |
| **Szkoła podstawowa**, kl. VII–VIII | Stara podstawa (2017, zmiana 2024) — **do 2029/30** | jw. | jeden zakres |
| Szkoła podstawowa, kl. I i IV | **Nowa podstawa „Reforma26. Kompas Jutra”** (rozporządzenie z 11.03.2026, Dz.U. 2026 poz. 378), wchodzi rok po roku | nowa, 50 działów | jeden zakres |
| Liceum od 1.09.2027 (kl. I) | **Nowej listy jeszcze nie ma** — zapowiedź MEN, projektu nie opublikowano | jw. | nie wiadomo, czy podział zostanie |

- Przedmiot „historia i teraźniejszość” (HiT) zlikwidowany; od 2025 jest edukacja obywatelska. Historia zostaje osobnym przedmiotem.
- Matura 2025–2028 przyjmuje lektury z obu list (2018 i 2024), od 2029 tylko z listy 2024.
- **Wniosek dla gry:** dwa poziomy trudności opieramy na liście liceum z 2024 (podstawowy / rozszerzony) plus szkole podstawowej kl. VII–VIII. Gdy MEN opublikuje nową listę dla liceum (najwcześniej 2027), przeglądamy dane jeszcze raz.

### Nasze 27 tytułów (30 książek) a podstawa

| Status w podstawie | Tytuły | Ile |
|---|---|---|
| **Liceum, zakres podstawowy** (obowiązkowe) | Bogurodzica · Lament świętokrzyski (fragm.) · Sonety krymskie (wybrane) · Dziady cz. III · Wesele · Tango · Potop (fragm.) · Lalka · Chłopi (fragm.) · Przedwiośnie · Ferdydurke (fragm.) · Inny świat (fragm.) · Zdążyć przed Panem Bogiem · **Proszę państwa do gazu** · **Podróże z Herodotem** (fragm.) — dwa ostatnie od 8.10 | 15 |
| **Szkoła podstawowa** (obowiązkowe) | Dziady cz. II · Zemsta · Kamienie na szaniec · Latarnik · Pan Tadeusz (księgi I, II, IV, X, XI, XII) · Bajki Krasickiego (kl. IV–VI) · Treny (tylko VII i VIII) | 7 |
| **Tylko zakres rozszerzony** | Sklepy cynamonowe (wybrane opowiadania); Treny **jako cały cykl** | 1 |
| **Tylko lektury uzupełniające** (nauczyciel może wybrać) | Odprawa posłów greckich (wypadła z obowiązkowych w 2024) · Nad Niemnem · Ludzie bezdomni · Katarynka (od 2024) | 4 |
| ~~Spoza podstawy języka polskiego~~ | ~~Kamizelka~~ (nie ma jej w żadnej wersji z 2017–2024) · ~~Cesarz~~ (z Kapuścińskiego w podstawie są „Podróże z Herodotem”) — **wymienione 8.10, decyzja 18** | 0 |

Uwagi: z „Chłopów” obowiązkowe są fragmenty, tomy II–IV nigdy nie były wymagane (w grze zostają jako seria dla czaru Przywołanie). „Zemsta” wypada z obowiązkowych w nowej podstawie szkoły podstawowej (zostaje do 2029/30). „Kamienie na szaniec” zostają także w nowej podstawie.

### Poprawione w treściach gry (karty „książka w ręku”, wersja 0.8)

Pole „Jak czytamy ją dziś” twierdziło, że książka jest lekturą, choć nie była albo była tylko uzupełniająca. Poprawione 8.10:
- **Kamizelka**: „do dziś należy do kanonu lektur szkolnych” — nieprawda; książka wymieniona (decyzja 18);
- **Odprawa posłów greckich**, **Nad Niemnem**, **Katarynka**: „lektura szkolna” → „lektura uzupełniająca”;
- **Pan Tadeusz**, **Treny**: „lektura obowiązkowa” → doprecyzowane (wybrane księgi; treny VII i VIII w szkole podstawowej, cały cykl w zakresie rozszerzonym).

## Dwa poziomy trudności (decyzja 17, 8.10)

Poziom wybiera się na ekranie powitalnym (i w menu). **Poziom podstawowy to dzisiejsza gra** — decyzja 8 (regały według gatunku, epoka jako bonus) zostaje bez zmian na obu poziomach. Zaawansowany utrudnia wiedzę, nie zręczność.

| Element | Poziom podstawowy | Poziom zaawansowany |
|---|---|---|
| **Wzór w podstawie** | szkoła podstawowa kl. VII–VIII + liceum, zakres podstawowy | liceum, zakres rozszerzony + lektury uzupełniające |
| **Książki** | tylko obowiązkowe (od 8.10: 22 z 27 tytułów) | wszystkie z podstawowego plus ok. ⅓ trudniejszych: Kordian, Szewcy, Sklepy cynamonowe, Nad Niemnem, Ludzie bezdomni, Mała apokalipsa, Nie-Boska komedia… |
| **Warunek odłożenia** | gatunek (jak dziś) | gatunek (jak dziś) |
| **Ikona gatunku** | duża na okładce | widoczna dopiero po wzięciu książki do ręki albo przy czarze Wgląd |
| **Bonus epoki** | 5 epok, kolor oprawy podpowiada | epoki według podstawy (średniowiecze, renesans, barok, oświecenie… — 11), kolor oprawy nie podpowiada; bonus +2 zamiast +1 |
| **Tło historyczne na karcie** | jedno zdanie + data (wydarzenia z zakresu podstawowego historii) | do tego wydarzenia z zakresu rozszerzonego (np. Wielka Emigracja, powstanie krakowskie, Bitwa Warszawska) |
| **Prośby czytelników** | po autorze, tytule, gatunku („Poproszę coś Prusa”) | po kontekście („Coś napisanego na emigracji po upadku powstania listopadowego”, „Dramat o pokoleniu po 1830 roku”) |
| **Luźne kartki (cytaty)** | cytat + podpowiedź autora | sam cytat |
| **Oś dziejów** (niżej) | 8 wydarzeń | 14 wydarzeń |

Zapis postępu osobny dla każdego poziomu, żeby zmiana poziomu nie kasowała sali.

**Skutek dla Sali 1 (do rozstrzygnięcia przy budowie wersji 1.0):** na poziomie podstawowym 5 z 30 książek jest spoza zakresu (Odprawa posłów greckich, Nad Niemnem, Ludzie bezdomni, Katarynka — uzupełniające; Sklepy cynamonowe — rozszerzony). Propozycja zamienników obowiązkowych w tym samym gatunku: Odprawa → *Balladyna*, Nad Niemnem → *Quo vadis* (fragm.), Ludzie bezdomni → *Syzyfowe prace* (fragm.), Katarynka → *Artysta* Mrożka, Sklepy cynamonowe → *Profesor Andrews w Warszawie* Tokarczuk. Zamiana zmienia epoki części miejsc, więc plakietki na regałach muszą zależeć od poziomu (dziś są stałe w `js/layout.js`).

## Kontekst historyczny (propozycja do zatwierdzenia)

Podstawa historii wprost wymaga rozpoznawania dorobku kultury każdej epoki (np. XXXI.5 — kultura I poł. XIX w. z romantycznym mesjanizmem; XXXVI.2 — dorobek pozytywizmu i Młodej Polski). **Biblioteka Załuskich jest wprost w podstawie historii** (XXVIII.2, zakres podstawowy: „omawia rolę instytucji oświeceniowych — KEN, Biblioteka Załuskich”) — sala gry jest więc sama w sobie tematem lekcji.

**1. Nowa sekcja na karcie książki: „Tło historyczne”** — zdanie, wydarzenie, data, oznaczenie poziomu.

**2. Nowe zadanie: „Oś dziejów”** — tablica z medalionami wydarzeń na ścianie galerii. Przykładasz książkę do wydarzenia, z którym się wiąże (jak dziś do rewersów): trafienie = +2 krople i odsłonięcie „Tła historycznego”. Pomyłka nic nie odbiera. Wchodzi do listy „Zadania”.

| Lektura | Wydarzenie (data) | Poziom | Dział podstawy historii |
|---|---|---|---|
| Bogurodzica | Grunwald (1410) | P | XII |
| Treny | złoty wiek Rzeczypospolitej (XVI w.) | P | XXI.2 |
| Odprawa posłów greckich | wojna o Inflanty za Batorego (1578) | P | XX.2 (pośrednio) |
| Bajki Krasickiego | oświecenie, KEN (1773) | P | XXVIII.2 |
| Pan Tadeusz | Księstwo Warszawskie, wyprawa Napoleona (1812) | P | XXIX.3 |
| Sonety krymskie | zesłanie Mickiewicza w głąb Rosji (1825) | P | XXXI.5 (pośrednio) |
| Dziady cz. III | proces filomatów (1823), powstanie listopadowe (1830) | P | XXXI.2 |
| Zemsta | obyczaj szlachecki, sarmatyzm | R | XXIII.R3 |
| Potop | potop szwedzki, obrona Jasnej Góry (1655) | P | XXII.1 |
| Nad Niemnem | pamięć powstania styczniowego (1863) | P | XXXII |
| Lalka | Warszawa w zaborze rosyjskim, industrializacja (lata 70. XIX w.) | P | XXXV.2–3 |
| Latarnik, Katarynka | pozytywizm, emigracja po powstaniach | P | XXXVI.1 |
| Chłopi | wieś po uwłaszczeniu (1864) | P | XXXII.4 |
| Ludzie bezdomni | praca organiczna, robotnicy i nędza (ok. 1900) | P | XXXV.3 |
| Wesele | pamięć rabacji galicyjskiej (1846), wesele w Bronowicach (1900) | P | XXXI.4 |
| Przedwiośnie | rewolucja w Rosji (1917), wojna polsko-bolszewicka (1920); na zaawansowanym także Bitwa Warszawska | P / R | XLI.4 / XLI.R4 |
| Ferdydurke, Sklepy cynamonowe | II Rzeczpospolita, kryzys lat 30. | P | XLIII, XLIV |
| Kamienie na szaniec | Szare Szeregi, akcja pod Arsenałem (1943) | P | XLVIII, L |
| Inny świat | sowieckie łagry (1940–42) | P | XLVIII.3 |
| Zdążyć przed Panem Bogiem | powstanie w getcie warszawskim (1943) | P | XLIX.3 |
| Proszę państwa do gazu | Zagłada Żydów, transport z Sosnowca i Będzina do Auschwitz-Birkenau (1943) | P | XLIX |
| Tango | PRL lat 60. | P | LVII.1 |
| Podróże z Herodotem | odwilż 1956 — pierwsze wyjazdy reportera za granicę | P | LVI.4 |

P = wydarzenie z zakresu podstawowego historii, R = tylko rozszerzony. Na poziomie zaawansowanym oś dostaje dodatkowe medaliony z zakresu rozszerzonego: Wielka Emigracja (XXXI.R1), powstanie krakowskie 1846 (XXXI.R2), sarmatyzm (XXIII.R3), Bitwa Warszawska 1920 (XLI.R4), rola kultury w czasie rusyfikacji i germanizacji (XXXVI.R3). Zdania wiążące fabułę z wydarzeniem (Zemsta, Latarnik, Ludzie bezdomni, Podróże z Herodotem) to interpretacje — do sprawdzenia przy pisaniu treści, jak każda karta wiedzy.

**3. Opowieść sali: wędrówka zbiorów Załuskich** — karta po skompletowaniu pieczęci rozwija się w oś: otwarcie biblioteki (1747) → własność Rzeczypospolitej pod opieką KEN → wywiezienie do Petersburga po III rozbiorze (1795) → zwrot części zbiorów po traktacie ryskim (1921) → spalenie przez Niemców po powstaniu warszawskim (1944). Każda data to dział podstawy historii (XXVIII, XXVII, XLI, L). ⚠ Daty do sprawdzenia przed wpisaniem do gry.

## Kolejne sale (propozycja do etapu 2)

Każda sala to prawdziwa polska biblioteka z jednej epoki. Regały dalej według gatunków (decyzja 8); w miejsce plakietek epok wchodzą **plakietki wydarzeń** tej epoki — ten sam mechanizm bonusu, który już działa, tylko z historią zamiast epok.

| Sala | Biblioteka | Epoki | Przykładowe lektury (P / R) |
|---|---|---|---|
| 1 | **Załuskich**, Warszawa 1747 (jest) | przekrój wszystkich epok — sala wprowadzająca | dzisiejsze 30 książek |
| 2 | **Jagiellońska**, Kraków (Collegium Maius) | średniowiecze, renesans, barok, oświecenie | P: Bogurodzica, Kochanowski (pieśni, fraszki, treny), Krasicki (Hymn do miłości ojczyzny, satyra). R: Treny jako cykl, Rozmowa Mistrza Polikarpa |
| 3 | **Polska w Paryżu**, 1838 (Wielka Emigracja) | romantyzm | P: Dziady, ballady, Oda do młodości, Reduta Ordona, Balladyna, Testament mój. R: Kordian, Nie-Boska komedia, Fortepian Szopena |
| 4 | **Ossolineum**, Lwów 1817 (zabory) | pozytywizm, Młoda Polska | P: Lalka, Potop, Quo vadis, Latarnik, Wesele, Chłopi, Syzyfowe prace. R: Nad Niemnem, Ludzie bezdomni, Moralność pani Dulskiej |
| 5 | **Narodowa**, Warszawa 1928 | dwudziestolecie, wojna, PRL, współczesność | P: Przedwiośnie, Ferdydurke, Kamienie na szaniec, Proszę państwa do gazu, Tango, Podróże z Herodotem. R: Szewcy, Sklepy cynamonowe, Mała apokalipsa, Antygona w Nowym Jorku |

Tylko polscy autorzy (decyzja 2). Dokładna lista tytułów na każdy regał powstanie przy budowie danej sali.

## Do decyzji właściciela

Rozstrzygnięte 8.10: dwa poziomy — tak (decyzja 17); Kamizelka i Cesarz — wymienione (decyzja 18, wersja 0.8).

Otwarte:
1. **Kolejność dalszych prac:** 0.9 „Tło historyczne”, potem 1.0 dwa poziomy, potem nowe sale — czy inaczej?
2. **Zamienniki na poziomie podstawowym** (5 książek spoza zakresu, sekcja „Dwa poziomy trudności”) — przyjąć zaproponowane tytuły czy inne?

## Etapy

| Etap | Zakres | Status |
|---|---|---|
| 0. Decyzje | Widok, język, książki, folder | ✅ 25.09 |
| 1. Szkic | Jedna sala, 30 książek, przeciąganie palcem i Pencilem, karta książki, podgląd przy unoszeniu rysika, zapis. Grafika tylko z CSS, bez obrazków. Czary widoczne jako zablokowane ikony | ✅ 25.09, czeka na test na iPadzie |
| 1b. Sala w bałaganie | Przesuwana sala (4 części, ilustracje z Higgsfield), koszyk, kurz, pajęczyny, stosy, kryjówki, kartki, kinkiety i żyrandol, regały według gatunków z bonusem epoki | ✅ 25.09, czeka na test na iPadzie |
| Fale 1–2 (po testach) | Naprawy (koszyk, przewijanie), jasna sala z połyskiem, większe napisy, widoczne kryjówki i podpowiedzi, ekran powitalny, menu, „Jak grać”, nowy dolny pasek | ✅ 25.09 |
| Fala 3: klimat | Pora dnia, muzyka Chopin + lo-fi, liście za oknami z odbiciem w parkiecie, kurz w smudze światła, lampa, kinkiety, kominek, zegar, żyrandol, zasłona | ✅ 28.09, testowane na iPadzie 29.09 (poprawki w 0.6.2 i 0.7.1) |
| Fala 4: książka w ręku | Rozkładówka z wiedzą o 30 lekturach (js/wiedza-1.js, wiedza-2.js) | ✅ 28.09, czeka na test na iPadzie |
| 0.5 | Czary, fizyka żyrandola i zasłony, poprawki po testach | ✅ 28.09 |
| 0.6: więcej zadań | Prośby czytelników, naprawa książek (kartki = fragmenty), pieczęcie Załuskich, porządki, lista „Zadania” | ✅ 28.09, testowane na iPadzie 29.09 |
| 0.6.2–0.7.1: po testach | Koszyk bez „duchów”, kominek na iPadzie, rewers i naprawa książki na regale, zdejmowanie i przestawianie książek z regału (nagrody raz), liście w odbiciu, długie tytuły na okładkach; cienie od ognia zrobione i zdjęte (decyzja 16) | ✅ 29.09, online |
| 0.8: zgodność z podstawą | Kamizelka → Proszę państwa do gazu, Cesarz → Podróże z Herodotem (zapis przenosi się sam), poprawione zdania o statusie lektur na kartach, regał nowel z dwiema plakietkami XX wieku | ✅ 8.10, lokalnie (pod link po „wyślij”) |
| 0.9: tło historyczne *(propozycja)* | Sekcja „Tło historyczne” na karcie, zadanie „Oś dziejów”, opowieść o zbiorach Załuskich | – |
| 1.0: dwa poziomy (decyzja 17) | Wybór poziomu na ekranie powitalnym, osobne zapisy, pula książek, prośby i kartki według poziomu, plakietki zależne od poziomu, dopisek o statusie lektury na karcie (np. „Liceum, zakres podstawowy, fragmenty”) | – |
| 2. Rdzeń gry | Kolejne sale według epok i prawdziwych bibliotek (sekcja „Kolejne sale”), plakietki wydarzeń zamiast epok | – |
| 3. Czary | Atrament, Wgląd, Przywołanie, Skrzat, odnowienia | ✅ 28.09 (wersja 0.5) |
| 4. Oprawa | Grafika, muzyka i animacje zrobione w falach 1b–3; zostaje dopracowanie (skrzat, więcej animacji) | częściowo |
| 5. iPad | Ikona na ekranie początkowym, działanie bez internetu, kopia zapisu, test na iPadzie żony | – |

## Udostępnienie

- **Testy w trakcie prac:** prywatna strona (Artifact) na koncie claude.ai Zbigniewa, otwierana na iPadzie po zalogowaniu.
- **Wersja dla żony:** GitHub Pages pod stałym linkiem https://keymaker2005.github.io/biblioteka/ (działa od wersji 0.6). Żona otwiera link w Safari i wybiera Udostępnij → „Dodaj do ekranu początkowego”. **Każda wysyłka nowej wersji pod link wymaga zgody Zbigniewa** („wyślij”).
- **Zapis postępu** leży na iPadzie. Dzięki dodaniu gry do ekranu początkowego Safari go nie kasuje, a w etapie 5 dojdzie przycisk kopii zapisu.
