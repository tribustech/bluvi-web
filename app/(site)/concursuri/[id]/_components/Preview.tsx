'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ClockIcon, InformationCircleIcon, Squares2X2Icon, UsersIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { competitionsKeys, rankingsKeys, type CompetitionWithMyStatus } from '@/core/competitions';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import type { CompetitionDates } from './CompetitionScreen';

/*
 * fish components/competition/CompetitionPreview.tsx (notStarted: the ranking is replaced by it):
 * countdown, «Competiția nu a început», details, registrations, sectors, the closing line.
 */
export function CompetitionPreview({ competition, dates }: { competition: CompetitionWithMyStatus; dates: CompetitionDates }) {
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  const pending = competition.registrations.filter(r => r.registrationStatus === 'pending').length;
  const limit = competition.participantsLimit;
  const stands = competition.sectors.reduce((n, s) => n + s.stands.length, 0);
  const progress = limit ? Math.min(100, (registered / limit) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 md:grid md:grid-cols-2 md:px-6 md:pt-6 xl:px-8">
      <Countdown competition={competition} className="md:col-span-2" />

      <Card icon={<InformationCircleIcon />} title="Competiția nu a început" className="md:col-span-2">
        <p className="t-body text-ink-2">
          Această competiție încă nu a început. Odată ce va începe, vei putea vedea clasamentul live, progresul
          participanților în timp real, statistici și multe altele. Revino la momentul potrivit pentru a urmări acțiunea!
        </p>
      </Card>

      <Card icon={<ClockIcon />} title="Detalii">
        <dl className="flex flex-col gap-2.5">
          <Row label="Durată">
            <Badge>{competitionDuration(competition.startDate, competition.endDate)}</Badge>
          </Row>
          <Row label="Începe">{dates.start}</Row>
          <Row label="Se termină">{dates.end}</Row>
          <Row label="Tip clasament">
            <Badge>{rankingTypeLabel(competition)}</Badge>
          </Row>
          <Row label="Tip competiție">
            <Badge color="gray">{participationType(competition)}</Badge>
          </Row>
        </dl>
      </Card>

      <Card icon={<UsersIcon />} title={limit ? `Înscrieri (${registered}/${limit})` : `Înscrieri (${registered})`}>
        {pending > 0 ? <p className="t-body text-status-pending-fg">({pending} în așteptare)</p> : null}
        {registered > 0 ? (
          limit ? (
            <div className="flex flex-col gap-1.5">
              <p className="flex justify-between t-body text-ink-2">
                Progres înscrieri <span className="font-bold text-accent-ink">{Math.round(progress)}%</span>
              </p>
              <div
                role="progressbar"
                aria-label="Progres înscrieri"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={registered}
                className="h-1.5 overflow-hidden rounded-full bg-accent-tint-2"
              >
                <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null
        ) : (
          <p className="t-body text-ink-2">Fii primul care se înscrie la această competiție!</p>
        )}
      </Card>

      <Card
        icon={<Squares2X2Icon />}
        title={`Sectoare: ${competition.sectors.length || '-'} | Standuri: ${stands || '-'}`}
        className="md:col-span-2"
      >
        {competition.sectors.length ? (
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {competition.sectors.map(s => (
              <li key={s.documentId} className="rounded-control bg-soft-fill px-3 py-2">
                <p className="t-body-strong">Sectorul {s.name}</p>
                <p className="t-caption text-muted">{s.stands.length} standuri</p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <p className="py-2 text-center t-body text-muted md:col-span-2">Revino când competiția începe pentru a vedea clasamentul live!</p>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0', className)}>
      <h2 className="flex items-center gap-2 t-heading">
        <span aria-hidden className="flex size-5 text-accent [&>svg]:size-5">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="t-body text-muted">{label}</dt>
      <dd className="text-right t-body">{children}</dd>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * fish CompetitionCountdown «COMPETIȚIA ÎNCEPE ÎN» ZILE : ORE : MIN : SEC. Ticks in the browser
 * only (no clock on the server render); at zero the competition and ranking are re-read.
 */
function Countdown({ competition, className }: { competition: CompetitionWithMyStatus; className?: string }) {
  const qc = useQueryClient();
  const start = new Date(competition.startDate).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const left = now === null ? null : Math.max(0, start - now);
  useEffect(() => {
    if (left !== 0) return;
    void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competition.documentId) });
    void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competition.documentId) });
  }, [left, qc, competition.documentId]);
  if (Number.isNaN(start)) return null;
  const s = left === null ? null : Math.floor(left / 1000);
  const units: [number | null, string][] = [
    [s === null ? null : Math.floor(s / 86400), 'ZILE'],
    [s === null ? null : Math.floor((s % 86400) / 3600), 'ORE'],
    [s === null ? null : Math.floor((s % 3600) / 60), 'MIN'],
    [s === null ? null : s % 60, 'SEC'],
  ];
  return (
    <section aria-label="Competiția începe în" className={cn('flex flex-col items-center gap-3 rounded-card bg-accent p-4 text-on-accent', className)}>
      <p className="flex items-center gap-2 t-body-strong">
        <ClockIcon aria-hidden className="size-5" />
        COMPETIȚIA ÎNCEPE ÎN
      </p>
      <p className="flex items-start gap-2" aria-live="off">
        {units.map(([value, label], i) => (
          <span key={label} className="flex items-start gap-2">
            {i > 0 ? <span aria-hidden className="mt-1.5 t-heading opacity-60">:</span> : null}
            <span className="flex flex-col items-center">
              <span className="flex min-w-12 justify-center rounded-control bg-on-accent/15 px-2 py-1.5 t-heading tabular-nums">
                {value === null ? '--' : pad(value)}
              </span>
              <span className="mt-1 t-micro opacity-80">{label}</span>
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}

/** fish helpers/getRankingType.ts */
function rankingTypeLabel(c: Pick<CompetitionWithMyStatus, 'bestOfFishCount' | 'bestOfTierSizes'> & { rankingType: string }): string {
  switch (c.rankingType) {
    case 'feederRounds':
      return 'Feeder';
    case 'quality':
      return 'Calitate';
    case 'quantity':
      return 'Cantitate';
    case 'quantityQuality':
      return 'Cantitate/Calitate';
    case 'qualityQuantity':
      return 'Calitate/Cantitate';
    case 'bestOf':
      return `Best of ${c.bestOfFishCount || ''}`;
    case 'nationalChampionship':
      return 'Campionat Național';
    case 'fipsed':
      return 'Campionat Mondial FIPSed';
    case 'calitateCalitate':
      return 'Calitate/Calitate';
    case 'calitateCantitateCMMC':
      return 'Cal/Cant/CMMC';
    case 'bestOfTiers':
      return c.bestOfTierSizes?.length ? `Best of ${c.bestOfTierSizes.join(', ')}` : 'Best of x, y, z...';
    default:
      // fish getRankingType returns nothing for a type it does not know.
      return '';
  }
}

/** fish helpers/getParticipationType.ts */
function participationType(c: Pick<CompetitionWithMyStatus, 'competitionType' | 'competitionStatus' | 'teamParticipants'>): string {
  if (c.competitionType === 'single') return 'Individual';
  if (c.competitionStatus !== 'notStarted') return 'Echipe';
  return c.teamParticipants ? `Echipe de ${c.teamParticipants}` : 'Echipe';
}

/** fish common/helpers/getCompetitionDuration.ts */
function competitionDuration(start: string, end: string): string {
  const totalHours = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
  if (totalHours <= 72) return `${totalHours} ${totalHours === 1 ? 'oră' : 'ore'}`;
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours - days * 24;
  const d = `${days} ${days === 1 ? 'zi' : 'zile'}`;
  return remainingHours === 0 ? d : `${d} și ${remainingHours} ${remainingHours === 1 ? 'oră' : 'ore'}`;
}
