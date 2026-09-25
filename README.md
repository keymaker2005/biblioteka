# Biblioteka — Sala Załuskich

Gra przeglądarkowa 2D o sprzątaniu zabałaganionej biblioteki: sala („Sala
Załuskich”) to przewijany świat 3720×804 px pełen porozrzucanych, zakurzonych
i ukrytych książek. Gracz przesuwa widok palcem, zbiera książki do koszyka albo
niesie je od razu na regał, odpowiada za sprzątanie kurzu i pajęczyn (gestem
przecierania) oraz odnoszenie luźnych kartek do teczki.

**Regały są według GATUNKU** (Poezja, Dramat, Powieść, Nowela i opowiadanie,
Literatura faktu) — to warunek przyjęcia książki. Każdy regał ma inną liczbę
miejsc i chronologiczny zestaw plakietek epok pod spodem: trafienie w slot
z pasującą epoką daje dodatkowy bonus atramentu („Dobra epoka!”), a regał
złożony w pełnej chronologii dostaje złotą gwiazdkę „Ład chronologiczny”.
Epoka nie wpływa na to, czy książka w ogóle trafia na regał — to tylko bonus.

To jest **Etap 1b — sala w bałaganie**: jedna sala, 30 książek, panorama
z mini-mapą, koszyk na 6 książek, stosy (widoczna tylko górna książka), 3
kryjówki (szuflada, fotel, zasłona), kurz i pajęczyny do przetarcia, luźne
kartki do teczki, świece zapalające się przy ukończonym regale i żyrandol przy
100% porządku. Grafika sali to na razie CSS (patrz `assets/README.md` — realne
ilustracje podmienią ją automatycznie, gdy się pojawią), a czary w pasku górnym
są celowo zablokowane — to dopiero kolejne etapy (patrz `docs/PLAN.md`).

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
