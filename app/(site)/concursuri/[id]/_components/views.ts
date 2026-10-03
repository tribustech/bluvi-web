import type { ComponentType, SVGProps } from 'react';
import { PresentationChartBarIcon, QueueListIcon, ScaleIcon, TrophyIcon } from '@heroicons/react/24/solid';

/** fish CompetitionRanking `rankingView`. */
export type RankingViewKey = 'clasament' | 'cantare' | 'statistici' | 'allFish';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish `VIEW_CHIP_CONFIG`, same order and labels. The chip colours are fish's Material hues; the
 * web has no tokens for them, so they borrow the nearest sector tokens (sector-b is fish's
 * #E64A19 exactly, sector-m is #00796B for #009688) and the accent for the two indigos.
 */
export const VIEWS: { key: RankingViewKey; label: string; Icon: Icon; fill: string; text: string }[] = [
  { key: 'clasament', label: 'Clasament', Icon: TrophyIcon, fill: 'bg-accent-ink', text: 'text-accent-ink' },
  { key: 'cantare', label: 'Cântare', Icon: ScaleIcon, fill: 'bg-sector-b', text: 'text-sector-b' },
  { key: 'statistici', label: 'Statistici', Icon: PresentationChartBarIcon, fill: 'bg-accent', text: 'text-accent' },
  { key: 'allFish', label: 'Toți peștii', Icon: QueueListIcon, fill: 'bg-sector-m', text: 'text-sector-m' },
];
