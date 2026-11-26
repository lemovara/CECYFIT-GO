import type { GroceryChecklistStorage } from './grocery-checklist-core';

// Web fallback lasts only while this page remains loaded.
const values = new Map<string, string[]>();
const key = (user: string, patient: string, scope: string) => JSON.stringify([user, patient, scope]);
export const groceryChecklistPersistent = false;
export const groceryChecklist: GroceryChecklistStorage = {
  async read(user, patient, scope) { return values.get(key(user, patient, scope)) ?? []; },
  async write(user, patient, scope, entries) { values.set(key(user, patient, scope), [...entries]); },
};
