import 'server-only';
import type { Metadata } from 'next';
import { registrationCounts } from '@/core/competitions';
import { richTextToPlain } from '@/components/templates/T3/prose';
import { absoluteUrl } from '@/lib/routes';
import { competitionSummary, loadCompetition, type LooseCompetitionDetail } from './load';
import { COMPETITION_TABS, type CompetitionTab } from './tabs';

/*
 * The metadata of a competition route tab (/informatii, /participanti, /extra-cantare,
 * /regulament): its own title, description and canonical (each tab is its own page with its own
 * content), the competition's banner as the share image. Same cached core read as the page.
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
      const who = c.competitionType === 'team' ? (approved === 1 ? '1 echipă înscrisă' : `${approved} echipe înscrise`) : approved === 1 ? '1 participant înscris' : `${approved} participanți înscriși`;
      return clip(`${who} la concursul de pescuit ${c.name}${where}, pe standuri.`);
    }
    case 'extraCantare':
      return clip(`Cererile de extra cântar de la concursul de pescuit ${c.name}${where}.`);
  }
}

export async function competitionTabMetadata(id: string, tab: Exclude<CompetitionTab, 'clasament'>): Promise<Metadata> {
  const load = await loadCompetition(id);
  const label = COMPETITION_TABS.find(t => t.key === tab)!;
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: label.label, robots: { index: false } };
  const c = load.competition;
  const description = describe(c, tab);
  const canonical = label.href(c.documentId);
  const image = c.banner?.formats.large?.url ?? c.banner?.url;
  const title = `${label.label} · ${c.name}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}
