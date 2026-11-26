export interface AsyncStringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Serializes Auth operations and migrates one key only after the encrypted write succeeds. */
export class MigratingSessionStorage implements AsyncStringStorage {
  private pending: Promise<void> = Promise.resolve();
  private encrypted: AsyncStringStorage;
  private legacy: AsyncStringStorage;
  constructor(encrypted: AsyncStringStorage, legacy: AsyncStringStorage) { this.encrypted = encrypted; this.legacy = legacy; }
  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  async getItem(key: string) {
    return this.locked(async () => {
      const protectedValue = await this.encrypted.getItem(key);
      if (protectedValue !== null) {
        // A prior migration may have been interrupted after committing the encrypted value.
        await this.legacy.removeItem(key);
        return protectedValue;
      }
      const oldValue = await this.legacy.getItem(key);
      if (oldValue === null) return null;
      await this.encrypted.setItem(key, oldValue);
      await this.legacy.removeItem(key);
      return oldValue;
    });
  }
  async setItem(key: string, value: string) {
    await this.locked(async () => { await this.encrypted.setItem(key, value); await this.legacy.removeItem(key); });
  }
  async removeItem(key: string) {
    // Remove old plaintext first; it must never resurrect a signed-out session.
    await this.locked(async () => { await this.legacy.removeItem(key); await this.encrypted.removeItem(key); });
  }
}
