import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { MigratingSessionStorage } from './session-storage-core.ts';

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, async getItem(key) { return data.get(key) ?? null; }, async setItem(key, value) { data.set(key, value); }, async removeItem(key) { data.delete(key); } };
}

test('migra solo la clave solicitada y conserva la sesión', async () => {
  const legacy = memory({ session: 'sesión-anterior', other: 'otro dato' }), encrypted = memory();
  const storage = new MigratingSessionStorage(encrypted, legacy);
  assert.equal(await storage.getItem('session'), 'sesión-anterior');
  assert.equal(encrypted.data.get('session'), 'sesión-anterior');
  assert.equal(legacy.data.has('session'), false);
  assert.equal(legacy.data.get('other'), 'otro dato');
});

test('si falla la escritura cifrada no elimina la sesión anterior', async () => {
  const legacy = memory({ session: 'conservar' }), encrypted = memory();
  encrypted.setItem = async () => { throw new Error('sin clave'); };
  const storage = new MigratingSessionStorage(encrypted, legacy);
  await assert.rejects(storage.getItem('session'));
  assert.equal(legacy.data.get('session'), 'conservar');
});

test('un cierre de sesión no resucita una copia antigua', async () => {
  const legacy = memory({ session: 'vieja' }), encrypted = memory({ session: 'nueva' });
  const storage = new MigratingSessionStorage(encrypted, legacy);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(legacy.data.has('session'), false);
});

test('recupera una migración interrumpida dando prioridad al valor cifrado', async () => {
  const legacy = memory({ session: 'vieja' }), encrypted = memory({ session: 'nueva' });
  const storage = new MigratingSessionStorage(encrypted, legacy);
  assert.equal(await storage.getItem('session'), 'nueva');
  assert.equal(legacy.data.has('session'), false);
});

test('serializa una migración y un cierre de sesión simultáneos', async () => {
  const legacy = memory({ session: 'anterior' }), encrypted = memory();
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { started = resolve; });
  const write = encrypted.setItem;
  encrypted.setItem = async (...args) => { started(); await gate; return write(...args); };
  const storage = new MigratingSessionStorage(encrypted, legacy);
  const migration = storage.getItem('session');
  await ready;
  const logout = storage.removeItem('session');
  release();
  assert.equal(await migration, 'anterior');
  await logout;
  assert.equal(await storage.getItem('session'), null);
});

test('un fallo al borrar la copia anterior no elimina la copia protegida', async () => {
  const legacy = memory({ session: 'antigua' }), encrypted = memory({ session: 'nueva' });
  legacy.removeItem = async () => { throw new Error('no disponible'); };
  const storage = new MigratingSessionStorage(encrypted, legacy);
  await assert.rejects(storage.removeItem('session'));
  assert.equal(encrypted.data.get('session'), 'nueva');
});
