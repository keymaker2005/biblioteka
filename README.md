# Biblioteka — Sala Załuskich

Prosta gra przeglądarkowa 2D o porządkowaniu biblioteki: na wózku leżą pomieszane
polskie lektury szkolne, gracz przeciąga je (palcem, Apple Pencil albo myszą) na
właściwy regał odpowiadający epoce literackiej.

To jest **Etap 1 — grywalny szkic**: jedna sala („Sala Załuskich”), 30 książek,
przeciąganie, karta książki, zapis postępu. Grafika to na razie wyłącznie gradienty
CSS (bez obrazków), a czary w pasku górnym są celowo zablokowane — to dopiero
kolejne etapy (patrz `docs/PLAN.md`).

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
