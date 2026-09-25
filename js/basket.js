// js/basket.js
// Koszyk na dole ekranu: 6 miejsc na okładki. Koszyk żyje w stałych współrzędnych
// SCENY (nie przewija się razem ze światem), więc geometrię liczymy tak samo jak
// resztę stałego UI — przez wstrzykniętą funkcję getLogicalRect (patrz js/game.js).
// Ten moduł nie wie nic o książkach — tylko trzyma, które z 6 miejsc są zajęte,
// i podaje ich środki w logicznych współrzędnych sceny.

const SLOT_PAD_X = 70;

export function createBasket(cartEl, counterEl, getLogicalRect, slotsCount = 6) {
  const slots = new Array(slotsCount).fill(null);

  function rect() {
    return getLogicalRect(cartEl);
  }

  function slotCenter(index) {
    const r = rect();
    const usableW = Math.max(1, r.width - SLOT_PAD_X * 2);
    const cx =
      r.x + SLOT_PAD_X + (slotsCount > 1 ? (usableW * index) / (slotsCount - 1) : usableW / 2);
    const cy = r.y + r.height / 2;
    return { cx, cy };
  }

  function findFreeSlot() {
    return slots.findIndex((s) => s === null);
  }

  function isFull() {
    return findFreeSlot() === -1;
  }

  function count() {
    return slots.reduce((n, s) => n + (s ? 1 : 0), 0);
  }

  function assign(index, bookId) {
    slots[index] = bookId;
    updateCounter();
  }

  function clear(index) {
    if (index >= 0 && index < slots.length) slots[index] = null;
    updateCounter();
  }

  function clearAll() {
    slots.fill(null);
    updateCounter();
  }

  function bookAt(index) {
    return slots[index] ?? null;
  }

  function slotOf(bookId) {
    return slots.indexOf(bookId);
  }

  function updateCounter() {
    if (counterEl) counterEl.textContent = `${count()} / ${slots.length}`;
  }

  updateCounter();

  return {
    rect,
    slotCenter,
    findFreeSlot,
    isFull,
    count,
    assign,
    clear,
    clearAll,
    bookAt,
    slotOf,
    updateCounter,
    slotsCount,
  };
}
