import type { HydrationStorage } from './hydration-queue-core';
export const hydrationOfflineAvailable = false;
export const hydrationStorage: HydrationStorage = {
  async read() { throw new Error('Almacenamiento sin conexión no disponible.'); },
  async write() { throw new Error('Almacenamiento sin conexión no disponible.'); },
};
