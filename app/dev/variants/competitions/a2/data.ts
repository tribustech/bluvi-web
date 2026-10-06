import 'server-only';
import {
  getCompetitionCatches,
  getCompetitionRegistrations,
  getCompetitionWeighingStatistics,
  getRankings,
  type CompetitionCard,
} from '@/core/competitions';
import { getAnglerFollowing } from '@/core/social';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { getShellSession } from '../../../../(site)/_shell/session';
import { bounded } from '../../../../(site)/concursuri/_list/server';
import { miniRanking, withDeltas, type BigCatch, type Highlight, type LiveExtra, type MiniRanking, type Weighing } from './model';

/*
 * A2's extra reads, per tab, on top of the shared VariantData (../data.ts):
 *  - Live: ranking + weighing log + heaviest catches for every live competition → hero, mini
 *    leaderboards, highlights, ticker, momentum, sparklines.
 *  - Viitoare: the registrations (names + faces, signed in only: the route is auth: required) and
 *    the anglers the viewer follows (to ring them and write the social-proof line).
 *  - Rezultate: each finished competition's ranking (podium values, places 4–8, the viewer's place).
 * Every read is bounded and fails soft to «no data» (the slot hides).
 */

const t = () => bounded(createServerTransport(), 6000);

async function viewer() {
  if (!(await getSessionToken())) return null;
  const v = await getShellSession().catch(() => null);
  return v && !('status' in v) ? v : null;
}

/* ---------------------------------------------------------------- live */

export type LiveData = { extras: Record<string, LiveExtra>; highlights: Highlight[]; ticker: Array<Weighing & { compId: string; compName: string }>; heroId: string | null };

export async function loadLive(cards: CompetitionCard[]): Promise<LiveData> {
  const tr = t();
  const extras: Record<string, LiveExtra> = {};
  await Promise.all(
    cards.map(async (c) => {
      const [rk, ws, top] = await Promise.all([
        getRankings(tr, c.documentId).catch(() => null),
        getCompetitionWeighingStatistics(tr, c.documentId).catch(() => null),
        getCompetitionCatches(tr, c.documentId, 'weight_desc', 1, 5).catch(() => null),
      ]);
      const base = rk ? miniRanking(rk) : null;
      const byStand = new Map((base?.rows ?? []).map((r) => [`${r.sector}|${r.stand}`, r.name]));
      const weighings: Weighing[] = (ws?.data ?? [])
        .map((w) => ({
          id: w.weighingDocumentId,
          at: w.endDate ?? w.startDate,
          kg: w.totalWeightKg,
          catches: w.catchCount,
          stand: w.standName ?? null,
          sector: w.sectorName ?? null,
          name: byStand.get(`${w.sectorName ?? null}|${w.standName ?? null}`) ?? null,
        }))
        .sort((a, b) => a.at.localeCompare(b.at));
      const topCatches: BigCatch[] = (top?.data ?? []).map((x) => ({
        weight: x.weight,
        name: x.teamName || x.participantUsername || x.guestName || `Stand ${x.standName}`,
        stand: x.standName,
        sector: x.sectorName,
      }));
      extras[c.documentId] = {
        id: c.documentId,
        ranking: base ? withDeltas(base, weighings, rk?.metadata.rankingType ?? '') : null,
        weighings,
        topCatches,
      };
    }),
  );

  // Hero: the competition with the most recent weighing; then the most catches; then viewers.
  const lastAt = (id: string) => extras[id]?.weighings.at(-1)?.at ?? '';
  const ranked = [...cards].sort(
    (a, b) =>
      lastAt(b.documentId).localeCompare(lastAt(a.documentId)) ||
      (b.results?.catchCount ?? 0) - (a.results?.catchCount ?? 0) ||
      b.viewers - a.viewers,
  );
  const heroId = ranked[0]?.documentId ?? null;

  const highlights: Highlight[] = [];
  const name = (id: string) => cards.find((c) => c.documentId === id)?.name ?? '';
  // The heaviest fish across every live competition.
  const records = Object.values(extras)
    .map((e) => ({ e, c: e.ranking?.biggestCatch ?? e.topCatches[0] ?? null }))
    .filter((x): x is { e: LiveExtra; c: BigCatch } => !!x.c)
    .sort((a, b) => b.c.weight - a.c.weight);
  if (records[0]) highlights.push({ kind: 'record', id: `rec-${records[0].e.id}`, compId: records[0].e.id, compName: name(records[0].e.id), catch: records[0].c });
  // The latest weighings (across competitions).
  const allW = Object.values(extras).flatMap((e) => e.weighings.map((w) => ({ ...w, compId: e.id, compName: name(e.id) })));
  allW.sort((a, b) => b.at.localeCompare(a.at));
  if (allW[0]) highlights.push({ kind: 'weighing', id: `w-${allW[0].id}`, compId: allW[0].compId, compName: allW[0].compName, weighing: allW[0] });
  // Each competition's leader, and its closest fight at the top.
  for (const c of ranked) {
    const r = extras[c.documentId]?.ranking;
    const [a, b] = r?.rows ?? [];
    if (!r || !a || a.value == null || a.catches === 0) continue;
    const gap = b?.value != null ? a.value - b.value : null;
    highlights.push({ kind: 'leader', id: `lead-${c.documentId}`, compId: c.documentId, compName: c.name, row: a, gap, valueLabel: r.valueLabel });
  }
  const battles = ranked
    .map((c) => ({ c, r: extras[c.documentId]?.ranking }))
    .filter((x) => x.r && x.r.rows[0]?.value != null && x.r.rows[1]?.value != null && (x.r.rows[1]?.catches ?? 0) > 0)
    .map((x) => ({ ...x, gap: (x.r!.rows[0].value as number) - (x.r!.rows[1].value as number) }))
    .sort((a, b) => a.gap - b.gap);
  if (battles[0]) {
    const { c, r, gap } = battles[0];
    // The battle tells that competition's lead better than its «Lider» card (same two numbers) — keep one.
    const dup = highlights.findIndex((h) => h.kind === 'leader' && h.compId === c.documentId);
    if (dup >= 0) highlights.splice(dup, 1);
    highlights.push({ kind: 'battle', id: `bat-${c.documentId}`, compId: c.documentId, compName: c.name, first: r!.rows[0], second: r!.rows[1], gap });
  }
  for (const c of ranked) {
    const top = extras[c.documentId]?.topCatches ?? [];
    if (top.length >= 3) highlights.push({ kind: 'top3', id: `top-${c.documentId}`, compId: c.documentId, compName: c.name, catches: top.slice(0, 3) });
  }

  return { extras, highlights, ticker: allW.slice(0, 8), heroId };
}

/* ---------------------------------------------------------------- upcoming */

export type Face = { name: string; src: string | null; followed: boolean };
export type UpcomingPeople = { faces: Record<string, Face[]>; followedNames: Record<string, string[]> };

export async function loadUpcoming(cards: CompetitionCard[]): Promise<UpcomingPeople> {
  const v = await viewer();
  const faces: Record<string, Face[]> = {};
  const followedNames: Record<string, string[]> = {};
  if (!v) {
    // Signed out: only the card's own faces (photos, no names).
    for (const c of cards) faces[c.documentId] = c.participantFaces.map((src, i) => ({ name: `Participant ${i + 1}`, src, followed: false }));
    return { faces, followedNames };
  }
  const tr = t();
  const following = await getAnglerFollowing(tr, v.documentId, { page: 1, pageSize: 100 }).catch(() => null);
  const followed = new Set((following?.data ?? []).map((a) => a.documentId));
  await Promise.all(
    cards.map(async (c) => {
      if (c.joinedCount === 0) {
        faces[c.documentId] = [];
        return;
      }
      const regs = await getCompetitionRegistrations(tr, c.documentId).catch(() => null);
      if (!regs) {
        faces[c.documentId] = c.participantFaces.map((src, i) => ({ name: `Participant ${i + 1}`, src, followed: false }));
        return;
      }
      const out: Face[] = [];
      for (const r of regs) {
        if (r.registrationStatus !== 'registered') continue;
        const people = r.participants ?? [];
        if (people.length) {
          for (const p of people) {
            out.push({ name: p.username ?? 'Pescar', src: p.avatar?.url ?? null, followed: followed.has(p.documentId) });
          }
        } else {
          const n = r.teamName?.trim() || r.guestName?.trim();
          if (n) out.push({ name: n, src: null, followed: false });
        }
      }
      // Followed first, then photos, then the rest (as Partiful / Luma lead with people you know).
      out.sort((a, b) => Number(b.followed) - Number(a.followed) || Number(!!b.src) - Number(!!a.src));
      faces[c.documentId] = out;
      followedNames[c.documentId] = out.filter((f) => f.followed).map((f) => f.name);
    }),
  );
  return { faces, followedNames };
}

/* ---------------------------------------------------------------- results */

export type ResultDetail = { ranking: MiniRanking | null; mine: { position: number; value: number | null } | null };

export async function loadResults(cards: CompetitionCard[]): Promise<Record<string, ResultDetail>> {
  const tr = t();
  const v = await viewer();
  const out: Record<string, ResultDetail> = {};
  await Promise.all(
    cards.map(async (c) => {
      const avatars = new Map<string, string>();
      for (const p of c.results?.podium ?? []) if (p.avatarUrls[0]) avatars.set(p.displayName, p.avatarUrls[0]);
      const rk = c.results?.hasCatches ? await getRankings(tr, c.documentId).catch(() => null) : null;
      const ranking = rk ? miniRanking(rk, avatars) : null;
      const me = v && ranking ? ranking.rows.find((r) => r.name === v.username) : null;
      out[c.documentId] = {
        ranking: ranking ? { ...ranking, rows: ranking.rows.slice(0, 8) } : null,
        mine: me ? { position: me.position, value: me.value } : null,
      };
    }),
  );
  return out;
}
