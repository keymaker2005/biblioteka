# Dziennik zmian — Biblioteka (Sala Załuskich)

Jak gra zmieniała się wersja po wersji. Najnowsze na górze.
Każda wersja = jeden zapis w historii projektu (commit) wysłany pod link gry: https://keymaker2005.github.io/biblioteka/
Szczegóły decyzji: [docs/PLAN.md](docs/PLAN.md).

---

## 0.7 — Cienie od ognia, książki z regału można zdejmować i przestawiać (29.09.2026)

**Nowe**
- **Cienie od ognia w kominku.** Gdy ogień się pali, pada od niego ciepła plama światła na podłogę i dywan, a nogi biurka i leżące książki rzucają na nią cienie — od kominka w stronę widza, tym dłuższe, im dalej od ognia. Cienie drgają razem z płomieniem, wieczorem są wyraźniejsze, po zgaszeniu ognia gasną. Cienia żyrandola nie ma celowo: ogień jest niżej niż żyrandol, więc jego cień padałby w sufit, poza kadr.
- **Książkę z regału można zdjąć i przestawić.** Chwyć grzbiet i: przeciągnij do koszyka (zdjęcie), na inne miejsce tego samego regału (przestawienie — na wolne miejsce albo zamiana z książką, która tam stoi) albo na rewersy. Na karcie książki stojącej na regale jest przycisk „Zdejmij do koszyka”.
- **Atrament bez „dorabiania”.** Nagrody (za odłożenie książki, dobrą epokę, uporządkowany regał i ład chronologiczny) wypłacają się tylko za pierwszym razem. Ład chronologiczny można teraz zdobyć także przestawiając książki na pełnym regale. Zapisy sprzed tej wersji: wszystko, co już stało na regałach, liczy się jako opłacone.

## 0.6.2 — Książki z regału na rewersy i do naprawy, koszyk bez „duchów”, kominek na iPadzie (28.09.2026)

**Naprawione (po teście 0.6.1)**
- **Koszyk pokazywał więcej rzeczy, niż w nim było, i blokował dokładanie.** Przyczyna: książka przesunięta w obrębie koszyka (albo wyjęta i odłożona z powrotem do koszyka) zajmowała drugie miejsce, a stare zostawało puste, ale „zajęte”. Po wczytaniu gry duch znikał, dlatego usterka pojawiała się „czasem”. Teraz książka przesunięta w koszyku zostaje na swoim miejscu, a koszyk pilnuje zasady „jedna rzecz = jedno miejsce”.
- **Książkę odłożoną na regał można podać na rewersy.** Chwyć grzbiet i zanieś na rewersy na biurku; po obsłużeniu prośby książka wraca na swoje miejsce na półce. Upuszczona gdzie indziej też wraca na półkę (z podpowiedzią) — z regału nie da się jej przełożyć do koszyka ani na inny regał.
- **Kominek przestawał reagować na iPadzie.** Przy zapalaniu gra najpierw odtwarzała dźwięk, a dopiero potem pokazywała ogień. Gdy dźwięk na iPadzie zawiódł (np. po uśpieniu ekranu), ogień się nie pojawiał, choć gra i tak zapisywała, że się pali. Teraz ogień zapala się najpierw, a żaden dźwięk w otoczeniu (kominek, zegar, trzask drewna) nie może już zatrzymać gry.
- **Książkę na regale da się naprawić.** Grzbiet ma ok. 30 px szerokości, więc kartkę trzeba było trafić co do piksela. Teraz liczy się też książka tuż obok miejsca upuszczenia, a gdy w zasięgu jest ta właściwa, wygrywa ona.

## 0.6.1 — Płynna zasłona, światło lampki na swoim miejscu (28.09.2026)

**Naprawione (po teście 0.5/0.6)**
- **Zasłona klatkowała w ruchu.** Dwie przyczyny: animacja fizyki liczona tylko 30 razy na sekundę oraz cień zasłony jako filtr, który Safari przeliczał przy każdej klatce. Teraz fizyka liczy się w każdej klatce ekranu (60/120 Hz), a cień rysuje się razem z materiałem.
- **Światło lampki nie pasowało do klosza.** Wymierzone na powiększeniu i narysowane od nowa: miękki stożek zaczyna się dokładnie przy dolnej krawędzi zielonego klosza, pod kloszem świeci żarówka, na blacie leży plama światła; zniknęła prostokątna krawędź poświaty.
- Muzyka — potwierdzone przez właściciela, że po 0.5 już się nie zacina.

## 0.6 — Więcej zadań w sali (28.09.2026)

**Nowe**
- **Prośby czytelników:** na biurku przy kominku leżą rewersy (czerwone „!” = ktoś czeka). Stuknij je, przeczytaj prośbę („Poproszę coś Prusa”, „Szukam powieści o kupcu zakochanym w arystokratce”…) i połóż właściwą książkę na rewersach. Czytelnik ją przejrzy i odda do koszyka. 6 próśb, każda za 3 krople atramentu.
- **Naprawa książek:** 6 książek ma wyrwaną kartkę (naderwany róg i znaczek 📄). Luźne kartki z podłogi to ich fragmenty — stuknij kartkę, przeczytaj cytat i przeciągnij ją na książkę, z której pochodzi. Kartkę można nieść w koszyku.
- **Pieczęcie Załuskich:** w sali ukryto 6 lakowych pieczęci z herbem Junosza (baranem) — przy lustrze, w kominku, na ramie obrazu, na schodach, na parapecie, przy dywanie. Komplet odsłania kartę z historią Biblioteki Załuskich.
- **Porządki w otoczeniu:** przetrzyj zakurzone lustro, szybę obrazu i oba okna, zamieć trzy kupki liści nawianych przez okno.
- **Lista „Zadania”** (przycisk u góry): wszystkie rodzaje zadań z postępem w jednym miejscu.
- Nowe zadania liczą się do porządku sali; „Jak grać” ma karty o rewersach, kartkach, pieczęciach i porządkach.

**Zmienione**
- Teczka na biurku stała się tacką na rewersy; kartek nie odkłada się już do teczki, tylko do ich książek.

## 0.5 — Działające czary i prawdziwa fizyka (28.09.2026)

**Nowe**
- **Czary działają.** Każdy ukończony regał odblokowuje kolejny; płaci się atramentem (koszt w kropelce przy przycisku):
  - **Wgląd** (3 krople, 20 s) — każda książka i regał świecą kolorem gatunku;
  - **Przywołanie** (5 kropli) — stuknij książkę, a jej tomy albo książki tego samego autora zlecą się do koszyka (kurz znika sam);
  - **Skrzat biblioteczny** (8 kropli, 30 s) — mały skrzat co 3 s sam odkłada książkę na regał, i to na miejsce z pasującą epoką.
  Przycisk pokazuje, czy czar jest gotowy, działa (złoty pierścień odlicza) albo odpoczywa.
- **Kartki można wkładać do koszyka** i z niego zanieść do teczki.
- **Żyrandol da się chwycić** — idzie za palcem, po puszczeniu buja się dalej i wygasa; płomienie świec odchylają się od ruchu, kryształki dzwonią.
- **Zasłona zachowuje się jak materiał** — góra zostaje przy karniszu, dół idzie za palcem, po puszczeniu fala przelewa się przez tkaninę i uspokaja; fałdy ciemnieją tam, gdzie materiał się gnie.
- Nowa karta w „Jak grać” o czarach.

**Naprawione / zmienione**
- Muzyka się przycinała — usunięte „falowanie tempa”, które w Safari na iPadzie powodowało zacięcia.
- Ukończony regał nie świeci już ramką — staje się matowym meblem sali (krótki błysk w chwili ukończenia, na tabliczce ✓).
- Podświetlenie regału przy upuszczaniu obrysowuje jego kształt zamiast prostokąta.
- Usunięte plakietki z pajęczyn (wyglądały jak nie na swoim miejscu).

## 0.4 — Klimat i „książka w ręku” (28.09.2026)

**Nowe**
- **Weź książkę do ręki:** stuknięcie w książkę otwiera rozkładówkę dwóch kartek — o czym jest, najsłynniejszy cytat, fakt o autorze, przyjęcie w dniu premiery i dziś, najważniejsza interpretacja, wpływ na Polskę, źródła. Treści dla wszystkich 30 lektur, sprawdzone w źródłach (cytaty z domeny publicznej zweryfikowane w pełnych tekstach Wolnych Lektur).
- **Pora dnia jak za oknem:** gra patrzy na zegar iPada i godziny zachodu słońca w Warszawie. Wieczorem sala ma zmierzch za oknami i ciepłe światła. W Ustawieniach można wymusić dzień lub wieczór.
- **Muzyka:** nokturny Chopina (op. 9 nr 1 i 2, op. 72 nr 1; Musopen, domena publiczna) z warstwą lo-fi — ciepłe brzmienie, szum taśmy, trzaski winylu, opcjonalny cichy rytm („Rytm lo-fi” w Ustawieniach). Cichnie przy otwartych oknach, pauzuje w tle.
- **Żywe okna:** spadające liście za szybami, ich odbicie w parkiecie, drobinki kurzu w smudze słońca.
- **Interaktywne otoczenie z prostą fizyką:** lampa z zielonym kloszem, kinkiety, kominek z ogniem i trzaskiem drewna, zegar wybijający godzinę, żyrandol kołyszący się jak wahadło (z dzwonieniem kryształków), zasłona odsuwana palcem (odsłania kryjówkę).
- Ekran „O grze” w Ustawieniach (źródła muzyki i ilustracji).

**Grafika:** wieczorne wersje wszystkich 4 części sali, żyrandol i zasłona jako osobne, ruchome elementy (Higgsfield).

## 0.3 — Naprawy po pierwszych testach i nowy interfejs (25.09.2026)

**Naprawione**
- Koszyk: książki trafiały do niego, ale rysowały się poza ekranem — teraz są widoczne i da się je wyjąć.
- Przewijanie sali z niesioną książką było bardzo wolne — teraz przyspiesza przy krawędzi.
- Sala była za ciemna — teraz jasna od startu, a postęp daje połysk (lśniący parkiet, błyski na złoceniach).
- Styki między częściami sali (jak „zgięcie” w składanym telefonie) zasłonięte rzeźbionymi pilastrami.
- Za małe napisy — większe okładki i dymki, ustawienie „Rozmiar napisów” (normalny / duży / bardzo duży).
- Niewidoczne miejsca interaktywne — kryjówki mają złotą ramkę z lupą, pajęczyny miotełkę, kartki lśnią; podpowiedzi przy pierwszym spotkaniu.
- Plakietki epok i wszystkie wskaźniki mają opisy; dymki mieszczą się na ekranie.

**Nowe**
- Ekran powitalny (Kontynuuj, Nowa gra, Jak grać, Ustawienia), menu w grze, „Jak grać” w 6 kartach.
- Nowy dolny pasek: wiklinowy koszyk na środku, trzy czary w kółkach, kałamarz i okrągły wskaźnik porządku.

## 0.2 — Sala w bałaganie (25.09.2026)

- Rdzeniem gry zostało **sprzątanie**, nie sortowanie: przesuwana sala z 4 części (ilustracje barokowej biblioteki z wycinanką łowicką), książki rozrzucone po podłodze, stołach, parapetach i schodach.
- Stosy (zdejmowane od góry), kryjówki (szuflada, fotel, zasłona), kurz i pajęczyny do przetarcia, luźne kartki do teczki, koszyk na 6 książek.
- **Regały według gatunków** (poezja, dramat, powieść, nowela, literatura faktu) zamiast epok — po opinii graczki; epoka została bonusem.
- Kinkiety zapalane ukończonymi regałami, żyrandol przy 100% porządku.

## 0.1 — Pierwszy szkic (25.09.2026)

- Jedna sala, 30 polskich lektur, 5 regałów-epok, przeciąganie palcem i Apple Pencil, karta książki, podgląd po uniesieniu rysika, zapis postępu.
- Gra przeglądarkowa bez instalacji, udostępniona przez GitHub Pages.
