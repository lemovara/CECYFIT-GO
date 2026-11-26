import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { previewProfessionalDraft } from './professional-draft.ts';

const foods = [{ id:'avena',kcal:379,protein:13.15,carbs:67.7,fat:6.52,fiber:null },
  { id:'platano',kcal:89,protein:1.09,carbs:22.84,fat:0.33,fiber:2.6 }];
test('calcula el borrador y señala nutrientes incompletos', () => {
  const result = previewProfessionalDraft([{ id:'avena',grams:'50' },{ id:'platano',grams:'100' }],foods)!;
  assert.equal(result.energy.known,278.5);
  assert.equal(result.fiber.complete,false);
  assert.deepEqual(result.fiber.missing,['avena']);
});
test('no calcula filas duplicadas, vacías o desconocidas', () => {
  for (const rows of [[{id:'avena',grams:''}],[{id:'x',grams:'50'}],[{id:'avena',grams:'50'},{id:'avena',grams:'25'}]])
    assert.equal(previewProfessionalDraft(rows,foods),null);
});
