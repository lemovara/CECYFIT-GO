import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { PendingMealStatus, StatusQueueStorage } from './meal-status-queue-core';

export const statusStorageAvailable = true;
const db = new SQLiteStorage('cecyfit-offline.db');
const keyName = (userId: string, patientId: string) => `meal_status_${userId}_${patientId}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const aad = (id: string) => Uint8Array.from(id, char => char.charCodeAt(0));
export const mealStatusStorage: StatusQueueStorage = {
  async read(userId, patientId) {
    const id = keyName(userId, patientId), ciphertext = await db.getItemAsync(id);
    if (!ciphertext) return [];
    const stored = await SecureStore.getItemAsync(id, options);
    if (!stored) throw new Error('Clave local no disponible.');
    const key = await AESEncryptionKey.import(stored, 'hex');
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: aad(id) });
    const rows = decodeOfflineJson(bytes);
    if (!Array.isArray(rows)) throw new Error('Cola local inválida.');
    return rows as PendingMealStatus[];
  },
  async write(userId, patientId, entries) {
    const id = keyName(userId, patientId);
    let stored = await SecureStore.getItemAsync(id, options);
    if (!stored) {
      if (await db.getItemAsync(id)) throw new Error('Clave local no disponible.');
      const key = await AESEncryptionKey.generate(); stored = await key.encoded('hex');
      await SecureStore.setItemAsync(id, stored, options);
    }
    const key = await AESEncryptionKey.import(stored, 'hex');
    const sealed = await aesEncryptAsync(encodeOfflineJson(entries), key, { additionalData: aad(id) });
    await db.setItemAsync(id, await sealed.combined('base64'));
  },
};
