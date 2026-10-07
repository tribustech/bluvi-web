import 'server-only';
import type { Metadata } from 'next';
import { registrationCounts } from '@/core/competitions';
import { richTextToPlain } from '@/components/templates/T3/prose';
import { absoluteUrl, routes } from '@/lib/routes';
import { registeredLine } from '@/lib/seo/describe';
import { competitionFacts, competitionViewHas } from '@/lib/server/sitemap-entries';
import { createServerTransport } from '@/lib/server/transport';
import { bounded, competitionSummary, loadCompetition, type LooseCompetitionDetail } from './load';
import { COMPETITION_TABS, type CompetitionTab } from './tabs';

/*
 * The metadata of a competition route tab (/informatii, /participanti, /extra-cantare,
 * /regulament) and of the Clasament's views with their own content (/cantare, /capturi,
 * /statistici): its own title, description and canonical, Open Graph and a large Twitter card.
 * Same cached core read as the page. No image keys: the routes' generated opengraph-image /
 * twitter-image files provide the share image (global.seo-og).
 * A tab with nothing of its own to show — Regulament without a regulation, Participanți with
 * nobody registered — is `noindex, follow` (global.b.seo-metadata; the sitemap leaves it out too).
 * Extra Cântare is `noindex, follow` at every stage: a utility list of the competitors' requests,
 * read in the browser (nothing of it is in the server's HTML), never listed — like Statistici.
 */

const MAX_DESCRIPTION = 160;

function clip(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= MAX_DESCRIPTION ? t : `${t.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, '')}…`;
}

function describe(c: LooseCompetitionDetail, tab: Exclude<CompetitionTab, 'clasament'>): string {
  const where = c.lake?.name ? ` de pe ${c.lake.name}` : '';
  switch (tab) {
    case 'informatii': {
      const text = richTextToPlain(c.description);
      return clip(text ? `${c.name}: ${text}` : competitionSummary(c));
    }
    case 'regulament': {
      const text = richTextToPlain(c.regulation);
      return clip(text ? `Regulamentul concursului ${c.name}: ${text}` : `Regulamentul concursului de pescuit ${c.name}${where}.`);
    }
    case 'participanti': {
      const { approved } = registrationCounts(c.registrations);
      // Nobody registered yet: a neutral line, never «0 participanți» (rule 4) — it is the share preview.
      if (approved === 0) return clip(`Lista participanților la concursul de pescuit ${c.name}${where}.`);
      return clip(`${registeredLine(approved, c.competitionType === 'team')} la concursul de pescuit ${c.name}${where}.`);
    }
    case 'extraCantare':
      return clip(`Cererile de extra cântar de la concursul de pescuit ${c.name}${where}.`);
  }
}

function pageMetadata(title: string, description: string, canonical: string, noindex = false): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export async function competitionTabMetadata(id: string, tab: Exclude<CompetitionTab, 'clasament'>): Promise<Metadata> {
  const load = await loadCompetition(id);
  const label = COMPETITION_TABS.find(t => t.key === tab)!;
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: label.label, robots: { index: false } };
  const c = load.competition;
  const empty =
    tab === 'extraCantare' ||
    (tab === 'regulament' && !richTextToPlain(c.regulation)) ||
    (tab === 'participanti' && registrationCounts(c.registrations).approved === 0);
  return pageMetadata(`${label.label} · ${c.name}`, describe(c, tab), label.href(c.documentId), empty);
}

/** The Clasament's views that are pages of their own (their own path, canonical and content). */
export type CompetitionView = 'cantare' | 'capturi' | 'statistici';

const VIEW: Record<CompetitionView, { label: string; href: (id: string) => string; describe: (c: LooseCompetitionDetail, where: string) => string }> = {
  cantare: {
    label: 'Cântare',
    href: routes.competitionWeighings,
    describe: (c, where) => `Cântările concursului de pescuit ${c.name}${where}: stand cu stand, fiecare cântar cu greutatea și peștii.`,
  },
  capturi: {
    label: 'Toți peștii',
    href: routes.competitionCatches,
    describe: (c, where) => `Toți peștii prinși la concursul de pescuit ${c.name}${where}: specia, greutatea, standul și pescarul.`,
  },
  statistici: {
    label: 'Statistici',
    href: routes.competitionStatistics,
    describe: (c, where) => `Statisticile concursului de pescuit ${c.name}${where}: capturi, kilograme și evoluția pe standuri.`,
  },
};

/**
 * A Clasament view's metadata. Before the start the views show the competition's preview — the
 * page's own content —, so they canonicalise to /concursuri/<id>. Statistici is for signed-in
 * users (a guest sees the sign-in prompt): `noindex, follow` at every stage. Once started, Cântare
 * without a weighing and Toți peștii without a catch have nothing of their own to show: `noindex,
 * follow` — the sitemap's predicate (competitionViewHas over the same cached weighing statistics),
 * so the two cannot disagree. A failed / slow read is unknown: never noindexed.
 */
export async function competitionViewMetadata(id: string, view: CompetitionView): Promise<Metadata> {
  const load = await loadCompetition(id);
  const v = VIEW[view];
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: v.label, robots: { index: false } };
  const c = load.competition;
  const where = c.lake?.name ? ` de pe ${c.lake.name}` : '';
  const started = c.competitionStatus === 'started' || c.competitionStatus === 'completed';
  const canonical = started ? v.href(c.documentId) : routes.competition(c.documentId);
  let empty = view === 'statistici';
  if (started && view !== 'statistici') {
    const facts = await bounded(competitionFacts(createServerTransport(), c.documentId), `weighing-statistics ${c.documentId}`).catch(() => null);
    empty = facts !== null && competitionViewHas(view, facts) === false;
  }
  // Nothing weighed / caught yet: a plain line that promises no rows (rule 4).
  const description =
    empty && view === 'cantare'
      ? `Cântările concursului de pescuit ${c.name}${where}.`
      : empty && view === 'capturi'
        ? `Peștii prinși la concursul de pescuit ${c.name}${where}.`
        : v.describe(c, where);
  return pageMetadata(`${v.label} · ${c.name}`, clip(description), canonical, empty);
}
