import type { QueueStorage } from './extra-meal-queue-core';
// Web does not yet have an encrypted offline store; callers continue online-only.
export const offlineStorageAvailable = false;
export const extraMealStorage: QueueStorage = {
  async read() { throw new Error('Almacenamiento sin conexión no disponible.'); },
  async write() { throw new Error('Almacenamiento sin conexión no disponible.'); },
};
