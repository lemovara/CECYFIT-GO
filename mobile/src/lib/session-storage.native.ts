import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import legacy, { SQLiteStorage } from 'expo-sqlite/kv-store';
import { decodeOfflineJson, encodeOfflineJson } from './offline-json';
import { MigratingSessionStorage, type AsyncStringStorage } from './session-storage-core';

const database = new SQLiteStorage('cecyfit-auth.db');
const masterKey = 'cecyfit_auth_key_v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function encryptionKey(create: boolean) {
  let encoded = await SecureStore.getItemAsync(masterKey, options);
  if (!encoded && create) {
    // Never replace a missing key if encrypted data already exists.
    if (await database.getLengthAsync()) throw new Error('La clave de sesión local no está disponible.');
    const generated = await AESEncryptionKey.generate();
    encoded = await generated.encoded('hex');
    await SecureStore.setItemAsync(masterKey, encoded, options);
  }
  if (!encoded) throw new Error('La clave de sesión local no está disponible.');
  return AESEncryptionKey.import(encoded, 'hex');
}

const encrypted: AsyncStringStorage = {
  async getItem(key) {
    const ciphertext = await database.getItemAsync(key);
    if (ciphertext === null) return null;
    const secret = await encryptionKey(false);
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(ciphertext), secret, { additionalData: encodeOfflineJson(key) });
    const value = decodeOfflineJson(bytes);
    if (typeof value !== 'string') throw new Error('La sesión local no se pudo leer.');
    return value;
  },
  async setItem(key, value) {
    const secret = await encryptionKey(true);
    const sealed = await aesEncryptAsync(encodeOfflineJson(value), secret, { additionalData: encodeOfflineJson(key) });
    await database.setItemAsync(key, await sealed.combined('base64'));
  },
  async removeItem(key) { await database.removeItemAsync(key); },
};

export const sessionStorage = new MigratingSessionStorage(encrypted, legacy);
