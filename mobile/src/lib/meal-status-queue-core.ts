import type { MealStatus } from './patient-meals';

export type StatusConflict = { reason: 'plan_changed' | 'status_changed'; status: MealStatus | null; logged_at: string | null; revision: number };
export type PendingMealStatus = { id: string; patientId: string; mealId: string; status: MealStatus;
  expectedRevision: number; expectedLoggedAt: string | null; conflict?: StatusConflict };
export interface StatusQueueStorage {
  read(userId: string, patientId: string): Promise<PendingMealStatus[]>;
  write(userId: string, patientId: string, entries: PendingMealStatus[]): Promise<void>;
}
export type StatusResponse = { result: 'applied' } | ({ result: 'conflict' } & StatusConflict);

export class MealStatusQueue {
  private locks = new Map<string, Promise<void>>();
  private flights = new Map<string, Promise<void>>();
  private storage: StatusQueueStorage;
  private changed: () => void;
  constructor(storage: StatusQueueStorage, changed: () => void = () => {}) { this.storage = storage; this.changed = changed; }
  private key(userId: string, patientId: string) { return `${userId}:${patientId}`; }
  private async lock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(key, current); await previous;
    try { return await action(); } finally { if (this.locks.get(key) === current) this.locks.delete(key); release(); }
  }
  async list(userId: string, patientId: string) { return this.lock(this.key(userId, patientId), () => this.storage.read(userId, patientId)); }
  async enqueue(userId: string, entry: PendingMealStatus) {
    await this.lock(this.key(userId, entry.patientId), async () => {
      const rows = await this.storage.read(userId, entry.patientId);
      const duplicate = rows.find(row => row.id === entry.id);
      if (duplicate) { if (JSON.stringify(duplicate) !== JSON.stringify(entry)) throw new Error('Solicitud ya utilizada.'); return; }
      if (rows.some(row => row.mealId === entry.mealId)) throw new Error('Ya existe un registro pendiente para esta comida.');
      if (rows.length >= 1000) throw new Error('Hay demasiados registros pendientes.');
      await this.storage.write(userId, entry.patientId, [...rows, entry]);
    });
    this.changed();
  }
  async discardConflict(userId: string, patientId: string, id: string) {
    await this.lock(this.key(userId, patientId), async () => {
      const rows = await this.storage.read(userId, patientId);
      if (!rows.some(row => row.id === id && row.conflict)) throw new Error('El registro no está en conflicto.');
      await this.storage.write(userId, patientId, rows.filter(row => row.id !== id));
    });
    this.changed();
  }
  async sync(userId: string, patientId: string, send: (entry: PendingMealStatus) => Promise<StatusResponse>) {
    const key = this.key(userId, patientId);
    const flight = this.flights.get(key);
    if (flight) return flight;
    const task = (async () => {
      for (const entry of await this.list(userId, patientId)) {
        if (entry.conflict) continue;
        let response: StatusResponse;
        try { response = await send(entry); } catch { break; }
        await this.lock(key, async () => {
          const rows = await this.storage.read(userId, patientId);
          const next = response.result === 'applied' ? rows.filter(row => row.id !== entry.id)
            : rows.map(row => row.id === entry.id ? { ...row, conflict: { reason: response.reason, status: response.status, logged_at: response.logged_at, revision: response.revision } } : row);
          await this.storage.write(userId, patientId, next);
        });
        this.changed();
      }
    })();
    this.flights.set(key, task);
    try { await task; } finally { this.flights.delete(key); }
  }
}
