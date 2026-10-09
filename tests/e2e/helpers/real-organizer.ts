import type { APIRequestContext } from '@playwright/test';
import { qaUser } from '../../qa-user';
import { CMS } from './session';

/*
 * REAL organizer writes against the LOCAL CMS (:1337) — the counterpart of fake-organizer.ts.
 *
 * Since 2026-10-08 the local CMS is safe for real writes (owner): every push token was removed and
 * Postmark runs on its test token, so a publish, a registration decision, an allocation or a referee
 * change reaches nobody. The real-write specs (`*-real.spec.ts`) therefore drive the actual write
 * through the UI, read the CMS state back, and remove EVERYTHING they created:
 *
 *  - `seedCompetition` makes a test competition the QA organizer authors (draft → publish through
 *    the organizer API, then guest registrations), on Chita Lake, far in the future (2027-09) so it
 *    never overlaps the booking tests' dates nor tops an upcoming list;
 *  - `removeCompetition` deletes its registrations, its sectors (which drops the Chita stands' links
 *    to them) and the competition, with the LOCAL full-access API token (E2E_CMS_ADMIN_TOKEN,
 *    git-ignored .env.local), then checks the competition is gone;
 *  - every name starts with `REAL_PREFIX`; `sweepLeftovers` removes any the QA user still authors (a
 *    run killed before its afterEach), so the local data never accumulates them.
 * Roles and permissions are never changed here.
 */

void qaUser; // loads .env.local (E2E_CMS_ADMIN_TOKEN) before the token is read below.

export const ADMIN_TOKEN = process.env.E2E_CMS_ADMIN_TOKEN ?? '';
export const REAL_PREFIX = 'E2E RW';
export const CHITA = 's84u55lo4n9z0emngozttt6e';
const admin = () => ({ Authorization: `Bearer ${ADMIN_TOKEN}` });
const bearer = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });
const q = (s: string) => s.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\$/g, '%24');

export type ChitaStand = { documentId: string; name: string };

export async function chitaStands(request: APIRequestContext): Promise<ChitaStand[]> {
  const res = await request.get(`${CMS}/feed/lakes/${CHITA}`);
  if (!res.ok()) throw new Error(`Chita Lake read failed: HTTP ${res.status()}`);
  return ((await res.json()) as { data: { stands: ChitaStand[] } }).data.stands;
}

export async function firstFishSpecies(request: APIRequestContext): Promise<{ documentId: string; Name: string }> {
  const res = await request.get(`${CMS}/fishes?${q('pagination[pageSize]=100')}`);
  if (!res.ok()) throw new Error(`fishes read failed: HTTP ${res.status()}`);
  return ((await res.json()) as { data: { documentId: string; Name: string }[] }).data[0];
}

/** A unique, recognisable test name (≤ 40 chars). */
export const realName = (what: string) => `${REAL_PREFIX} ${what} ${Date.now().toString(36).slice(-5)}`;

/** A far-future window (Sat 05:00 → Sun 12:00 UTC), `weeks` apart so parallel seeds never overlap. */
export function farDates(weeks = 0) {
  const start = new Date(Date.UTC(2027, 8, 11 + weeks * 7, 5, 0, 0));
  const end = new Date(start.getTime() + 31 * 3_600_000);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export type Seeded = { documentId: string; name: string; sectorStands: ChitaStand[]; registrations: { documentId: string; guestName: string }[] };

/**
 * A published (notStarted) individual competition authored by the QA organizer: one sector «A» with
 * `stands` Chita stands, `guests` guest registrations (status registered).
 */
export async function seedCompetition(
  request: APIRequestContext,
  jwt: string,
  { name, stands = 2, guests = [] as string[], participantsLimit = Math.max(stands, guests.length, 2), weeks = 0 }: { name: string; stands?: number; guests?: string[]; participantsLimit?: number; weeks?: number },
): Promise<Seeded> {
  const allStands = await chitaStands(request);
  const sectorStands = allStands.slice(0, stands);
  const fish = await firstFishSpecies(request);
  const { startDate, endDate } = farDates(weeks);
  const created = await request.post(`${CMS}/competitions/organizer/draft`, {
    headers: bearer(jwt),
    data: {
      data: {
        name,
        startDate,
        endDate,
        registrationDeadline: startDate,
        competitionType: 'single',
        participantsLimit,
        rankingType: 'quantity',
        lake: CHITA,
        draftMeta: {
          sectors: [{ name: 'A', minFishNumber: 1 }],
          standAllocations: { A: sectorStands.map(s => s.documentId) },
          sponsorIds: [],
          fishSpeciesIds: [fish.documentId],
          completedSteps: [1, 2, 3, 4, 5],
        },
      },
    },
  });
  if (!created.ok()) throw new Error(`seed draft failed: HTTP ${created.status()} ${await created.text()}`);
  const documentId = ((await created.json()) as { data: { documentId: string } }).data.documentId;
  const seeded: Seeded = { documentId, name, sectorStands, registrations: [] };
  try {
    const published = await request.put(`${CMS}/competitions/organizer/draft/${documentId}/publish`, { headers: bearer(jwt) });
    if (!published.ok()) throw new Error(`seed publish failed: HTTP ${published.status()} ${await published.text()}`);
    for (const guestName of guests) {
      const g = await request.post(`${CMS}/registrations/guests`, { headers: bearer(jwt), data: { data: { competitionId: documentId, guestName } } });
      if (!g.ok()) throw new Error(`seed guest failed: HTTP ${g.status()} ${await g.text()}`);
      seeded.registrations.push({ documentId: ((await g.json()) as { documentId: string }).documentId, guestName });
    }
  } catch (e) {
    await removeCompetition(request, documentId).catch(() => {});
    throw e;
  }
  return seeded;
}

export type CmsCompetition = {
  documentId: string;
  name: string;
  competitionStatus: string;
  participantsLimit: number;
  registerFee: number | string | null;
  sectors: { documentId: string; name: string; stands: ChitaStand[] }[];
  registrations: { documentId: string; guestName: string | null; registrationStatus: string; stand: ChitaStand | null }[];
  referees: { documentId: string; username: string }[];
  fishSpecies: { documentId: string }[];
};

/** The competition as the CMS holds it (admin read, every draft or status); null when it is gone. */
export async function cmsCompetition(request: APIRequestContext, documentId: string): Promise<CmsCompetition | null> {
  const populate = q(
    [
      'populate[sectors][populate][stands][fields][0]=name',
      'populate[registrations][populate][stand][fields][0]=name',
      'populate[referees][fields][0]=username',
      'populate[fishSpecies][fields][0]=documentId',
      'status=published',
    ].join('&'),
  );
  const res = await request.get(`${CMS}/competitions/${documentId}?${populate}`, { headers: admin() });
  if (res.status() === 404) return null;
  if (!res.ok()) throw new Error(`admin competition read failed: HTTP ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { data: CmsCompetition }).data;
}

/** Deletes the competition with its registrations and sectors; throws when it is still there. */
export async function removeCompetition(request: APIRequestContext, documentId: string): Promise<void> {
  const del = async (path: string) => {
    const r = await request.delete(`${CMS}${path}`, { headers: admin() });
    if (!r.ok() && r.status() !== 404) throw new Error(`DELETE ${path}: HTTP ${r.status()} ${await r.text()}`);
  };
  const list = async (type: 'registrations' | 'sectors') => {
    const r = await request.get(`${CMS}/${type}?${q(`filters[competition][documentId][$eq]=${documentId}&fields[0]=documentId&pagination[pageSize]=100`)}`, { headers: admin() });
    if (!r.ok()) throw new Error(`list ${type}: HTTP ${r.status()} ${await r.text()}`);
    return ((await r.json()) as { data: { documentId: string }[] }).data.map(d => d.documentId);
  };
  for (const id of await list('registrations')) await del(`/registrations/${id}`);
  for (const id of await list('sectors')) await del(`/sectors/${id}`);
  await del(`/competitions/${documentId}`);
  if (await cmsCompetition(request, documentId)) throw new Error(`competition ${documentId} is still in the CMS after cleanup`);
  if ((await list('registrations')).length || (await list('sectors')).length) throw new Error(`competition ${documentId} left registrations / sectors behind`);
}

/** Removes every competition the QA user authors whose name starts with REAL_PREFIX (crashed runs). */
export async function sweepLeftovers(request: APIRequestContext): Promise<string[]> {
  const me = await request.get(`${CMS}/users?${q(`filters[email][$eq]=${encodeURIComponent(qaUser().identifier)}&fields[0]=id`)}`, { headers: admin() });
  if (!me.ok()) return [];
  const [user] = (await me.json()) as { id: number }[];
  if (!user) return [];
  const found = await request.get(
    `${CMS}/competitions?${q(`filters[author][id][$eq]=${user.id}&filters[name][$startsWith]=${encodeURIComponent(REAL_PREFIX)}&fields[0]=name&pagination[pageSize]=100&status=published`)}`,
    { headers: admin() },
  );
  if (!found.ok()) return [];
  const ids = ((await found.json()) as { data: { documentId: string }[] }).data.map(d => d.documentId);
  for (const id of ids) await removeCompetition(request, id).catch(() => {});
  return ids;
}

/** Tracks what a test created; `cleanup()` (afterEach) removes all of it even after a failure. */
export function tracker() {
  const ids = new Set<string>();
  return {
    add: (id: string) => void ids.add(id),
    async cleanup(request: APIRequestContext) {
      const errors: string[] = [];
      for (const id of ids) {
        await removeCompetition(request, id).catch(e => errors.push(String(e)));
      }
      ids.clear();
      if (errors.length) throw new Error(errors.join('\n'));
    },
  };
}
