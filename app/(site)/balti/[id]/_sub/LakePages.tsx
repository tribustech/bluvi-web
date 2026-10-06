import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { FOCUS_RING } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import type { StatsPeriod } from '@/core/partide';
import { routes } from '@/lib/routes';

/*
 * «Pe această baltă» — the lake's pages, the same list in the left column of Partide, Statistici and
 * Recenzii from 1280 (the current one marked aria-current="page"), so moving between them works the
 * same way on each: the community pages (the rankings carry the period in view —
 * lakes.b.period-and-sort-in-url), then the lake's own (reviews, photos, map, competitions).
 * TODO(kit): ape-publice WaterPages is the same nav for a public water — one VenuePages in the kit.
 */

export type LakePage = 'partide' | 'statistici' | 'clasament' | 'standuri' | 'capturi' | 'recenzii' | 'galerie' | 'harta' | 'concursuri';

export function LakePages({ lakeId, current, period }: { lakeId: string; current: LakePage; period?: StatsPeriod }) {
  const groups: { key: LakePage; label: string; href: string }[][] = [
    [
      { key: 'partide', label: 'Partide', href: routes.lakePartide(lakeId) },
      { key: 'statistici', label: 'Statistici', href: routes.lakeStats(lakeId, period) },
      { key: 'clasament', label: 'Clasament pescari', href: routes.lakeRanking(lakeId, period) },
      { key: 'standuri', label: 'Clasament standuri', href: routes.lakeStands(lakeId, { perioada: period }) },
      { key: 'capturi', label: 'Capturi', href: routes.lakeCatches(lakeId) },
    ],
    [
      { key: 'recenzii', label: 'Recenzii', href: routes.lakeReviews(lakeId) },
      { key: 'galerie', label: 'Galerie', href: routes.lakeGallery(lakeId) },
      { key: 'harta', label: 'Hartă', href: routes.lakeMap(lakeId) },
      { key: 'concursuri', label: 'Concursuri', href: routes.lakeCompetitions(lakeId) },
    ],
  ];
  return (
    <nav aria-label="Pe această baltă" className="flex min-w-0 flex-col" data-testid="lake-pages">
      <p aria-hidden className="mb-2.5 t-eyebrow text-muted uppercase">
        Pe această baltă
      </p>
      {groups.map((pages, g) => (
        <ul key={g} className={cn('-mx-2 flex flex-col gap-0.5', g > 0 && 'mt-2 border-t border-hairline pt-2')}>
          {pages.map(p => {
            const on = p.key === current;
            return (
              <li key={p.key}>
                <Link
                  href={p.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-10 items-center justify-between gap-2 rounded-control px-2 py-2 transition-colors duration-(--duration-fast)',
                    // The current page is navigation, not a chosen value: strong ink and a 3px accent
                    // bar on the left edge — never the tint + check of a selected filter (Perioadă).
                    on
                      ? "t-body-strong text-ink before:absolute before:inset-y-2 before:-left-0.5 before:w-0.75 before:rounded-full before:bg-accent before:content-['']"
                      : 't-body text-ink-2 hover:bg-soft-fill hover:text-ink',
                    FOCUS_RING,
                  )}
                >
                  {p.label}
                  {on ? null : <ChevronRightIcon aria-hidden className="size-5 text-muted" />}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
