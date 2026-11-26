import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { HydrationStorage, PendingHydration } from './hydration-queue-core';
const db = new SQLiteStorage('cecyfit-offline.db');
const options = { keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const name = (user: string,patient: string) => `hydration_${user}_${patient}`;
const associated = (id: string) => Uint8Array.from(id,char => char.charCodeAt(0));
export const hydrationOfflineAvailable = true;
export const hydrationStorage: HydrationStorage = {
  async read(user,patient) {
    const id=name(user,patient),ciphertext=await db.getItemAsync(id);
    if (!ciphertext) return [];
    const stored=await SecureStore.getItemAsync(id,options);
    if (!stored) throw new Error('Clave local no disponible.');
    const key=await AESEncryptionKey.import(stored,'hex');
    const parsed=decodeOfflineJson(await aesDecryptAsync(AESSealedData.fromCombined(ciphertext),key,{additionalData:associated(id)}));
    if (!Array.isArray(parsed) || parsed.some(row => !row || typeof row.id !== 'string' || row.patientId !== patient ||
      typeof row.day !== 'string' || !Number.isInteger(row.amount) || row.amount < 1 || row.amount > 5000)) throw new Error('Cola local inválida.');
    return parsed as PendingHydration[];
  },
  async write(user,patient,rows) {
    const id=name(user,patient); let stored=await SecureStore.getItemAsync(id,options);
    if (!stored) {
      if (await db.getItemAsync(id)) throw new Error('Clave local no disponible.');
      const key=await AESEncryptionKey.generate(); stored=await key.encoded('hex'); await SecureStore.setItemAsync(id,stored,options);
    }
    const key=await AESEncryptionKey.import(stored,'hex');
    const sealed=await aesEncryptAsync(encodeOfflineJson(rows),key,{additionalData:associated(id)});
    await db.setItemAsync(id,await sealed.combined('base64'));
  },
};
