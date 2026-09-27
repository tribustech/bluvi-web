import { inject } from 'vitest';
import { createTestTransport } from '../transport';

/** Guest and signed-in transports for a contract test file. */
export function contractContext() {
  const jwt = inject('jwt');
  return {
    guest: createTestTransport(),
    user: createTestTransport(jwt),
    userDocumentId: inject('userDocumentId'),
    userId: inject('userId'),
  };
}

/** Asserts a call is refused for a guest (401 or 403 — Strapi answers 403 for an ungranted Public role). */
export async function expectDenied(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403) return;
    throw e;
  }
  throw new Error('Expected the CMS to refuse this call for a guest, but it succeeded');
}
