import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { CMS, qaJwt } from './session';

/*
 * A REAL test competition for the real-write e2e paths of the scale (cântar) and penalties
 * (owner 2026-10-08: the LOCAL CMS is safe for real writes — no push tokens, Postmark on its test
 * token). Built with the LOCAL full-access API token (E2E_CMS_ADMIN_TOKEN, git-ignored .env.local),
 * authored by the QA account so the browser drives it as its organizer:
 *
 *   «[E2E] Cântar real <stamp>» — individual, quantity ranking (penalties apply), Crap + Crap Oglinda,
 *   lake Chita (the competition points at it; nothing on the lake changes), 2 sectors A / B, four
 *   test stands «E2E-1..4» WITHOUT a lake (so no lake lists them), three guests allocated on
 *   A/E2E-1, A/E2E-2, B/E2E-3; created notStarted (guests and allocation need it), then started.
 *
 * `destroy()` removes every row it made and every row the test made on it (penalties, weighings +
 * their catches, weighing logs, signature uploads, registrations, sectors, stands, the competition)
 * and returns what is still left (must be empty). It is idempotent: call it from afterAll even when
 * setup failed half-way. Firestore chat system messages the CMS posts go to the local env prefix and
 * are not touched (hard rule: tests never write or delete in Firestore).
 */

export const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';

type Json = Record<string, unknown>;
export type RealScale = {
  competitionId: string;
  sectors: { A: string; B: string };
  stands: string[];
  /** Registration documentId by stand documentId. */
  registrationByStand: Record<string, string>;
  species: { documentId: string; Name: string }[];
  qa: { id: number; documentId: string; username: string; role: { id: number; name: string } };
  jwt: string;
};

export function adminToken(): string | null {
  return process.env.E2E_CMS_ADMIN_TOKEN ?? null;
}

const admin = () => ({ Authorization: `Bearer ${adminToken()}` });

async function ok<T = Json>(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: HTTP ${res.status()} ${(await res.text()).slice(0, 400)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** The species by name (the CMS keeps them as `fishes`). */
async function speciesByName(request: APIRequestContext, names: string[]) {
  const list = await ok<{ data: { documentId: string; Name: string }[] }>(
    await request.get(`${CMS}/fishes?fields[0]=Name&pagination[pageSize]=100`, { headers: admin() }),
    'species',
  );
  return names.map((n) => {
    const s = list.data.find((x) => x.Name === n);
    if (!s) throw new Error(`species «${n}» missing locally`);
    return s;
  });
}

const NAME_PREFIX = '[E2E] Cântar real';
const STAND_PREFIX = 'E2E-';

/**
 * Builds the competition. It owns its own API context (a test's `request` fixture cannot be used
 * from afterAll), and first sweeps what a crashed run may have left (`sweepRealScale`).
 */
export async function createRealScale(): Promise<{ fixture: RealScale | null; destroy: () => Promise<string[]> }> {
  const request = await playwrightRequest.newContext();
  const made: Made = { stands: [], sectors: [], registrations: [] };
  const jwt = await qaJwt(request);
  const stale = await sweepRealScale(request, jwt);
  if (stale.length) throw new Error(`a previous run left test data that could not be removed:\n${stale.join('\n')}`);
  const destroy = async () => {
    try {
      return await destroyRealScale(request, jwt, made);
    } finally {
      await request.dispose();
    }
  };
  const qa = await ok<RealScale['qa']>(
    await request.get(`${CMS}/users/me?populate[role][fields][0]=name`, { headers: { Authorization: `Bearer ${jwt}` } }),
    'QA /users/me',
  );
  const species = await speciesByName(request, ['Crap', 'Crap Oglinda']);
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const now = Date.now();

  const competition = await ok<{ data: { documentId: string } }>(
    await request.post(`${CMS}/competitions`, {
      headers: admin(),
      data: {
        data: {
          name: `[E2E] Cântar real ${stamp}`,
          competitionStatus: 'notStarted',
          competitionType: 'single',
          rankingType: 'quantity',
          participantsLimit: 10,
          numberOfWinners: 1,
          startDate: new Date(now + 3_600_000).toISOString(),
          endDate: new Date(now + 8 * 3_600_000).toISOString(),
          registrationDeadline: new Date(now + 1_800_000).toISOString(),
          lake: CHITA,
          author: qa.documentId,
          fishSpecies: species.map((s) => s.documentId),
        },
      },
    }),
    'create competition',
  );
  const competitionId = competition.data.documentId;
  made.competition = competitionId;

  for (let i = 1; i <= 4; i++) {
    const s = await ok<{ data: { documentId: string } }>(
      await request.post(`${CMS}/stands`, { headers: admin(), data: { data: { name: `E2E-${i}` } } }),
      `create stand ${i}`,
    );
    made.stands.push(s.data.documentId);
  }
  const [s1, s2, s3, s4] = made.stands;
  const sector = async (name: string, stands: string[]) => {
    const s = await ok<{ data: { documentId: string } }>(
      await request.post(`${CMS}/sectors`, { headers: admin(), data: { data: { name, competition: competitionId, stands } } }),
      `create sector ${name}`,
    );
    made.sectors.push(s.data.documentId);
    return s.data.documentId;
  };
  const A = await sector('A', [s1, s2]);
  const B = await sector('B', [s3, s4]);

  const guests: string[] = [];
  for (const name of ['E2E Pescar Unu', 'E2E Pescar Doi', 'E2E Pescar Trei']) {
    const r = await ok<{ documentId: string }>(
      await request.post(`${CMS}/registrations/guests`, { headers: admin(), data: { data: { competitionId, guestName: name } } }),
      `guest ${name}`,
    );
    guests.push(r.documentId);
    made.registrations.push(r.documentId);
  }
  const allocations = { [guests[0]]: s1, [guests[1]]: s2, [guests[2]]: s3 };
  await ok(await request.post(`${CMS}/competitions/${competitionId}/allocate-stand-to-registration`, { headers: admin(), data: { allocations } }), 'allocate');
  await ok(await request.put(`${CMS}/competitions/${competitionId}`, { headers: admin(), data: { data: { competitionStatus: 'started', startDate: new Date(now - 3_600_000).toISOString() } } }), 'start');

  return {
    fixture: {
      competitionId,
      sectors: { A, B },
      stands: made.stands,
      registrationByStand: { [s1]: guests[0], [s2]: guests[1], [s3]: guests[2] },
      species,
      qa,
      jwt,
    },
    destroy,
  };
}

/* ------------------------------------------------------------------ */
/* Reads (the CMS state a test asserts after a write)                  */
/* ------------------------------------------------------------------ */

export type CmsWeighing = {
  documentId: string;
  weighingStatus: 'started' | 'finished';
  weighingType: string;
  stand: { documentId: string } | null;
  catches: { documentId: string; weight: number; fishType: { documentId: string; Name: string } | null }[];
  refereeSignature: { id: number; url: string } | null;
  witnessSignature: { id: number; url: string } | null;
};

/** Every weighing of the competition, with catches and signatures (admin read). */
export async function weighingsOf(request: APIRequestContext, competitionId: string): Promise<CmsWeighing[]> {
  const q =
    `filters[competition][documentId][$eq]=${competitionId}&pagination[pageSize]=100&sort[0]=createdAt:asc` +
    '&populate[stand][fields][0]=documentId&populate[catches][fields][0]=weight&populate[catches][populate][fishType][fields][0]=Name' +
    '&populate[refereeSignature][fields][0]=url&populate[witnessSignature][fields][0]=url';
  return (await ok<{ data: CmsWeighing[] }>(await request.get(`${CMS}/weighings?${q}`, { headers: admin() }), 'weighings')).data;
}

export type CmsLog = { documentId: string; action: string; reason?: string | null; state: unknown };
export async function weighingLogsOf(request: APIRequestContext, competitionId: string): Promise<CmsLog[]> {
  const q = `filters[competition][documentId][$eq]=${competitionId}&pagination[pageSize]=100&sort[0]=createdAt:asc`;
  return (await ok<{ data: CmsLog[] }>(await request.get(`${CMS}/weighing-logs?${q}`, { headers: admin() }), 'weighing logs')).data;
}

export type RankingRow = {
  standId?: string;
  stand?: { documentId?: string; name?: string } | null;
  totalWeight?: number;
  penalties?: { documentId: string; action: string; value?: number | null; reason: string }[];
  [k: string]: unknown;
};

/** The public ranking (what /concursuri/[id] reads). */
export async function rankingOf(request: APIRequestContext, competitionId: string): Promise<{ rankings: RankingRow[] } & Json> {
  return ok(await request.get(`${CMS}/competitions/${competitionId}/ranking`), 'ranking');
}

/** Every penalty document id on the competition (read from the ranking rows). */
export async function penaltyIdsOf(request: APIRequestContext, competitionId: string): Promise<string[]> {
  const r = await rankingOf(request, competitionId).catch(() => ({ rankings: [] as RankingRow[] }));
  return (r.rankings ?? []).flatMap((row) => (row.penalties ?? []).map((p) => p.documentId));
}

/* ------------------------------------------------------------------ */
/* Teardown                                                            */
/* ------------------------------------------------------------------ */

/** Upload ids whose file name carries `weighingId` (the signature PNGs). */
async function uploadsNamed(request: APIRequestContext, weighingId: string): Promise<number[]> {
  const res = await request.get(`${CMS}/upload/files?filters[name][$contains]=${weighingId}`, { headers: admin() });
  if (!res.ok()) return [];
  const body = (await res.json()) as { id: number }[] | { data: { id: number }[] };
  return (Array.isArray(body) ? body : body.data).map((x) => x.id);
}

type Made = { competition?: string; stands: string[]; sectors: string[]; registrations: string[] };

/** Removes every «[E2E] Cântar real …» competition and lake-less «E2E-N» stand still on the CMS. */
export async function sweepRealScale(request: APIRequestContext, jwt: string): Promise<string[]> {
  const left: string[] = [];
  const list = async <T>(path: string) => {
    const res = await request.get(`${CMS}/${path}`, { headers: admin() });
    return res.ok() ? ((await res.json()) as { data: T[] }).data : [];
  };
  const comps = await list<{ documentId: string }>(`competitions?filters[name][$startsWith]=${encodeURIComponent(NAME_PREFIX)}&fields[0]=name&pagination[pageSize]=50`);
  for (const c of comps) {
    const sectors = await list<{ documentId: string; stands: { documentId: string; name: string }[] }>(
      `sectors?filters[competition][documentId][$eq]=${c.documentId}&populate[stands][fields][0]=name`,
    );
    const stands = sectors.flatMap((x) => x.stands.filter((st) => st.name.startsWith(STAND_PREFIX)).map((st) => st.documentId));
    left.push(...(await destroyRealScale(request, jwt, { competition: c.documentId, sectors: sectors.map((x) => x.documentId), stands, registrations: [] })));
  }
  const orphans = await list<{ documentId: string }>(`stands?filters[name][$startsWith]=${STAND_PREFIX}&filters[lake][id][$null]=true&fields[0]=name&pagination[pageSize]=50`);
  if (orphans.length) left.push(...(await destroyRealScale(request, jwt, { stands: orphans.map((x) => x.documentId), sectors: [], registrations: [] })));
  return left;
}

async function destroyRealScale(request: APIRequestContext, jwt: string, made: Made): Promise<string[]> {
  const left: string[] = [];
  const user = { Authorization: `Bearer ${jwt}` };
  const del = async (url: string, headers: Record<string, string>, what: string) => {
    const res = await request.delete(url, { headers });
    if (!res.ok() && res.status() !== 404) left.push(`${what}: HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`);
  };
  const c = made.competition;
  if (c) {
    // Penalties and weighings are deleted through the organizer's own routes (they cascade and purge),
    // which refuse outside a running competition: make sure it is running.
    await request.put(`${CMS}/competitions/${c}`, { headers: admin(), data: { data: { competitionStatus: 'started' } } });
    for (const p of await penaltyIdsOf(request, c)) await del(`${CMS}/penalties/${p}`, user, `penalty ${p}`);
    const weighings = await weighingsOf(request, c).catch(() => [] as CmsWeighing[]);
    // Signatures: the web names them «<field>-weighingDocumentId-<id>.png»; a re-close after a reopen
    // uploads a new pair and the old one is no longer the weighing's, so they are found by name.
    const files = new Set(weighings.flatMap((w) => [w.refereeSignature?.id, w.witnessSignature?.id]).filter((x): x is number => typeof x === 'number'));
    for (const w of weighings) for (const id of await uploadsNamed(request, w.documentId)) files.add(id);
    for (const w of weighings) await del(`${CMS}/weighings/${w.documentId}`, user, `weighing ${w.documentId}`);
    for (const id of files) await del(`${CMS}/upload/files/${id}`, admin(), `upload ${id}`);
    for (const w of weighings) if ((await uploadsNamed(request, w.documentId)).length) left.push(`uploads of weighing ${w.documentId} still exist`);
    for (const l of await weighingLogsOf(request, c).catch(() => [] as CmsLog[])) await del(`${CMS}/weighing-logs/${l.documentId}`, admin(), `log ${l.documentId}`);
    // Registrations the test may have added on top of the three guests.
    const regs = await request.get(`${CMS}/registrations?filters[competition][documentId][$eq]=${c}&fields[0]=guestName&pagination[pageSize]=100`, { headers: admin() });
    if (regs.ok()) for (const r of ((await regs.json()) as { data: { documentId: string }[] }).data) if (!made.registrations.includes(r.documentId)) made.registrations.push(r.documentId);
  }
  for (const r of made.registrations) await del(`${CMS}/registrations/${r}`, admin(), `registration ${r}`);
  for (const s of made.sectors) await del(`${CMS}/sectors/${s}`, admin(), `sector ${s}`);
  for (const s of made.stands) await del(`${CMS}/stands/${s}`, admin(), `stand ${s}`);
  if (c) await del(`${CMS}/competitions/${c}`, admin(), `competition ${c}`);

  // What is still there (must be nothing).
  if (c) {
    const still = await request.get(`${CMS}/competitions?filters[documentId][$eq]=${c}`, { headers: admin() });
    if (still.ok() && ((await still.json()) as { data: unknown[] }).data.length) left.push(`competition ${c} still exists`);
    for (const [kind, path] of [
      ['weighing', 'weighings'],
      ['catch', 'catches'],
      ['weighing log', 'weighing-logs'],
      ['registration', 'registrations'],
      ['sector', 'sectors'],
    ] as const) {
      const res = await request.get(`${CMS}/${path}?filters[competition][documentId][$eq]=${c}`, { headers: admin() });
      if (res.ok()) {
        const n = ((await res.json()) as { data: unknown[] }).data.length;
        if (n) left.push(`${n} ${kind}(s) of ${c} still exist`);
      }
    }
  }
  for (const s of made.stands) {
    const res = await request.get(`${CMS}/stands?filters[documentId][$eq]=${s}`, { headers: admin() });
    if (res.ok() && ((await res.json()) as { data: unknown[] }).data.length) left.push(`stand ${s} still exists`);
  }
  made.competition = undefined;
  made.stands = [];
  made.sectors = [];
  made.registrations = [];
  return left;
}

/**
 * Whether the QA account's role (Organizer) holds a grant on the local CMS (read with the admin
 * token; never changed by a test). `uid` is «api::penalty.penalty», `action` «delete».
 */
export async function organizerHasGrant(request: APIRequestContext, roleId: number, uid: string, action: string): Promise<boolean> {
  const res = await request.get(`${CMS}/users-permissions/roles/${roleId}`, { headers: admin() });
  if (!res.ok()) return false;
  const [api, controller] = uid.split('.');
  const perms = ((await res.json()) as { role?: { permissions?: Record<string, { controllers?: Record<string, Record<string, { enabled?: boolean }>> }> } }).role?.permissions;
  return Boolean(perms?.[api]?.controllers?.[controller]?.[action]?.enabled);
}
