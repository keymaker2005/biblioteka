# Biblioteka — Sala Załuskich

Gra przeglądarkowa 2D o sprzątaniu zabałaganionej biblioteki: sala („Sala
Załuskich”) to przewijany świat 4960×804 px pełen porozrzucanych, zakurzonych
i ukrytych książek. Gracz przesuwa widok palcem, zbiera książki do koszyka albo
niesie je od razu na regał, przeciera kurz i pajęczyny, a książki na regałach
może zdejmować i przestawiać.

**Regały są według GATUNKU** (Poezja, Dramat, Powieść, Nowela i opowiadanie,
Literatura faktu) — to warunek przyjęcia książki. Każdy regał ma inną liczbę
miejsc i chronologiczny zestaw plakietek epok pod spodem: trafienie w slot
z pasującą epoką daje dodatkowy bonus atramentu („Dobra epoka!”), a regał
złożony w pełnej chronologii dostaje złotą gwiazdkę „Ład chronologiczny”.
Epoka nie wpływa na to, czy książka w ogóle trafia na regał — to tylko bonus.
Każda nagroda atramentu wypłaca się tylko raz.

Stan na wersję 1.0: dwa poziomy trudności (podstawowy i zaawansowany, osobne zapisy), gra na telefonie (poziomo), iPadzie i komputerze — palcem, rysikiem i myszką (przybliżanie na telefonie), jedna sala z ilustracjami, 30 lektur na każdym poziomie, 35 tytułów razem (zgodnych z podstawą
programową — obowiązkowych albo uzupełniających) z rozkładówką
„książka w ręku”, koszyk na 6 rzeczy, stosy, 3 kryjówki, czary (Wgląd,
Przywołanie, Skrzat), zadania (prośby czytelników na rewersach, naprawa książek
luźnymi kartkami, pieczęcie Załuskich, porządki, „Oś dziejów”), „Tło historyczne” na karcie każdej książki, pora dnia zgodna z zegarem,
muzyka Chopina i interaktywne otoczenie (lampa, kinkiety, kominek, zegar,
żyrandol, zasłona). Gra działa online: https://keymaker2005.github.io/biblioteka/
— szczegóły w `docs/PLAN.md`, historia wersji w `CHANGELOG.md`.

## Jak uruchomić

Gra to czysty HTML/CSS/JavaScript — nie ma kroku budowania ani żadnych zależności
(`npm install` nie jest potrzebny). Potrzebny jest tylko Node.js do uruchomienia
lokalnego serwera plików (przeglądarka nie wczyta modułów JS bezpośrednio z dysku).

```
node tools/serve.mjs
```

Serwer wystartuje na porcie 5173 (można podać inny numer jako argument, np.
`node tools/serve.mjs 5174`). Otwórz w przeglądarce:

```
http://localhost:5173
```

Najwygodniej testować w Safari na iPadzie w poziomie (docelowa rozdzielczość
logiczna: 1366×1024, iPad Air 13"). Na innym urządzeniu w tej samej sieci Wi-Fi
wystarczy wpisać adres IP komputera zamiast `localhost`.

## Projekt gry

Pełny opis pomysłu, listę 30 lektur, epoki, znaki i plan kolejnych etapów zawiera
[`docs/PLAN.md`](docs/PLAN.md).

Historia wersji: [CHANGELOG.md](CHANGELOG.md).
