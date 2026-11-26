import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { CachedMealPlan, MealPlanCache } from './meal-plan-cache-core';

const db = new SQLiteStorage('cecyfit-offline.db');
const keyName = (userId: string, patientId: string, week: string) => `meal_plan_${userId}_${patientId}_${week}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const associated = (id: string) => Uint8Array.from(id, char => char.charCodeAt(0));
const locks = new Map<string, Promise<void>>();

async function locked<T>(id: string, action: () => Promise<T>): Promise<T> {
  const before = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const after = new Promise<void>(resolve => { release = resolve; });
  locks.set(id, after);
  await before;
  try { return await action(); }
  finally { if (locks.get(id) === after) locks.delete(id); release(); }
}

export const mealPlanCache: MealPlanCache = {
  async read(userId, patientId, week) {
    const id = keyName(userId, patientId, week);
    return locked(id, async () => {
      const ciphertext = await db.getItemAsync(id);
      if (!ciphertext) return null;
      const stored = await SecureStore.getItemAsync(id, options);
      if (!stored) throw new Error('No está disponible la clave local.');
      const key = await AESEncryptionKey.import(stored, 'hex');
      const bytes = await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: associated(id) });
      const value = decodeOfflineJson(bytes) as CachedMealPlan;
      if (!value || value.version !== 1 || typeof value.savedAt !== 'string' || !Array.isArray(value.meals)) throw new Error('No se pudo leer el menú guardado.');
      return value;
    });
  },
  async write(userId, patientId, week, plan) {
    const id = keyName(userId, patientId, week);
    await locked(id, async () => {
      let stored = await SecureStore.getItemAsync(id, options);
      if (!stored) {
        if (await db.getItemAsync(id)) throw new Error('No está disponible la clave local.');
        const generated = await AESEncryptionKey.generate();
        stored = await generated.encoded('hex');
        await SecureStore.setItemAsync(id, stored, options);
      }
      const key = await AESEncryptionKey.import(stored, 'hex');
      const sealed = await aesEncryptAsync(encodeOfflineJson(plan), key, { additionalData: associated(id) });
      await db.setItemAsync(id, await sealed.combined('base64'));
    });
  },
};
