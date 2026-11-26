export type GroceryChecklistStorage = {
  read(userId: string, patientId: string, scope: string): Promise<string[]>;
  write(userId: string, patientId: string, scope: string, keys: string[]): Promise<void>;
};

export function checkedPurchaseTotal(entries: { key: string; purchase: number | null }[], checked: string[]) {
  const selected = new Set(checked);
  const purchased = entries.filter(item => selected.has(item.key));
  return { count: purchased.length, known: purchased.reduce((sum, item) => sum + (item.purchase ?? 0), 0),
    missing: purchased.filter(item => item.purchase === null).length };
}

export function parsePurchaseCents(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents >= 1 && cents <= 100000000 ? cents : null;
}

export function shiftPurchaseMonth(month: string, offset: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) throw new Error('Mes inválido.');
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const result = date.toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(result)) throw new Error('Mes fuera de rango.');
  return result;
}
