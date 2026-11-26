import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolvePatientAccess } from './patient-access-cache-core.ts';

function cache() {
  const values = new Map();
  return { async read(user) { return values.get(user) ?? null; }, async write(user, value) { values.set(user, value); }, async clear(user) { values.delete(user); } };
}
const future = () => Math.floor(Date.now() / 1000) + 3600;
const ok = data => ({ data, error: null, status: 200 });
const network = () => Promise.resolve({ data: null, error: new Error('network'), status: 0 });
const profile = () => Promise.resolve(ok({ role: 'PACIENTE' }));
const patient = () => Promise.resolve(ok({ id: 'p1', full_name: 'Paciente de prueba' }));

test('guarda vinculación y la recupera sin red solo para la misma cuenta y sesión vigente', async () => {
  const store = cache();
  assert.equal((await resolvePatientAccess('u1', future(), store, profile, patient)).offline, false);
  const offline = await resolvePatientAccess('u1', future(), store, network, patient);
  assert.equal(offline.patient.id, 'p1');
  assert.equal(offline.offline, true);
  assert.equal((await resolvePatientAccess('u2', future(), store, network, patient)).patient, null);
  assert.equal((await resolvePatientAccess('u1', 1, store, network, patient)).patient, null);
  assert.equal((await resolvePatientAccess('u1', undefined, store, network, patient)).patient, null);
  assert.equal((await resolvePatientAccess('u1', future(), store, profile, network)).offline, true);
  assert.equal((await resolvePatientAccess('u1', future(), store, async () => ({ data: null, error: new Error(), status: 500 }), patient)).patient, null);
});

test('una vinculación revocada o rechazo del servidor invalida la copia local', async () => {
  const store = cache();
  await resolvePatientAccess('u1', future(), store, profile, patient);
  assert.equal((await resolvePatientAccess('u1', future(), store, profile, async () => ok(null))).patient, null);
  assert.equal((await resolvePatientAccess('u1', future(), store, network, patient)).patient, null);
  await resolvePatientAccess('u1', future(), store, profile, patient);
  await resolvePatientAccess('u1', future(), store, async () => ({ data: null, error: new Error(), status: 403 }), patient);
  assert.equal((await resolvePatientAccess('u1', future(), store, network, patient)).patient, null);
});

test('una respuesta antigua no restaura la vinculación después de una revocación', async () => {
  const store = cache();
  let resume;
  const slow = resolvePatientAccess('u1', future(), store, profile, () => new Promise(resolve => { resume = resolve; }));
  await Promise.resolve();
  await resolvePatientAccess('u1', future(), store, profile, async () => ok(null));
  resume(ok({ id: 'p1', full_name: 'Anterior' }));
  await slow;
  assert.equal(await store.read('u1'), null);
});

test('una falla de almacenamiento no impide acceso en línea ni concede acceso sin red', async () => {
  const store = { async read() { throw new Error('datos ilegibles'); }, async write() { throw new Error('dispositivo bloqueado'); }, async clear() {} };
  assert.equal((await resolvePatientAccess('u1', future(), store, profile, patient)).patient.id, 'p1');
  assert.equal((await resolvePatientAccess('u1', future(), store, network, patient)).patient, null);
});
