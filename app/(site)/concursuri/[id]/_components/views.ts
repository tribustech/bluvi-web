import type { ComponentType, SVGProps } from 'react';
import { PresentationChartBarIcon, QueueListIcon, ScaleIcon, TrophyIcon } from '@heroicons/react/24/outline';

/** fish CompetitionRanking `rankingView`. */
export type RankingViewKey = 'clasament' | 'cantare' | 'statistici' | 'allFish';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish `VIEW_CHIP_CONFIG`, same order and labels. fish paints each chip its own Material hue; on
 * the web indigo is the only accent (Fundații §01), so every view gets the same treatment
 * (ViewSwitch) and the icons are the 24 outline set (§05).
 */
export const VIEWS: { key: RankingViewKey; label: string; Icon: Icon }[] = [
  { key: 'clasament', label: 'Clasament', Icon: TrophyIcon },
  { key: 'cantare', label: 'Cântare', Icon: ScaleIcon },
  { key: 'statistici', label: 'Statistici', Icon: PresentationChartBarIcon },
  { key: 'allFish', label: 'Toți peștii', Icon: QueueListIcon },
];

/**
 * The views other than Clasament are addressable as path segments (parity
 * competition-page.b.tab-deep-links): /concursuri/<id>/cantare | statistici | capturi. Clasament is
 * the page itself (/concursuri/<id>, or /clasament). The old `?vedere=` links redirect to them.
 */
export const VIEW_PARAM = 'vedere';

const SEGMENT: Record<RankingViewKey, string | null> = {
  clasament: null,
  cantare: 'cantare',
  statistici: 'statistici',
  allFish: 'capturi',
};

/** The URL of a view of the competition `base` (/concursuri/<id>). */
export const viewPath = (base: string, key: RankingViewKey): string => (SEGMENT[key] ? `${base}/${SEGMENT[key]}` : base);

/** The view a segment / `?vedere=` value names; anything unknown is Clasament. */
export function viewFromSegment(value: string | null | undefined): RankingViewKey {
  const hit = (Object.keys(SEGMENT) as RankingViewKey[]).find(k => SEGMENT[k] !== null && SEGMENT[k] === value);
  return hit ?? 'clasament';
}

/** The view a pathname shows: its last segment after /concursuri/<id>. */
export function viewFromPath(pathname: string): RankingViewKey {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 2 ? viewFromSegment(parts[2]) : 'clasament';
}
