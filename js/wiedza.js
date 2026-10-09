// js/wiedza.js
// Fala 4 — moduł "Weź książkę do ręki": łączy fakty i cytaty z js/wiedza-1.js
// (książki 1–15 z js/books.js), js/wiedza-2.js (książki 16–30) i js/wiedza-3.js
// (5 książek dodanych w wersji 1.0) w jeden słownik po id książki. Ten plik tylko
// scala dane — treści leżą w plikach źródłowych, których (zgodnie z poleceniem) nie ruszamy.

import { WIEDZA_1 } from "./wiedza-1.js";
import { WIEDZA_2 } from "./wiedza-2.js";
import { WIEDZA_3 } from "./wiedza-3.js";

export const WIEDZA = { ...WIEDZA_1, ...WIEDZA_2, ...WIEDZA_3 };

/** Zwraca komplet wiedzy o książce o danym id (patrz js/books.js), albo null, gdy jej brak. */
export function wiedzaFor(id) {
  return WIEDZA[id] || null;
}
