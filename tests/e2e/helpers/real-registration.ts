import { CMS } from './session';

/*
 * Test data for the REAL registration writes (participant.register, participant.register-guests):
 * a throwaway competition per test, created through the LOCAL Strapi's REST API with the
 * full-access API token (E2E_STRAPI_API_TOKEN, .env.local — never committed), and removed with all
 * of its registrations afterwards. Only test data is touched: competitions named «[E2E-REAL] …»
 * and the registrations on them. Never roles, permissions or other users' records.
 *
 * Every competition is created by `createTestCompetition`, which records it; `cleanupTestCompetitions`
 * (afterEach / afterAll) deletes what was recorded, and `sweepStaleTestCompetitions` (beforeAll)
 * deletes «[E2E-REAL]» leftovers of a run that crashed before its cleanup.
 */

try {
  process.loadEnvFile?.('.env.local');
} catch {
  // No .env.local: the variables must come from the shell.
}

export const REAL_PREFIX = '[E2E-REAL]';

/** The lake the throwaway competitions are held on (any local lake; override with E2E_REAL_LAKE). */
const LAKE = process.env.E2E_REAL_LAKE ?? 't2vog9qczowvd5k8sbbflcn4';

function token(): string {
  const t = process.env.E2E_STRAPI_API_TOKEN;
  if (!t) throw new Error('Set E2E_STRAPI_API_TOKEN (LOCAL Strapi full-access API token) in .env.local');
  if (!/^http:\/\/(localhost|127\.0\.0\.1):1337\//.test(CMS)) throw new Error(`Real registration writes run only against the local CMS (CMS=${CMS})`);
  return t;
}

async function admin<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CMS}${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export type AdminUser = { id: number; documentId: string; username: string };

/** A local account by its exact username (the test accounts: «Audit Organizator», «E2E Pescar», …). */
export async function userByName(username: string): Promise<AdminUser> {
  const rows = await admin<AdminUser[]>('GET', `/users?filters[username][$eq]=${encodeURIComponent(username)}&fields[0]=username`);
  if (!rows[0]) throw new Error(`no local user named «${username}»`);
  return rows[0];
}

const created = new Set<string>();
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export async function createTestCompetition(over: {
  label: string;
  author: string;
  competitionType: 'single' | 'team';
  teamParticipants?: number;
  participantsLimit?: number;
}): Promise<string> {
  const { label, ...rest } = over;
  const res = await admin<{ data: { documentId: string } }>('POST', '/competitions', {
    data: {
      name: `${REAL_PREFIX} ${label} ${Date.now().toString(36)}`,
      lake: LAKE,
      competitionStatus: 'notStarted',
      rankingType: 'quantity',
      teamParticipants: 1,
      participantsLimit: 10,
      startDate: days(10),
      endDate: days(10.5),
      registrationDeadline: days(9),
      ...rest,
    },
  });
  created.add(res.data.documentId);
  return res.data.documentId;
}

export type AdminRegistration = {
  documentId: string;
  registrationStatus: string;
  teamName: string | null;
  guestName: string | null;
  author: { documentId: string } | null;
  participants: { documentId: string; username: string }[];
};

/** Every registration on a competition, any status, as the CMS stores it. */
export async function registrationsOf(competition: string): Promise<AdminRegistration[]> {
  const res = await admin<{ data: AdminRegistration[] }>(
    'GET',
    `/registrations?filters[competition][documentId][$eq]=${competition}&populate[participants][fields][0]=username&populate[author][fields][0]=username&pagination[pageSize]=100&sort=id:asc`,
  );
  return res.data;
}

async function deleteDeep(competition: string) {
  for (const r of await registrationsOf(competition)) await admin('DELETE', `/registrations/${r.documentId}`);
  await admin('DELETE', `/competitions/${competition}`);
}

/** Deletes every competition this worker created (and its registrations). Throws if one stays. */
export async function cleanupTestCompetitions() {
  const failures: string[] = [];
  for (const id of [...created]) {
    try {
      await deleteDeep(id);
      created.delete(id);
    } catch (e) {
      failures.push(`${id}: ${(e as Error).message}`);
    }
  }
  if (failures.length) throw new Error(`test competitions not cleaned up:\n${failures.join('\n')}`);
}

/** «[E2E-REAL]» competitions older than 30 minutes: a crashed run's leftovers. */
export async function sweepStaleTestCompetitions() {
  const res = await admin<{ data: { documentId: string; createdAt: string }[] }>(
    'GET',
    `/competitions?filters[name][$startsWith]=${encodeURIComponent(REAL_PREFIX)}&fields[0]=createdAt&pagination[pageSize]=100`,
  );
  for (const c of res.data) if (Date.now() - Date.parse(c.createdAt) > 30 * 60_000) await deleteDeep(c.documentId);
}

/** Whether a competition still exists on the CMS (cleanup verification). */
export async function competitionExists(documentId: string) {
  const res = await fetch(`${CMS}/competitions/${documentId}`, { headers: { authorization: `Bearer ${token()}` } });
  return res.ok;
}

/** A test account's phone (the registration POST may save one), read and restored around a test. */
export async function userPhone(userId: number): Promise<string | null> {
  return (await admin<{ phone: string | null }>('GET', `/users/${userId}?fields[0]=phone`)).phone ?? null;
}

export async function setUserPhone(userId: number, phone: string | null) {
  await admin('PUT', `/users/${userId}`, { phone });
}

/** Removes one registration of a test competition (a scenario step, e.g. the viewer without an entry). */
export async function deleteRegistration(documentId: string) {
  await admin('DELETE', `/registrations/${documentId}`);
}
