import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { CachedNutritionGoal, NutritionGoalCache } from './nutrition-goal-cache-core';

const db = new SQLiteStorage('cecyfit-offline.db');
const name = (user: string, patient: string, day: string) => `nutrition_goal_${user}_${patient}_${day}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const associated = (id: string) => Uint8Array.from(id,char => char.charCodeAt(0));
const locks = new Map<string,Promise<void>>();
async function locked<T>(id: string, action: () => Promise<T>): Promise<T> {
  const prior = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  locks.set(id,next); await prior;
  try { return await action(); } finally { if (locks.get(id) === next) locks.delete(id); release(); }
}
export const nutritionGoalCache: NutritionGoalCache = {
  async read(user,patient,day) {
    const id = name(user,patient,day);
    return locked(id,async () => {
      const ciphertext = await db.getItemAsync(id);
      if (!ciphertext) return null;
      const stored = await SecureStore.getItemAsync(id,options);
      if (!stored) throw new Error('Clave local no disponible.');
      const key = await AESEncryptionKey.import(stored,'hex');
      const value = decodeOfflineJson(await aesDecryptAsync(AESSealedData.fromCombined(ciphertext),key,{ additionalData:associated(id) })) as CachedNutritionGoal;
      if (!value || value.version !== 1 || !Number.isFinite(Date.parse(value.savedAt)) ||
        (value.goal !== null && (!value.goal || typeof value.goal.effective_on !== 'string' ||
          !(['kcal','protein','carbs','fat','fiber'] as const).every(k => value.goal![k] === null || (typeof value.goal![k] === 'number' && Number.isFinite(value.goal![k]) && value.goal![k]! >= 0))))) throw new Error('Metas locales inválidas.');
      return value;
    });
  },
  async write(user,patient,day,value) {
    const id = name(user,patient,day);
    await locked(id,async () => {
      let stored = await SecureStore.getItemAsync(id,options);
      if (!stored) {
        if (await db.getItemAsync(id)) throw new Error('Clave local no disponible.');
        const key = await AESEncryptionKey.generate(); stored = await key.encoded('hex');
        await SecureStore.setItemAsync(id,stored,options);
      }
      const key = await AESEncryptionKey.import(stored,'hex');
      const sealed = await aesEncryptAsync(encodeOfflineJson(value),key,{ additionalData:associated(id) });
      await db.setItemAsync(id,await sealed.combined('base64'));
    });
  },
};
