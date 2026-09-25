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

## Urządzenie docelowe

- **iPad Air 13" M3**: ekran logiczny 1366 × 1024 (proporcje 4:3). Gramy **poziomo**.
- **Apple Pencil Pro** w przeglądarce (Safari):
  - ✅ precyzyjne wskazywanie i przeciąganie;
  - ✅ **unoszenie rysika nad ekranem (hover)**: gra pokazuje podgląd książki, zanim rysik jej dotknie;
  - ✅ siła nacisku (na razie jej nie używamy);
  - ❌ ściśnięcie rysika, obrót i wibracja **nie są dostępne dla stron internetowych**, tylko dla aplikacji z App Store. Wszystko musi więc dać się zrobić stuknięciem.
- Palec działa zawsze tak samo jak rysik, a pola do stuknięcia są duże.

## Rdzeń gry

1. Na **wózku** leżą pomieszane książki.
2. **Stuknięcie** otwiera kartę książki: tytuł, autor, rok, znak epoki, krótka podpowiedź, numer tomu serii.
3. **Przeciągnięcie** książki na regał:
   - dobry regał: książka wskakuje na miejsce, rozlega się stuk i przybywa atramentu;
   - zły regał: książka wraca na wózek z łagodnym komunikatem. **Nie ma kar**, bo to gra relaksacyjna.
4. Regały odpowiadają **epokom literackim**. Wskazówką jest kolor oprawy i znak epoki na okładce, więc nie trzeba znać historii literatury.
5. W miarę porządkowania **sala jaśnieje**. Ukończony regał rozświetla się złotem.
6. Postęp **zapisuje się sam**.

### Sala 1: „Sala Załuskich”

Nazwa pochodzi od Biblioteki Załuskich w Warszawie (1747), jednej z pierwszych publicznych bibliotek w Europie.

| Regał (epoka) | Znak | Książki |
|---|---|---|
| **Dawne wieki** (średniowiecze – oświecenie) | ❦ | Bogurodzica · Lament świętokrzyski · Treny (Kochanowski) · Odprawa posłów greckich (Kochanowski) · Bajki (Krasicki) · Powrót posła (Niemcewicz) |
| **Romantyzm** | ☾ | Pan Tadeusz · Dziady cz. II · Dziady cz. III (Mickiewicz) · Kordian · Balladyna (Słowacki) · Zemsta (Fredro) |
| **Pozytywizm** | ⚙ | Lalka · Kamizelka · Katarynka (Prus) · Nad Niemnem (Orzeszkowa) · Potop · Latarnik (Sienkiewicz) |
| **Młoda Polska** | ✿ | Wesele (Wyspiański) · Chłopi t. I Jesień · t. II Zima · t. III Wiosna · t. IV Lato (Reymont) · Ludzie bezdomni (Żeromski) |
| **XX wiek** | ◆ | Przedwiośnie (Żeromski) · Ferdydurke (Gombrowicz) · Kamienie na szaniec (Kamiński) · Inny świat (Herling-Grudziński) · Zdążyć przed Panem Bogiem (Krall) · Tango (Mrożek) |

Serie, na których działa czar Przywołanie: **Dziady** (2 części), **Chłopi** (4 tomy).
⚠ Lista jest robocza. Kanon zmienia się od roku szkolnego 2026/27 (nowa podstawa programowa z 11.03.2026), więc tytuły można podmienić bez zmian w kodzie.

## Czary

**Zasób: Atrament** (kałamarz w rogu ekranu)
- +1 za każdą dobrze odłożoną książkę;
- +5 za ukończony regał;
- pomyłka nic nie odbiera;
- kałamarz mieści najwyżej 20 kropli, więc czarów nie da się „chomikować”.

Kolejny czar **odblokowuje się po ukończeniu kolejnego regału**. W sali są 3 czary, a regałów 5.

| Czar | Odblokowanie | Koszt | Jak rzucić | Czas działania | Na co wpływa |
|---|---|---|---|---|---|
| **Wgląd** | 1. ukończony regał | 3 krople | Stuknij ikonę oka | **20 sekund** | Każda książka na wózku dostaje znak swojego regału i świeci jego kolorem. Pomaga rozpoznać trudne tytuły |
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

## Etapy

| Etap | Zakres | Status |
|---|---|---|
| 0. Decyzje | Widok, język, książki, folder | ✅ 25.09 |
| 1. Szkic | Jedna sala, 30 książek, przeciąganie palcem i Pencilem, karta książki, podgląd przy unoszeniu rysika, zapis. Grafika tylko z CSS, bez obrazków. Czary widoczne jako zablokowane ikony | ✅ 25.09, czeka na test na iPadzie |
| 2. Rdzeń gry | Generator książek z pliku danych, więcej lektur, kolejne sale, menu | – |
| 3. Czary | Atrament, Wgląd, Przywołanie, Skrzat, odnowienia | – |
| 4. Oprawa | Grafika (Higgsfield / Adobe), muzyka, dźwięki, animacje, polski klimat | – |
| 5. iPad | Ikona na ekranie początkowym, działanie bez internetu, kopia zapisu, test na iPadzie żony | – |

## Udostępnienie

- **Testy w trakcie prac:** prywatna strona (Artifact) na koncie claude.ai Zbigniewa, otwierana na iPadzie po zalogowaniu.
- **Wersja dla żony:** darmowy hosting (GitHub Pages albo Cloudflare Pages) pod stałym linkiem. Żona otwiera link w Safari i wybiera Udostępnij → „Dodaj do ekranu początkowego”. **Publikacja wymaga osobnej zgody Zbigniewa.**
- **Zapis postępu** leży na iPadzie. Dzięki dodaniu gry do ekranu początkowego Safari go nie kasuje, a w etapie 5 dojdzie przycisk kopii zapisu.
