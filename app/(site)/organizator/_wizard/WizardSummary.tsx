'use client';

import { PhotoIcon } from '@heroicons/react/24/outline';
import { getRankingTypeLabel } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { T4Summary, type T4Row } from '@/components/templates/T4';
import { useWizard } from './context';
import { isLocalBanner } from './model';

/*
 * The right column from 1280 (T4 aside): what the competition holds so far, so the organizer sees
 * the whole thing while filling one step. Every row is the form's own value (never a guess); an
 * empty one prints «—» (T4Row null), so the card keeps its shape as the steps fill it.
 */

const DATE = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Bucharest' });

function dateRange(start?: string, end?: string): string | null {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const valid = (d: Date | null) => d !== null && !Number.isNaN(d.getTime());
  if (valid(s) && valid(e)) {
    const a = DATE.format(s!);
    const b = DATE.format(e!);
    return a === b ? a : `${a} – ${b}`;
  }
  if (valid(s)) return `din ${DATE.format(s!)}`;
  return null;
}

export function WizardSummary() {
  const { values, lake } = useWizard();
  const isTeam = values.competitionType === 'team';
  const limit = values.participantsLimit ? Number(values.participantsLimit) : NaN;
  const fee = values.registerFee !== undefined && values.registerFee !== '' ? Number(values.registerFee) : NaN;
  const sectors = values.sectors?.length ?? 0;
  const rows: T4Row[] = [
    { label: 'Perioada', value: dateRange(values.startDate, values.endDate) },
    { label: 'Tip', value: values.competitionType ? (isTeam ? 'Echipe' : 'Individual') : null },
    {
      label: 'Locuri',
      value: Number.isInteger(limit) && limit >= 1 ? formatCount(limit, isTeam ? 'echipă' : 'participant', isTeam ? 'echipe' : 'participanți') : null,
    },
    {
      label: 'Taxă',
      value: Number.isFinite(fee) ? (
        fee > 0 ? (
          <span className="tabular-nums">
            {fee} <span className="text-muted">RON</span>
          </span>
        ) : (
          'Gratuit'
        )
      ) : null,
    },
    { label: 'Clasament', value: getRankingTypeLabel(values.rankingType) ?? null },
    { label: 'Lac', value: values.lake ? (lake.data?.name ?? null) : null },
    { label: 'Sectoare', value: sectors > 0 ? formatCount(sectors, 'sector', 'sectoare') : null },
  ];
  const banner = values.banner;
  const name = values.name?.trim();
  return (
    <T4Summary
      title="Rezumat"
      header={
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-control bg-soft-fill text-muted">
            {banner ? (
              // A local pick is an object URL, a saved one the CMS's: a plain <img> serves both.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner} alt="" className="size-full object-cover" data-local={isLocalBanner(banner) || undefined} />
            ) : (
              <PhotoIcon aria-hidden className="size-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={name ? 't-heading block truncate text-ink' : 't-body block text-muted'}>{name || 'Competiție fără nume'}</span>
          </span>
        </div>
      }
      rows={rows}
    />
  );
}
