import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { HydrationQueue, hydrationTotals } from './hydration-queue-core.ts';

function memoryStorage() {
  const records = new Map();
  const key = (user, patient) => JSON.stringify([user, patient]);
  return {
    async read(user, patient) { return structuredClone(records.get(key(user, patient)) ?? []); },
    async write(user, patient, rows) { records.set(key(user, patient), structuredClone(rows)); },
  };
}
const item = id => ({ id, patientId: 'patient', day: '2026-11-26', amount: 250 });

test('aisla cuentas y pacientes, valida cantidades y no duplica identificadores', async () => {
  const queue = new HydrationQueue(memoryStorage());
  await Promise.all([queue.enqueue('u1', item('1')), queue.enqueue('u1', item('1')), queue.enqueue('u1', item('2'))]);
  assert.equal((await queue.list('u1', 'patient')).length, 2);
  assert.deepEqual(await queue.list('u2', 'patient'), []);
  assert.deepEqual(await queue.list('u1', 'other'), []);
  await assert.rejects(queue.enqueue('u1', { ...item('1'), amount: 300 }));
  await assert.rejects(queue.enqueue('u1', { ...item('3'), amount: 0 }));
  await assert.rejects(queue.enqueue('u1', { ...item('3'), amount: 5001 }));
});

test('conserva el identificador y el registro hasta confirmar el reintento', async () => {
  const queue = new HydrationQueue(memoryStorage());
  await queue.enqueue('u1', item('1'));
  const attempts = [];
  assert.deepEqual(await queue.sync('u1', 'patient', async entry => { attempts.push(entry.id); throw Error('offline'); }), { sent: 0, pending: 1 });
  assert.deepEqual(await queue.sync('u1', 'patient', async entry => { attempts.push(entry.id); }), { sent: 1, pending: 0 });
  assert.deepEqual(attempts, ['1', '1']);
});

test('conserva un registro nuevo mientras otro se sincroniza', async () => {
  const queue = new HydrationQueue(memoryStorage());
  await queue.enqueue('u1', item('1'));
  let resume, started;
  const gate = new Promise(resolve => { resume = resolve; });
  const ready = new Promise(resolve => { started = resolve; });
  const syncing = queue.sync('u1', 'patient', async () => { started(); await gate; });
  await ready;
  await queue.enqueue('u1', item('2'));
  resume();
  assert.deepEqual(await syncing, { sent: 1, pending: 1 });
  assert.deepEqual((await queue.list('u1', 'patient')).map(row => row.id), ['2']);
});

test('evita contar dos veces y distingue los datos confirmados desconocidos', () => {
  assert.deepEqual(hydrationTotals([{ id: '1', amount_ml: 250 }], [item('1'), item('2')]), { confirmed: 250, pending: 250, pendingCount: 1 });
  assert.deepEqual(hydrationTotals(null, [item('1')]), { confirmed: null, pending: 250, pendingCount: 1 });
});
