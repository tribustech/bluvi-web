import { routes } from '@/lib/routes';

/*
 * The competition's route tabs (fish ROUTES_LIST, same order and labels): Clasament is the page
 * itself (/concursuri/<id>), each other tab its own path segment (parity
 * competition-page.b.tab-deep-links). Every tab has its web page (M1 batch 2), so links into a tab
 * (the preview's «Vezi toate informațiile» / «Vezi toate înscrierile», the Informații participants
 * row, the tab strip) always resolve.
 */
export type CompetitionTab = 'clasament' | 'informatii' | 'participanti' | 'extraCantare' | 'regulament';

export const COMPETITION_TABS: { key: CompetitionTab; label: string; href: (id: string) => string }[] = [
  { key: 'clasament', label: 'Clasament', href: routes.competition },
  { key: 'informatii', label: 'Informații', href: routes.competitionInfo },
  { key: 'participanti', label: 'Participanți', href: routes.competitionParticipants },
  { key: 'extraCantare', label: 'Extra Cântare', href: routes.competitionExtraScales },
  { key: 'regulament', label: 'Regulament', href: routes.competitionRules },
];

export const tabLabel = (tab: CompetitionTab): string => COMPETITION_TABS.find(t => t.key === tab)?.label ?? 'Clasament';

/** Kept for the preview's links (Preview.tsx): every tab is on the web now. */
export const TAB_ON_WEB = {
  informatii: true,
  participanti: true,
  extraCantare: true,
  regulament: true,
} as const;
