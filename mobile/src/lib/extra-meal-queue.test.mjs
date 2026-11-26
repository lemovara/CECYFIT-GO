import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ExtraMealQueue } from './extra-meal-queue-core.ts';
import { encodeOfflineJson, decodeOfflineJson } from './offline-json.ts';
import { withRequestTimeout } from './request-timeout.ts';

test('conserva acentos, caracteres especiales y emoji en el almacenamiento', () => {
  const input = [{ name: 'Piña y café ☕', portion: '½ taza', other: '\\"\n' }];
  assert.deepEqual(decodeOfflineJson(encodeOfflineJson(input)), input);
});

function memoryStorage() {
  const records = new Map();
  const key = (user, patient) => `${user}:${patient}`;
  return {
    async read(user, patient) { return structuredClone(records.get(key(user, patient)) ?? []); },
    async write(user, patient, rows) { records.set(key(user, patient), structuredClone(rows)); },
  };
}
const item = id => ({ id, patientId: 'patient', day: '2026-11-22', name: 'Tacos', portion: '2 piezas', kcal: null });

test('guarda cada solicitud una sola vez y aísla cuentas y pacientes', async () => {
  const queue = new ExtraMealQueue(memoryStorage());
  await Promise.all([queue.enqueue('u1', item('1')), queue.enqueue('u1', item('2')), queue.enqueue('u1', item('1'))]);
  assert.equal((await queue.list('u1', 'patient')).length, 2);
  assert.equal((await queue.list('u2', 'patient')).length, 0);
  assert.equal((await queue.list('u1', 'other')).length, 0);
  await assert.rejects(queue.enqueue('u1', { ...item('1'), name: 'Otro' }));
});

test('retiene registros ante fallas y reintenta con el mismo identificador', async () => {
  const queue = new ExtraMealQueue(memoryStorage());
  await queue.enqueue('u1', item('1'));
  await queue.enqueue('u1', item('2'));
  const attempts = [];
  const failed = await queue.sync('u1', 'patient', async entry => { attempts.push(entry.id); throw new Error('sin red'); });
  assert.deepEqual(failed, { sent: 0, pending: 2 });
  const succeeded = await queue.sync('u1', 'patient', async entry => { attempts.push(entry.id); });
  assert.deepEqual(succeeded, { sent: 2, pending: 0 });
  assert.deepEqual(attempts, ['1', '1', '2']);
});

test('una solicitud abortada conserva el registro y permite un reintento posterior', async () => {
  const queue = new ExtraMealQueue(memoryStorage());
  await queue.enqueue('u1', item('1'));
  const first = await queue.sync('u1', 'patient', async () => withRequestTimeout(signal => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  }), 10));
  assert.deepEqual(first, { sent: 0, pending: 1 });
  const attempts = [];
  const second = await queue.sync('u1', 'patient', async entry => { attempts.push(entry.id); });
  assert.deepEqual(attempts, ['1']);
  assert.deepEqual(second, { sent: 1, pending: 0 });
});

test('la instantánea nutricional se conserva al reintentar un registro sin conexión', async () => {
  const queue = new ExtraMealQueue(memoryStorage());
  const entry = { ...item('3'), nutrition_snapshot: { version: 1, food_id: 'avena', grams: 50, protein: 6.58, fiber: null, consumed_time: '14:30', time_zone: 'America/Mexico_City' } };
  await queue.enqueue('u1', entry);
  await queue.sync('u1', 'patient', async () => { throw new Error('sin red'); });
  let sent;
  await queue.sync('u1', 'patient', async value => { sent = value; });
  assert.deepEqual(sent, entry);
});

test('un guardado concurrente no se pierde mientras otro se sincroniza', async () => {
  const queue = new ExtraMealQueue(memoryStorage());
  await queue.enqueue('u1', item('1'));
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const syncing = queue.sync('u1', 'patient', async () => { started(); await gate; });
  await ready;
  await queue.enqueue('u1', item('2'));
  resume();
  assert.deepEqual(await syncing, { sent: 1, pending: 1 });
  assert.deepEqual((await queue.list('u1', 'patient')).map(entry => entry.id), ['2']);
});
