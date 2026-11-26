export type PendingHydration = { id: string; patientId: string; day: string; amount: number };
export interface HydrationStorage {
  read(userId: string,patientId: string): Promise<PendingHydration[]>;
  write(userId: string,patientId: string,rows: PendingHydration[]): Promise<void>;
}
export class HydrationQueue {
  private locks = new Map<string,Promise<void>>();
  private flights = new Map<string,Promise<{ sent:number; pending:number }>>();
  private storage: HydrationStorage;
  private changed: () => void;
  constructor(storage: HydrationStorage,changed: () => void = () => {}) {
    this.storage = storage;
    this.changed = changed;
  }
  private key(user: string,patient: string) { return JSON.stringify([user,patient]); }
  private async lock<T>(key: string,action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void; const current = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(key,current); await previous;
    try { return await action(); } finally { if (this.locks.get(key) === current) this.locks.delete(key); release(); }
  }
  async list(user: string,patient: string) { return this.lock(this.key(user,patient),() => this.storage.read(user,patient)); }
  async enqueue(user: string,entry: PendingHydration) {
    if (!Number.isInteger(entry.amount) || entry.amount < 1 || entry.amount > 5000) throw new Error('Cantidad inválida.');
    await this.lock(this.key(user,entry.patientId),async () => {
      const rows = await this.storage.read(user,entry.patientId), existing = rows.find(row => row.id === entry.id);
      if (existing) { if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new Error('Identificador duplicado.'); return; }
      if (rows.length >= 1000) throw new Error('Demasiados registros pendientes.');
      await this.storage.write(user,entry.patientId,[...rows,entry]);
    });
    this.changed();
  }
  async sync(user: string,patient: string,send: (entry: PendingHydration) => Promise<void>) {
    const key = this.key(user,patient), existing = this.flights.get(key);
    if (existing) return existing;
    const task = (async () => {
      let sent = 0;
      for (const entry of await this.list(user,patient)) {
        try { await send(entry); } catch { break; }
        await this.lock(key,async () => {
          const rows = await this.storage.read(user,patient);
          await this.storage.write(user,patient,rows.filter(row => row.id !== entry.id));
        });
        sent++; this.changed();
      }
      return { sent,pending:(await this.list(user,patient)).length };
    })();
    this.flights.set(key,task);
    try { return await task; } finally { this.flights.delete(key); }
  }
}

/** Confirmed server IDs suppress pending copies while a synchronization acknowledgement is processed. */
export function hydrationTotals(server: { id:string; amount_ml:number }[] | null,pending: PendingHydration[]) {
  const ids = new Set((server ?? []).map(row => row.id));
  const unconfirmed = pending.filter(row => !ids.has(row.id));
  return { confirmed:server === null ? null : server.reduce((sum,row) => sum + row.amount_ml,0),
    pending:unconfirmed.reduce((sum,row) => sum + row.amount,0), pendingCount:unconfirmed.length };
}
