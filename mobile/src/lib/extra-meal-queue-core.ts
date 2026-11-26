import type { ExtraMeal } from './patient-meals';

export type PendingExtraMeal = ExtraMeal & { patientId: string; day: string };
export interface QueueStorage {
  read(userId: string, patientId: string): Promise<PendingExtraMeal[]>;
  write(userId: string, patientId: string, entries: PendingExtraMeal[]): Promise<void>;
}

/** Serializes local changes and removes an entry only after the server confirms it. */
export class ExtraMealQueue {
  private locks = new Map<string, Promise<void>>();
  private flights = new Map<string, Promise<{ sent: number; pending: number }>>();
  private storage: QueueStorage;
  private changed: () => void;
  constructor(storage: QueueStorage, changed: () => void = () => {}) { this.storage = storage; this.changed = changed; }
  private key(userId: string, patientId: string) { return `${userId}:${patientId}`; }
  private async lock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(key, current);
    await previous;
    try { return await action(); }
    finally { if (this.locks.get(key) === current) this.locks.delete(key); release(); }
  }
  async list(userId: string, patientId: string) {
    return this.lock(this.key(userId, patientId), () => this.storage.read(userId, patientId));
  }
  async enqueue(userId: string, entry: PendingExtraMeal) {
    await this.lock(this.key(userId, entry.patientId), async () => {
      const rows = await this.storage.read(userId, entry.patientId);
      const existing = rows.find(row => row.id === entry.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new Error('El identificador pertenece a otro registro.');
        return;
      }
      if (rows.length >= 1000) throw new Error('Hay demasiados registros pendientes.');
      await this.storage.write(userId, entry.patientId, [...rows, entry]);
    });
    this.changed();
  }
  async sync(userId: string, patientId: string, send: (entry: PendingExtraMeal) => Promise<void>) {
    const key = this.key(userId, patientId);
    const active = this.flights.get(key);
    if (active) return active;
    const task = (async () => {
      let sent = 0;
      for (const entry of await this.list(userId, patientId)) {
        try { await send(entry); }
        catch { break; }
        await this.lock(key, async () => {
          const rows = await this.storage.read(userId, patientId);
          await this.storage.write(userId, patientId, rows.filter(row => row.id !== entry.id));
        });
        sent++;
        this.changed();
      }
      return { sent, pending: (await this.list(userId, patientId)).length };
    })();
    this.flights.set(key, task);
    try { return await task; } finally { this.flights.delete(key); }
  }
}
