'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { DashboardSection, LINK_ACTION } from '@/components/templates/T5';
import { MEDAL } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { fmtKg, isWeighed, type TopAngler } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { AnglerAvatar, AnglerLink } from '../../../ape-publice/_components/venue/bits';

/*
 * «Top pescari» — fish TopAnglerRow + SectionHeaderRow (parity partide.statistici.c6): the period's
 * top 3, each the medal place, the avatar (initials on the angler's tone under the photo), the name
 * («Pescar» without one), «{n} partidă/partide · {n} captură/capturi» and the kilos, the leader's in
 * accent. A row opens the angler's profile (/pescari/[id]); the header's «Clasament ›» the full
 * ranking for the same period — left out while lib/partide-pages has no Clasament.
 * The top 3 are the server's first three, in its order (kg, ties by uid — CMS stats-aggregates),
 * exactly as fish's `topAnglers.slice(0, 3)`; no client re-sort, so the podium matches the app.
 * The row link has no aria-label: its name is its content («Locul 1», the name, the counts, the kg).
 */

export function TopAnglers({ anglers, rankingHref, className }: { anglers: TopAngler[]; rankingHref: string | null; className?: string }) {
  const top = anglers.slice(0, 3);
  return (
    <DashboardSection
      className={className}
      title="Top pescari"
      flush
      action={
        rankingHref ? (
          <Link href={rankingHref} className={cn(LINK_ACTION, '-my-3 inline-flex items-center gap-0.5')} data-testid="top-anglers-ranking">
            Clasament
            <ChevronRightIcon aria-hidden className="size-4" />
          </Link>
        ) : null
      }
    >
      <ol aria-label="Top pescari" className="divide-y divide-hairline border-t border-hairline" data-testid="top-anglers">
        {top.map((a, i) => (
          <TopAnglerRow key={a.uid} angler={a} rank={i + 1} />
        ))}
      </ol>
    </DashboardSection>
  );
}

export function TopAnglerRow({ angler, rank }: { angler: TopAngler; rank: number }) {
  const name = angler.name ?? 'Pescar';
  const weighed = isWeighed(angler.totalKg);
  return (
    <li data-testid="top-angler">
      <AnglerLink uid={angler.uid} className="flex min-h-14 items-center gap-3 px-4.5 py-3">
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full t-micro-strong tabular-nums', MEDAL[rank as 1 | 2 | 3] ?? 'text-muted')}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
        <AnglerAvatar uid={angler.uid} name={name} src={angler.avatarUrl} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate t-body-strong text-ink">{name}</span>
          <span className="t-caption text-muted">
            {formatCount(angler.partide, 'partidă', 'partide')} · {formatCount(angler.catches, 'captură', 'capturi')}
          </span>
        </span>
        {weighed ? (
          <span className="shrink-0 whitespace-nowrap" data-testid="top-angler-kg">
            <span className={cn('t-body-strong tabular-nums', rank === 1 ? 'text-accent-ink' : 'text-ink')}>{fmtKg(angler.totalKg)}</span>
            <span className="ms-0.5 t-caption text-muted">{' '}kg</span>
          </span>
        ) : (
          <span className="shrink-0 t-body-strong text-muted" data-testid="top-angler-kg">
            —<span className="sr-only"> nicio greutate</span>
          </span>
        )}
      </AnglerLink>
    </li>
  );
}
