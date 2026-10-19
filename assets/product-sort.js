"use strict";
// Copy before sorting; complete ties preserve the reviewed source order.
function sortNaturalProducts(products, mode = 'price') {
  const price = p => Number.isFinite(p.unitPriceUSD) && p.unitPriceUSD >= 0 ? p.unitPriceUSD : Infinity;
  const rank = value => Number.isFinite(value) ? value : -Infinity;
  const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
  return [...products].sort((a, b) => {
    if (mode === 'integrity') {
      const integrity = compare(rank(b.integrityRank), rank(a.integrityRank));
      const natural = compare(rank(b.naturalPercent), rank(a.naturalPercent));
      if (integrity || natural) return integrity || natural;
    }
    return compare(price(a), price(b));
  });
}
