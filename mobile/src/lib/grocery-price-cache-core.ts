import type { MarketPrice, ProductPrice, Store } from './grocery-quote';

export type CachedGroceryPrices = { version: 1; savedAt: string; store: Store; branch: string; prices: MarketPrice[]; products: ProductPrice[] };
export interface GroceryPriceCache {
  read(user: string, patient: string): Promise<CachedGroceryPrices | null>;
  write(user: string, patient: string, value: CachedGroceryPrices): Promise<void>;
}
export class GroceryPriceNetworkError extends Error {}
const latestRequests = new Map<string, symbol>();

/** Restore only the same branch and only after a network failure. */
export async function loadGroceryPrices(cache: GroceryPriceCache, user: string, patient: string, store: Store, branch: string,
  fetchPrices: () => Promise<{ prices: MarketPrice[]; products: ProductPrice[] }>) {
  const scope = JSON.stringify([user, patient]);
  const request = Symbol(scope);
  latestRequests.set(scope, request);
  try {
    const result = await fetchPrices();
    const value: CachedGroceryPrices = { version: 1, savedAt: new Date().toISOString(), store, branch, ...result };
    if (latestRequests.get(scope) === request) {
      try { await cache.write(user, patient, value); } catch { /* An online result remains usable. */ }
    }
    return { ...value, offline: false };
  } catch (error) {
    if (!(error instanceof GroceryPriceNetworkError)) throw error;
    const value = await cache.read(user, patient);
    if (!value || value.store !== store || value.branch !== branch) throw error;
    return { ...value, offline: true };
  } finally { if (latestRequests.get(scope) === request) latestRequests.delete(scope); }
}
