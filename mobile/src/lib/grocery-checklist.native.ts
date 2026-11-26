import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import type { GroceryChecklistStorage } from './grocery-checklist-core';

const db = new SQLiteStorage('cecyfit-offline.db');
const keyName = (user: string, patient: string, scope: string) => `grocery_${user}_${patient}_${scope}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const associated = (id: string) => Uint8Array.from(id, char => char.charCodeAt(0));
export const groceryChecklistPersistent = true;
export const groceryChecklist: GroceryChecklistStorage = {
  async read(user, patient, scope) {
    const id = keyName(user, patient, scope);
    const ciphertext = await db.getItemAsync(id);
    if (!ciphertext) return [];
    const stored = await SecureStore.getItemAsync(id, options);
    if (!stored) throw new Error('No está disponible la clave local.');
    const key = await AESEncryptionKey.import(stored, 'hex');
    const parsed = decodeOfflineJson(await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), key, { additionalData: associated(id) }));
    if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) throw new Error('Lista inválida.');
    return parsed;
  },
  async write(user, patient, scope, entries) {
    const id = keyName(user, patient, scope);
    let stored = await SecureStore.getItemAsync(id, options);
    if (!stored) {
      if (await db.getItemAsync(id)) throw new Error('No está disponible la clave local.');
      const generated = await AESEncryptionKey.generate();
      stored = await generated.encoded('hex');
      await SecureStore.setItemAsync(id, stored, options);
    }
    const key = await AESEncryptionKey.import(stored, 'hex');
    const sealed = await aesEncryptAsync(encodeOfflineJson(entries), key, { additionalData: associated(id) });
    await db.setItemAsync(id, await sealed.combined('base64'));
  },
};
