import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { loadNutritionGoal, NutritionGoalNetworkError } from './nutrition-goal-cache-core.ts';

function memory() {
  const values = new Map();
  const key = (...args) => JSON.stringify(args);
  return { async read(...scope) { return values.get(key(...scope)) ?? null; },
    async write(user,patient,day,value) { values.set(key(user,patient,day),value); } };
}
const goal = { effective_on:'2026-11-01',kcal:1800,protein:100,carbs:null,fat:null,fiber:null };
const offline = async () => { throw new NutritionGoalNetworkError('offline'); };

test('usa la meta guardada solo en una falla de red y para la cuenta, ficha y fecha correctas', async () => {
  const cache = memory();
  await loadNutritionGoal(cache,'u1','p1','2026-11-26',async () => goal);
  assert.equal((await loadNutritionGoal(cache,'u1','p1','2026-11-26',offline)).goal.kcal,1800);
  for (const scope of [['u2','p1','2026-11-26'],['u1','p2','2026-11-26'],['u1','p1','2026-11-27']])
    await assert.rejects(loadNutritionGoal(cache,...scope,offline),NutritionGoalNetworkError);
  await assert.rejects(loadNutritionGoal(cache,'u1','p1','2026-11-26',async () => { throw new Error('permisos'); }),/permisos/);
});

test('conserva el resultado vacío y evita que una respuesta antigua sustituya la nueva', async () => {
  const cache = memory();
  let finish;
  const slow = loadNutritionGoal(cache,'u1','p1','2026-11-26',() => new Promise(resolve => { finish=resolve; }));
  await loadNutritionGoal(cache,'u1','p1','2026-11-26',async () => null);
  finish(goal); await slow;
  const result = await loadNutritionGoal(cache,'u1','p1','2026-11-26',offline);
  assert.equal(result.goal,null); assert.equal(result.offline,true);
});
