import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { CachedAccess, PatientAccessCache } from './patient-access-cache-core';

const db = new SQLiteStorage('cecyfit-offline.db');
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const name = (userId: string) => `patient_access_${userId}`;
const associated = (key: string) => Uint8Array.from(key, char => char.charCodeAt(0));
const locks = new Map<string, Promise<void>>();
async function locked<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  locks.set(key, current); await previous;
  try { return await action(); }
  finally { if (locks.get(key) === current) locks.delete(key); release(); }
}

export const patientAccessCache: PatientAccessCache = {
  async read(userId) {
    const id = name(userId);
    return locked(id, async () => {
      const ciphertext = await db.getItemAsync(id);
      if (!ciphertext) return null;
      const stored = await SecureStore.getItemAsync(id, options);
      if (!stored) throw new Error('Clave local no disponible.');
      const key = await AESEncryptionKey.import(stored, 'hex');
      const bytes = await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: associated(id) });
      const value = decodeOfflineJson(bytes) as CachedAccess;
      if (!value || typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt)) ||
        !value.patient || typeof value.patient.id !== 'string' || typeof value.patient.full_name !== 'string') throw new Error('Ficha local inválida.');
      return value;
    });
  },
  async write(userId, value) {
    const id = name(userId);
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
  async clear(userId) {
    const id = name(userId);
    await locked(id, async () => { await db.removeItemAsync(id); await SecureStore.deleteItemAsync(id, options); });
  },
};
