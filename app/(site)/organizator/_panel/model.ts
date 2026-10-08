import type { BentoTone } from '@/components/ui/BentoTile';
import type { TagTone } from '@/components/cards/parts';
import { formatCount } from '@/core/realtime/chat/format';
import { getDisplayedDate } from '@/core/competitions/domain/listCard';
import { getRankingTypeLabel } from '@/core/competitions/domain/competitionLabels';
import { isApiError } from '@/core/transport';
import type { DraftCompetition, OrganizerDashboardStats, OrganizerStatDetailItem, OrganizerStatKey } from '@/core/organizer';

/*
 * The organizer panel's pure copy and derivations (organizer.panel, fish app/(app)/organizer/index.tsx,
 * components/StatDetailSheet.tsx, MiniatureDraftCard.tsx, CompetitionCard.tsx). No React here, so
 * every rule the e2e asserts on screen is also unit-tested (model.test.ts).
 */

/** fish ORGANIZER_COMPETITIONS_PAGE_SIZE (10 per status page; core's default). */
export const COMPETITIONS_PAGE_SIZE = 10;
/** fish ORGANIZER_STATS_PAGE_SIZE (5 per stat-detail page). */
export const STAT_DETAILS_PAGE_SIZE = 5;
/** fish ORGANIZER_LOTTIE_END_HOLD_MS — the header art holds its last frame this long, then replays. */
export const ART_HOLD_MS = 5000;
/** fish CancelCompetitionSheet REASON_MAX_LENGTH. */
export const REASON_MAX = 280;

/**
 * The four KPI tiles, in fish's order and colours (c3): amber pending, indigo empty spots, green
 * fill rate, slate total — on the kit's bento surfaces (owner rule 19): the amber tint, the indigo
 * tile, the mint tint and the signature navy (fish's slate #334155).
 */
export const STAT_KEYS = ['pending', 'empty', 'fill', 'total'] as const satisfies readonly OrganizerStatKey[];

export type StatTileModel = {
  key: OrganizerStatKey;
  /** fish label («Participanți\nîn așteptare»), one line here: the tile wraps it. */
  label: string;
  /** The compact chip's label (c7). */
  shortLabel: string;
  tone: Extract<BentoTone, 'amber' | 'indigo' | 'mint' | 'signature'>;
  value: number;
  /** «%» for the fill rate — a separate, smaller unit (owner rule 10). */
  unit?: string;
  /** c4: only the pending figure pulses, and only while it is > 0. */
  pulse: boolean;
};

const STAT_COPY: Record<OrganizerStatKey, { label: string; shortLabel: string; tone: StatTileModel['tone'] }> = {
  pending: { label: 'Participanți în așteptare', shortLabel: 'În așteptare', tone: 'amber' },
  empty: { label: 'Locuri libere', shortLabel: 'Locuri libere', tone: 'indigo' },
  fill: { label: 'Rată de ocupare', shortLabel: 'Ocupare', tone: 'mint' },
  total: { label: 'Total organizate', shortLabel: 'Organizate', tone: 'signature' },
};

export function statTiles(stats: OrganizerDashboardStats): StatTileModel[] {
  const value: Record<OrganizerStatKey, number> = {
    pending: stats.pendingRegistrations,
    empty: stats.emptySpots,
    fill: stats.fillRate,
    total: stats.totalOrganized,
  };
  return STAT_KEYS.map((key) => ({
    key,
    ...STAT_COPY[key],
    value: value[key],
    unit: key === 'fill' ? '%' : undefined,
    pulse: key === 'pending' && stats.pendingRegistrations > 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Stat detail panel — fish StatDetailSheet                            */
/* ------------------------------------------------------------------ */

export type StatDetailCopy = { title: string; emptyMessage: string; tone: StatTileModel['tone'] };

/** c8 / c10: the panel's title and its per-key empty message. */
export const STAT_DETAIL: Record<OrganizerStatKey, StatDetailCopy> = {
  pending: { title: 'Participanți în așteptare', emptyMessage: 'Niciun participant în așteptare.', tone: 'amber' },
  empty: { title: 'Locuri libere', emptyMessage: 'Nicio competiție cu locuri libere.', tone: 'indigo' },
  fill: { title: 'Rată de ocupare', emptyMessage: 'Nicio competiție activă.', tone: 'mint' },
  total: { title: 'Total organizate', emptyMessage: 'Nu ai organizat nicio competiție încă.', tone: 'signature' },
};

/** «12/20 participanți» (fish), or «12 participanți» when the competition has no limit. */
export function participantsLine(registered: number, limit: number | null | undefined): string {
  return limit ? `${registered}/${limit} participanți` : formatCount(registered, 'participant', 'participanți');
}

/**
 * c9: the coloured value pill of a stat-detail row (fish STAT_CONFIG.formatValue), with Romanian
 * plurals («1 loc liber», «20 de locuri libere»).
 */
export function statDetailValue(key: OrganizerStatKey, item: OrganizerStatDetailItem): string {
  switch (key) {
    case 'pending':
      return `${item.pendingRegistrationsCount} în așteptare`;
    case 'empty':
      return formatCount(item.emptySpotsCount, 'loc liber', 'locuri libere');
    case 'fill':
      return `${item.fillRate}% ocupare`;
    case 'total':
      return `${item.competition.participantsRegistered ?? 0}/${item.competition.participantsLimit ?? 0} participanți`;
  }
}

/** c9: the status badge of a row (fish STATUS_BADGE). */
export const STATUS_BADGE: Record<string, { label: string; tone: TagTone }> = {
  draft: { label: 'Ciornă', tone: 'gray' },
  notStarted: { label: 'În viitor', tone: 'indigo' },
  started: { label: 'Live', tone: 'green' },
  completed: { label: 'Încheiat', tone: 'gray' },
  cancelled: { label: 'Anulat', tone: 'red' },
};

/** c9: the date range, uppercased (fish getDisplayedDate(...).toUpperCase()); null without both ends. */
export function dateRangeLabel(start: string | null | undefined, end: string | null | undefined, now = new Date()): string | null {
  return start && end ? getDisplayedDate(start, end, now).toUpperCase() : null;
}

/* ------------------------------------------------------------------ */
/* Tabs — fish FILTER_TABS                                             */
/* ------------------------------------------------------------------ */

export const TABS = [
  { key: 'draft', label: 'Ciorne' },
  { key: 'notStarted', label: 'Viitoare' },
  { key: 'started', label: 'Live' },
  { key: 'completed', label: 'Încheiate' },
  { key: 'cancelled', label: 'Anulate' },
] as const;
export type TabKey = (typeof TABS)[number]['key'];

/** c13: draftsCount for Ciorne, byStatus.<status> for the rest (a badge only when > 0). */
export function tabCounts(stats: OrganizerDashboardStats | undefined): Partial<Record<TabKey, number>> {
  if (!stats) return {};
  return {
    draft: stats.draftsCount,
    notStarted: stats.byStatus.notStarted ?? 0,
    started: stats.byStatus.started ?? 0,
    completed: stats.byStatus.completed ?? 0,
    cancelled: stats.byStatus.cancelled ?? 0,
  };
}

/** c16: the empty copy of a tab. */
export const emptyCopy = (tab: TabKey) => (tab === 'draft' ? 'Nu ai ciorne. Creează o competiție nouă!' : 'Nu ai competiții în această categorie.');

/* ------------------------------------------------------------------ */
/* Cards — fish MiniatureDraftCard / CompetitionCard (compact)         */
/* ------------------------------------------------------------------ */

type Img = NonNullable<DraftCompetition['banner']>;
const formatUrl = (img: Img | null | undefined, f: 'small' | 'thumbnail'): string | undefined => {
  const formats = img?.formats as Record<string, { url?: string } | undefined> | null | undefined;
  return formats?.[f]?.url ?? undefined;
};

/** c17: the draft's banner, small → thumbnail → original; null → the indigo placeholder. */
export function draftImage(draft: Pick<DraftCompetition, 'banner'>): string | null {
  const b = draft.banner;
  return formatUrl(b, 'small') || formatUrl(b, 'thumbnail') || b?.url || null;
}

/** c17: «Pas N/5», N = draftMeta.completedSteps length. */
export const draftStep = (draft: Pick<DraftCompetition, 'draftMeta'>) => `Pas ${draft.draftMeta?.completedSteps?.length ?? 0}/5`;

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'] as const;
const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric' });

/** c17: fish `format(startDate, 'd MMM yyyy')`, in Romanian and Bucharest time («5 oct. 2026»). */
export function draftDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of dayParts.formatToParts(d)) p[x.type] = x.value;
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/** The compact card's photo: the banner, else the lake's first photo (fish `banner || lake.images[0]`). */
export function cardImage(c: Pick<DraftCompetition, 'banner' | 'lake'>): string | null {
  const img = c.banner ?? c.lake?.images?.[0] ?? null;
  return formatUrl(img, 'small') || formatUrl(img, 'thumbnail') || img?.url || null;
}

export type CardStatusPill = { live: true } | { live: false; label: string; tone: 'info' | 'neutral' | 'danger' } | null;

/** The pill on a compact card's photo: LIVE, or the status (fish: viewers pills; the panel names the tab state). */
export function cardStatus(status: DraftCompetition['competitionStatus']): CardStatusPill {
  if (status === 'started') return { live: true };
  if (status === 'notStarted') return { live: false, label: 'Viitor', tone: 'info' };
  if (status === 'completed') return { live: false, label: 'Încheiat', tone: 'neutral' };
  if (status === 'cancelled') return { live: false, label: 'Anulat', tone: 'danger' };
  return null;
}

/** fish CompetitionCard: registered/limit (21 when unset) «pescari» or «echipe», and the pending count while notStarted. */
export function cardParticipants(c: Pick<DraftCompetition, 'registrations' | 'participantsLimit' | 'competitionType' | 'competitionStatus'>) {
  const regs = c.registrations ?? [];
  const registered = regs.filter((r) => r.registrationStatus === 'registered').length;
  const pending = regs.filter((r) => r.registrationStatus === 'pending').length;
  const noun = c.competitionType === 'single' ? 'pescari' : 'echipe';
  return {
    line: `${registered}/${c.participantsLimit || 21} ${noun}`,
    pending: pending > 0 && c.competitionStatus === 'notStarted' ? `${pending} în așteptare` : null,
  };
}

/** fish CompetitionCard badges: Individual / Echipe (green) and the ranking type (yellow). */
export function cardBadges(c: Pick<DraftCompetition, 'competitionType' | 'rankingType' | 'bestOfFishCount' | 'bestOfTierSizes'>) {
  const ranking = c.rankingType
    ? getRankingTypeLabel({ rankingType: c.rankingType, bestOfFishCount: c.bestOfFishCount, bestOfTierSizes: c.bestOfTierSizes })
    : '';
  return [
    { label: c.competitionType === 'single' ? 'Individual' : 'Echipe', tone: 'green' as const },
    ...(ranking ? [{ label: ranking, tone: 'yellow' as const }] : []),
  ];
}

/**
 * organizer.b.card-edit-entry: «Modifică» on the organizer's own cards — notStarted opens the edit
 * wizard (returning here), started shows the cannot-edit notice; nothing for the rest.
 */
export function editEntry(status: DraftCompetition['competitionStatus']): 'wizard' | 'notice' | null {
  return status === 'notStarted' ? 'wizard' : status === 'started' ? 'notice' : null;
}

/** c22: only notStarted competitions can be cancelled from the panel. */
export const canCancel = (status: DraftCompetition['competitionStatus']) => status === 'notStarted';

/* ------------------------------------------------------------------ */
/* Writes — fish handleDeleteDraft / handleConfirmCancel               */
/* ------------------------------------------------------------------ */

/** c25: the trimmed reason, or undefined when blank (core omits it from the body then). */
export function cancelReason(raw: string): string | undefined {
  const t = raw.trim();
  return t ? t : undefined;
}

/** c25: the success toast — the variant when some participants could not be notified. */
export const cancelledToast = (failedNotifications: number) =>
  failedNotifications > 0 ? 'Competiția a fost anulată. Unii participanți ar putea să nu primească notificarea.' : 'Competiția a fost anulată.';

/**
 * The toast of a failed write: the server's own message when it sent one the app handles (a
 * bluCode error keeps its message — core ApiError), else the screen's fallback (fish
 * `error?.message || fallback`; the web never shows the generic transport text instead).
 */
export function writeErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) && error.bluCode && error.message ? error.message : fallback;
}

export const DELETE_DRAFT_ERROR = 'A apărut o eroare la ștergerea ciornei.';
export const CANCEL_ERROR = 'A apărut o eroare la anularea competiției.';
