/**
 * The local QA account used by contract and e2e tests. Credentials come only from the
 * environment (CONTRACT_EMAIL / CONTRACT_PASSWORD, e.g. in .env.local); the repo is public.
 */
try {
  process.loadEnvFile?.('.env.local');
} catch {
  // No .env.local: the variables must come from the shell.
}

export function qaUser(): { identifier: string; password: string } {
  const identifier = process.env.CONTRACT_EMAIL;
  const password = process.env.CONTRACT_PASSWORD;
  if (!identifier || !password) {
    throw new Error('Set CONTRACT_EMAIL and CONTRACT_PASSWORD (see .env.example) to run tests against the CMS.');
  }
  return { identifier, password };
}
