import type { TestProject } from 'vitest/node';

const CMS_URL = (process.env.CMS_URL ?? 'http://localhost:1337/api').replace(/\/$/, '');

declare module 'vitest' {
  export interface ProvidedContext {
    jwt: string;
    userDocumentId: string;
    userId: number;
  }
}

/**
 * Signs the QA user in once for the whole contract run (users-permissions `local` provider,
 * enabled on local + staging). The local CMS regenerates its JWT secret on every boot, so a
 * token is never cached across runs.
 */
export default async function setup(project: TestProject) {
  const identifier = process.env.CONTRACT_EMAIL ?? 'sim-qa@bluvi.test';
  const password = process.env.CONTRACT_PASSWORD ?? '***REMOVED***';

  let res: Response;
  try {
    res = await fetch(`${CMS_URL}/auth/local`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
  } catch (e) {
    throw new Error(`Contract tests need a running CMS at ${CMS_URL} (${(e as Error).message})`);
  }
  if (!res.ok) throw new Error(`QA sign-in failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { jwt: string; user: { id: number; documentId: string } };
  project.provide('jwt', body.jwt);
  project.provide('userDocumentId', body.user.documentId);
  project.provide('userId', body.user.id);
}
