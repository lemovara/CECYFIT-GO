import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { MealStatusQueue } from './meal-status-queue-core.ts';

function storage() {
  const records = new Map();
  const key = (user, patient) => `${user}:${patient}`;
  return { async read(user, patient) { return structuredClone(records.get(key(user, patient)) ?? []); },
    async write(user, patient, rows) { records.set(key(user, patient), structuredClone(rows)); } };
}
const item = (id, mealId = 'meal') => ({ id, patientId: 'p', mealId, status: 'CONSUMED', expectedRevision: 0, expectedLoggedAt: null });

test('retiene la solicitud sin conexión y reintenta con el mismo identificador', async () => {
  const queue = new MealStatusQueue(storage());
  await queue.enqueue('u', item('one'));
  await queue.sync('u', 'p', async () => { throw new Error('sin red'); });
  assert.equal((await queue.list('u', 'p')).length, 1);
  let sent;
  await queue.sync('u', 'p', async entry => { sent = entry; return { result: 'applied' }; });
  assert.equal(sent.id, 'one');
  assert.equal((await queue.list('u', 'p')).length, 0);
});

test('un conflicto no sobrescribe ni bloquea otras comidas y requiere descarte explícito', async () => {
  const queue = new MealStatusQueue(storage());
  await queue.enqueue('u', item('one'));
  await queue.enqueue('u', item('two', 'meal2'));
  await queue.sync('u', 'p', async entry => entry.id === 'one'
    ? { result: 'conflict', reason: 'plan_changed', status: null, logged_at: null, revision: 1 }
    : { result: 'applied' });
  const pending = await queue.list('u', 'p');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].conflict.reason, 'plan_changed');
  await assert.rejects(queue.enqueue('u', item('three')));
  await queue.discardConflict('u', 'p', 'one');
  assert.equal((await queue.list('u', 'p')).length, 0);
});

test('aísla cuentas y no permite descartar operaciones que aún podrían enviarse', async () => {
  const queue = new MealStatusQueue(storage());
  await queue.enqueue('u1', item('one'));
  assert.equal((await queue.list('u2', 'p')).length, 0);
  await assert.rejects(queue.discardConflict('u1', 'p', 'one'));
  assert.equal((await queue.list('u1', 'p')).length, 1);
});
