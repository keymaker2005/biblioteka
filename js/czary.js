// js/czary.js
// Czary (od 0.5): Wgląd, Przywołanie, Skrzat biblioteczny — zasady z docs/PLAN.md.
// Odblokowanie: kolejny ukończony regał. Paliwo: atrament (state.ink, max 20).
// Stan czarów (czas działania, odpoczynek) żyje tylko w bieżącej sesji — po odświeżeniu
// strony czary są gotowe od nowa, atrament zostaje w zapisie.

import { spellInsight, spellSummon, elfPlaceOne } from "./world.js";
import { BOOKS, GENRE_BY_ID } from "./books.js";

export const SPELLS = {
  wglad: { unlock: 1, cost: 3, duration: 20000, cooldown: 10000, name: "Wgląd" },
  przywolanie: { unlock: 2, cost: 5, duration: 0, cooldown: 5000, name: "Przywołanie" },
  skrzat: { unlock: 3, cost: 8, duration: 30000, cooldown: 60000, interval: 3000, name: "Skrzat biblioteczny" },
};

let api = null; // getWorldApi()
let ui = null; // { buttons, showTip(btn, html), showNote(text, btn) }
const run = {}; // spell -> { activeUntil, coolUntil }
let summonPending = false;
let uiTimer = null;
let elfTimer = null;
let elfEl = null;

function unlockedCount() {
  return api.state.completedShelves.length;
}

function isUnlocked(key) {
  return unlockedCount() >= SPELLS[key].unlock;
}

function now() {
  return performance.now();
}

function spend(cost) {
  api.state.ink = Math.max(0, api.state.ink - cost);
  api.notifyChange();
}

// ---------------------------------------------------------------------------
// Wygląd przycisków
// ---------------------------------------------------------------------------

export function refreshSpellButtons() {
  if (!ui) return;
  const t = now();
  let anyRunning = false;
  for (const btn of ui.buttons) {
    const key = btn.dataset.spell;
    const def = SPELLS[key];
    const r = run[key] || {};
    const unlocked = isUnlocked(key);
    const active = r.activeUntil > t;
    const cooling = !active && r.coolUntil > t;
    const pending = key === "przywolanie" && summonPending;
    btn.classList.toggle("locked", !unlocked);
    btn.classList.toggle("unlocked", unlocked);
    btn.classList.toggle("active", active || pending);
    btn.classList.toggle("cooling", cooling);
    btn.classList.toggle("poor", unlocked && !active && !cooling && api.state.ink < def.cost);
    let p = 0;
    if (active) p = (r.activeUntil - t) / def.duration;
    else if (cooling) p = 1 - (r.coolUntil - t) / def.cooldown;
    btn.style.setProperty("--p", String(Math.max(0, Math.min(1, p))));
    let cost = btn.querySelector(".spell-cost");
    if (!cost) {
      cost = document.createElement("span");
      cost.className = "spell-cost";
      btn.appendChild(cost);
    }
    cost.textContent = String(def.cost);
    if (active || cooling || pending) anyRunning = true;
  }
  clearTimeout(uiTimer);
  if (anyRunning) uiTimer = setTimeout(refreshSpellButtons, 250);
}

// ---------------------------------------------------------------------------
// Rzucanie
// ---------------------------------------------------------------------------

function explain(btn, key) {
  const def = SPELLS[key];
  const r = run[key] || {};
  const t = now();
  if (!isUnlocked(key)) {
    ui.showTip(btn, `<strong>${def.name}</strong><br>Odblokujesz po ukończeniu ${def.unlock}. regału (masz ukończone: ${unlockedCount()}).`);
    return true;
  }
  if (r.activeUntil > t) {
    ui.showTip(btn, `<strong>${def.name}</strong> działa jeszcze ${Math.ceil((r.activeUntil - t) / 1000)} s.`);
    return true;
  }
  if (r.coolUntil > t) {
    ui.showTip(btn, `<strong>${def.name}</strong> odpoczywa jeszcze ${Math.ceil((r.coolUntil - t) / 1000)} s.`);
    return true;
  }
  if (api.state.ink < def.cost) {
    ui.showTip(
      btn,
      `<strong>${def.name}</strong> kosztuje ${def.cost} krople atramentu, masz ${api.state.ink}.<br>Atrament zdobywasz, odkładając książki na regały.`
    );
    return true;
  }
  return false;
}

function finishSpell(key) {
  const def = SPELLS[key];
  run[key] = { activeUntil: 0, coolUntil: now() + def.cooldown };
  refreshSpellButtons();
}

function castInsight() {
  const def = SPELLS.wglad;
  spend(def.cost);
  spellInsight(true);
  run.wglad = { activeUntil: now() + def.duration, coolUntil: 0 };
  ui.showNote("Wgląd: każda książka świeci kolorem swojego regału.");
  setTimeout(() => {
    spellInsight(false);
    finishSpell("wglad");
  }, def.duration);
}

function castSummonStart(btn) {
  summonPending = !summonPending;
  if (summonPending) ui.showNote("Przywołanie: stuknij książkę w sali — jej tomy (albo książki tego autora) zlecą się do koszyka.");
  refreshSpellButtons();
}

/** Wołane z game.js przy stuknięciu książki. Zwraca true, gdy stuknięcie „zużył” czar. */
export function consumeSummonTarget(bookId) {
  if (!summonPending) return false;
  summonPending = false;
  const def = SPELLS.przywolanie;
  const res = spellSummon(bookId);
  if (!res) {
    ui.showNote("W sali nie ma innych książek z tej serii ani tego autora. Atrament nie przepadł.");
  } else if (res.moved === 0) {
    ui.showNote("Koszyk jest pełny — odnieś coś na regały. Atrament nie przepadł.");
  } else {
    spend(def.cost);
    const rest = res.total - res.moved;
    ui.showNote(`Przywołanie: ${res.moved} ${res.moved === 1 ? "książka trafiła" : "książki trafiły"} do koszyka${rest ? ` (${rest} nie zmieściło się)` : ""}.`);
    finishSpell("przywolanie");
  }
  refreshSpellButtons();
  return true;
}

function showElf(res) {
  if (!elfEl) {
    elfEl = document.createElement("div");
    elfEl.className = "skrzat";
    elfEl.innerHTML = `<img src="assets/skrzat.png" alt="" draggable="false">`;
    api.worldLayerEl.appendChild(elfEl);
  }
  const shelf = res.shelf;
  const slot = shelf.slots[res.slot];
  const x = shelf.x + slot.fx * shelf.w;
  const y = shelf.y + slot.fy * shelf.h;
  elfEl.classList.add("visible");
  elfEl.style.transform = `translate(${x - 31}px, ${y - 118}px)`; // stoi na półce przy odłożonej książce
  const camX = api.getCamX();
  if (x < camX || x > camX + api.getVisibleW()) {
    const book = BOOKS.find((b) => b.id === res.bookId);
    ui.showNote(`Skrzat odłożył „${book ? book.title : "książkę"}” na regał „${GENRE_BY_ID[shelf.genre].name}”.`);
  }
}

function castElf() {
  const def = SPELLS.skrzat;
  spend(def.cost);
  run.skrzat = { activeUntil: now() + def.duration, coolUntil: 0 };
  ui.showNote("Skrzat biblioteczny przez 30 sekund sam odkłada książki na regały.");
  const step = () => {
    if (!(run.skrzat && run.skrzat.activeUntil > now())) return endElf();
    const res = elfPlaceOne();
    if (!res) {
      ui.showNote("Skrzat nie znalazł już nic do odłożenia — resztę trzeba odkopać lub przetrzeć.");
      return endElf();
    }
    showElf(res);
    elfTimer = setTimeout(step, def.interval);
  };
  elfTimer = setTimeout(step, 600);
}

function endElf() {
  clearTimeout(elfTimer);
  if (elfEl) elfEl.classList.remove("visible");
  finishSpell("skrzat");
}

function onSpellClick(btn) {
  const key = btn.dataset.spell;
  if (key === "przywolanie" && summonPending) {
    summonPending = false;
    ui.showNote("Przywołanie anulowane.");
    refreshSpellButtons();
    return;
  }
  if (explain(btn, key)) return;
  if (key === "wglad") castInsight();
  else if (key === "przywolanie") castSummonStart(btn);
  else if (key === "skrzat") castElf();
  refreshSpellButtons();
}

export function initCzary(worldApi, uiHooks) {
  api = worldApi;
  ui = uiHooks;
  for (const btn of ui.buttons) btn.addEventListener("click", () => onSpellClick(btn));
  refreshSpellButtons();
}
