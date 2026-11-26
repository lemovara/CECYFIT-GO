import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkedPurchaseTotal, parsePurchaseCents, shiftPurchaseMonth } from './grocery-checklist-core.ts';

test('suma solo artículos marcados e indica precios faltantes', () => {
  const entries = [{ key: 'food:a', purchase: 1500 }, { key: 'food:b', purchase: null }, { key: 'product:c:g', purchase: 500 }];
  assert.deepEqual(checkedPurchaseTotal(entries, ['food:a', 'food:b', 'food:antiguo']), { count: 2, known: 1500, missing: 1 });
  assert.deepEqual(checkedPurchaseTotal(entries, []), { count: 0, known: 0, missing: 0 });
});

test('registra pesos y centavos exactos sin aceptar precios inválidos', () => {
  assert.equal(parsePurchaseCents('12,5'), 1250);
  assert.equal(parsePurchaseCents('0.01'), 1);
  for (const value of ['', '0', '-1', '1.234', '1e3', '1000000.01']) assert.equal(parsePurchaseCents(value), null);
});

test('navega meses atravesando cambios de año y rechaza fechas inválidas', () => {
  assert.equal(shiftPurchaseMonth('2026-01', -1), '2025-12');
  assert.equal(shiftPurchaseMonth('2024-02', 1), '2024-03');
  assert.equal(shiftPurchaseMonth('2026-11', 0), '2026-11');
  assert.throws(() => shiftPurchaseMonth('2026-13', 1));
});
