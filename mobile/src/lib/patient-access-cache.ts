import type { PatientAccessCache } from './patient-access-cache-core';

// Web access is always checked online until encrypted IndexedDB is supported.
export const patientAccessCache: PatientAccessCache = {
  async read() { return null; },
  async write() {},
  async clear() {},
};
