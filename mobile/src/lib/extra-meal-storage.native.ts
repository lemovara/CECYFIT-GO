import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import type { PendingExtraMeal, QueueStorage } from './extra-meal-queue-core';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';

export const offlineStorageAvailable = true;
const db = new SQLiteStorage('cecyfit-offline.db');
const name = (userId: string, patientId: string) => `extra_meals_${userId}_${patientId}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const additionalData = (id: string) => Uint8Array.from(id, char => char.charCodeAt(0));

export const extraMealStorage: QueueStorage = {
  async read(userId, patientId) {
    const id = name(userId, patientId);
    const ciphertext = await db.getItemAsync(id);
    if (!ciphertext) return [];
    const storedKey = await SecureStore.getItemAsync(id, options);
    if (!storedKey) throw new Error('No está disponible la clave local.');
    const key = await AESEncryptionKey.import(storedKey, 'hex');
    const plaintext = await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: additionalData(id) });
    const parsed: unknown = decodeOfflineJson(plaintext);
    if (!Array.isArray(parsed)) throw new Error('No se pudo leer la cola local.');
    return parsed as PendingExtraMeal[];
  },
  async write(userId, patientId, entries) {
    const id = name(userId, patientId);
    let storedKey = await SecureStore.getItemAsync(id, options);
    if (!storedKey) {
      if (await db.getItemAsync(id)) throw new Error('No está disponible la clave local.');
      const generated = await AESEncryptionKey.generate();
      storedKey = await generated.encoded('hex');
      await SecureStore.setItemAsync(id, storedKey, options);
    }
    const key = await AESEncryptionKey.import(storedKey, 'hex');
    const sealed = await aesEncryptAsync(encodeOfflineJson(entries), key, { additionalData: additionalData(id) });
    await db.setItemAsync(id, await sealed.combined('base64'));
  },
};
