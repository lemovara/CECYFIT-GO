import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import { stores } from './grocery-quote';
import type { CachedGroceryPrices, GroceryPriceCache } from './grocery-price-cache-core';

const db = new SQLiteStorage('cecyfit-offline.db');
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const keyName = (user: string, patient: string) => `grocery_prices_${user}_${patient}`;
const associated = (id: string) => Uint8Array.from(id, char => char.charCodeAt(0));
const locks = new Map<string, Promise<void>>();
async function locked<T>(id: string, action: () => Promise<T>) {
  const previous = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  locks.set(id, current); await previous;
  try { return await action(); } finally { if (locks.get(id) === current) locks.delete(id); release(); }
}
export const groceryPriceCache: GroceryPriceCache = {
  async read(user, patient) {
    const id = keyName(user, patient);
    return locked(id, async () => {
      const ciphertext = await db.getItemAsync(id);
      if (!ciphertext) return null;
      const stored = await SecureStore.getItemAsync(id, options);
      if (!stored) throw new Error('Clave local no disponible.');
      const key = await AESEncryptionKey.import(stored, 'hex');
      const value = decodeOfflineJson(await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: associated(id) })) as CachedGroceryPrices;
      if (!value || value.version !== 1 || typeof value.savedAt !== 'string' || !stores.includes(value.store) || typeof value.branch !== 'string' || !Array.isArray(value.prices) || !Array.isArray(value.products)) throw new Error('Precios locales inválidos.');
      return value;
    });
  },
  async write(user, patient, value) {
    const id = keyName(user, patient);
    await locked(id, async () => {
      let stored = await SecureStore.getItemAsync(id, options);
      if (!stored) {
        if (await db.getItemAsync(id)) throw new Error('Clave local no disponible.');
        const key = await AESEncryptionKey.generate(); stored = await key.encoded('hex');
        await SecureStore.setItemAsync(id, stored, options);
      }
      const key = await AESEncryptionKey.import(stored, 'hex');
      const sealed = await aesEncryptAsync(encodeOfflineJson(value), key, { additionalData: associated(id) });
      await db.setItemAsync(id, await sealed.combined('base64'));
    });
  },
};
