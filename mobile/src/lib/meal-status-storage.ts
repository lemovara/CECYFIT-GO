import type { StatusQueueStorage } from './meal-status-queue-core';
export const statusStorageAvailable = false;
export const mealStatusStorage: StatusQueueStorage = {
  async read() { throw new Error('Almacenamiento sin conexión no disponible.'); },
  async write() { throw new Error('Almacenamiento sin conexión no disponible.'); },
};
