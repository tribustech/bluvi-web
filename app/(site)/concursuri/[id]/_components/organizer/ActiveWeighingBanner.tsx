'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import type { CompetitionActiveWeighing } from '@/core/organizer';
import { LiveDot } from '@/components/templates/LiveDot';
import { routes } from '@/lib/routes';
import { nationalStandLabel, standLabel } from '../stand';

/*
 * organizer.b.active-weighing-banner — WEB DEVIATION awaiting the owner's decision (parity status
 * partial): in fish the competition page's banner always opens the weighing's read-only detail, for
 * the author and the referees too (app/(app)/competitions/[competitionId].tsx:186-201, passed at 537
 * — the scale branch in components/ActiveWeighingBanner.tsx:38-43 never runs from that page). The web
 * sends the author or a referee of a running competition to the scale page instead
 * (/concursuri/[id]/cantar/[stand]/[weighing], where catches are added and the weighing is closed);
 * everyone else keeps the read-only detail (shell.c25, ActionBar ActiveWeighingBanner).
 *
 *  - `scaleHrefOf`: the phone banner's target for a manager (CompetitionScreen passes it to the bar's
 *    banner, which keeps its look and its «several» list), and from 768 the Clasament bento's
 *    «Cântar în curs» tile link («Deschide în cântar», DesktopStats `scaleHrefOf`).
 *  - `ManagerWeighingNotice`: from 768, only where no bento says it already (the route tabs, or a
 *    Clasament without the summary row): one compact line per weighing in progress,
 *    «Cântar în curs pe standul A3 · Deschide în cântar». Static in the flow (owner rule 3).
 */

/** The scale page of a weighing in progress; null when its stand has no sector (fish does nothing then). */
export function scaleHrefOf(
  competitionId: string,
  w: CompetitionActiveWeighing,
): string | null {
  if (!w.stand?.sectors.length) return null;
  return routes.competitionScaleWeighing(
    competitionId,
    w.stand.documentId,
    w.weighingDocumentId,
  );
}

const labelOf = (w: CompetitionActiveWeighing, isNc: boolean) =>
  isNc
    ? nationalStandLabel(
        w.stand.sectors[0]?.name,
        w.stand.sectorDrawPosition,
        w.stand.name,
      )
    : standLabel(w.stand.sectors[0]?.name ?? '', w.stand.name);

export function ManagerWeighingNotice({
  competitionId,
  weighings,
  isNc,
}: {
  competitionId: string;
  weighings: CompetitionActiveWeighing[] | undefined;
  isNc: boolean;
}) {
  const open = (weighings ?? []).filter(
    (w) => w.stand && scaleHrefOf(competitionId, w),
  );
  if (open.length === 0) return null;
  return (
    // The T3 body's gutters (DetailBody md:px-6 / xl:px-8): the line lines up with the content under it.
    <div className="max-md:hidden md:px-6 md:pt-4 xl:px-8">
      <ul aria-label="Cântare în curs" data-testid="manager-weighing-notice" className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {open.map((w) => (
          <li key={w.weighingDocumentId} className="flex min-w-0 items-center gap-2 t-body text-ink">
            <LiveDot />
            <span>
              {w.weighingType === 'normal' ? 'Cântar' : 'Extra-cântar'} în curs pe standul{' '}
              <span className="t-body-strong">{labelOf(w, isNc)}</span>
            </span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <Link
              href={scaleHrefOf(competitionId, w)!}
              className="inline-flex min-h-10 items-center gap-1 rounded-control t-body-strong text-accent-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
            >
              Deschide în cântar
              <ArrowRightIcon aria-hidden className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
