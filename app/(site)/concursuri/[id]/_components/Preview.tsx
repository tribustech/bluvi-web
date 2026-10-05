'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { competitionsKeys, rankingsKeys, type CompetitionWithMyStatus } from '@/core/competitions';
import { DetailBody, DetailSection } from '@/components/templates/T3';
import { plural } from '@/components/cards/format';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/BentoTile';
import { StatusPill } from '@/components/ui/StatusPill';
import type { CompetitionDates } from './CompetitionScreen';

/*
 * fish components/competition/CompetitionPreview.tsx (notStarted: the ranking is replaced by it):
 * countdown, «Competiția nu a început», details, registrations, sectors, the closing line — on the
 * T3 body and section cards; the countdown is the Fundații StatTile «Începe în 4 zile».
 */
export function CompetitionPreview({ competition, dates }: { competition: CompetitionWithMyStatus; dates: CompetitionDates }) {
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  const pending = competition.registrations.filter(r => r.registrationStatus === 'pending').length;
  const limit = competition.participantsLimit;
  const stands = competition.sectors.reduce((n, s) => n + s.stands.length, 0);

  return (
    <DetailBody>
      {/* From 768 the countdown and the notice share a row (a lone tile would stretch to 1200px). */}
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:gap-5">
        <Countdown competition={competition} caption={dates.startShort} />
        <DetailSection title="Competiția nu a început">
          <p className="t-body text-ink-2">
            Această competiție încă nu a început. Odată ce va începe, vei putea vedea clasamentul live, progresul
            participanților în timp real, statistici și multe altele. Revino la momentul potrivit pentru a urmări acțiunea!
          </p>
        </DetailSection>
      </div>

      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:gap-5">
        <DetailSection title="Detalii">
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
        </DetailSection>

        {/*
          Registrations: the kit StatTile (label, «12/48», the kit's progress bar) — the same shape
          as the countdown above it; pending registrations are a state, the «în așteptare» pill.
        */}
        <section aria-label="Înscrieri" className="max-md:bg-surface max-md:p-4">
          <StatTile
            tone="surface"
            label="Înscrieri"
            value={registered}
            unit={limit ? `/${limit}` : undefined}
            unitTone="faint"
            progress={limit ? { value: registered, max: limit, label: 'Progres înscrieri' } : undefined}
            caption={
              registered === 0 || pending > 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  {registered === 0 ? <span>Fii primul care se înscrie la această competiție!</span> : null}
                  {pending > 0 ? <StatusPill tone="pending">{pending} în așteptare</StatusPill> : null}
                </span>
              ) : undefined
            }
            className="h-full max-md:bg-page md:shadow-e0"
          />
        </section>
      </div>

      <DetailSection title={`Sectoare: ${competition.sectors.length || '–'} · Standuri: ${stands || '–'}`}>
        {competition.sectors.length ? (
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {competition.sectors.map(s => (
              <li key={s.documentId} className="rounded-control bg-soft-fill px-3 py-2">
                <p className="t-body-strong">Sector {s.name}</p>
                <p className="t-caption text-muted">{plural(s.stands.length, 'stand', 'standuri')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-body text-muted">Sectoarele nu au fost stabilite încă.</p>
        )}
      </DetailSection>

      {/* fish's closing line («Revino când competiția începe…») is not repeated: the notice card says it. */}
    </DetailBody>
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
 * fish CompetitionCountdown, as the Fundații StatTile «Începe în 4 zile · sâm, 11 oct · 07:00»:
 * the largest unit as the signature number, the rest (ore · min · sec) ticking in the caption.
 * Ticks in the browser only (no clock on the server render: a bone until then). The slot never
 * goes away after hydration (it would shift the row): once the start has passed while the CMS still
 * says «notStarted» (its cron has not run yet), the tile says the start is late and the competition
 * is re-read every minute until it starts. If the start passes during the visit, both the
 * competition and the ranking are re-read at once.
 */
function Countdown({ competition, caption }: { competition: CompetitionWithMyStatus; caption: string }) {
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
  // Re-read once, when the countdown crosses zero during the visit (not on a mount after the start).
  const previous = useRef<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = left;
    if (left !== 0 || before === null || before === 0) return;
    void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competition.documentId) });
    void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competition.documentId) });
  }, [left, qc, competition.documentId]);
  // Late start: re-read the competition every minute (the page switches to the ranking when it starts).
  const late = left === 0;
  useEffect(() => {
    if (!late) return;
    const id = setInterval(() => void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competition.documentId) }), 60_000);
    return () => clearInterval(id);
  }, [late, qc, competition.documentId]);

  if (Number.isNaN(start)) return null;
  if (late) {
    return (
      <section aria-label="Startul competiției" className="max-md:bg-surface max-md:p-4">
        <StatTile
          tone="surface"
          label="Competiția începe în"
          value={<span className="text-muted">0</span>}
          unit=" min"
          caption={
            <span className="flex flex-col gap-0.5">
              <span className="t-body-strong text-ink-2">Startul e întârziat · se actualizează</span>
              <span>{caption}</span>
            </span>
          }
          className="h-full max-md:bg-page md:shadow-e0"
        />
      </section>
    );
  }
  const s = left === null ? null : Math.floor(left / 1000);
  const days = s === null ? 0 : Math.floor(s / 86400);
  const hours = s === null ? 0 : Math.floor((s % 86400) / 3600);
  const minutes = s === null ? 0 : Math.floor((s % 3600) / 60);
  const seconds = s === null ? 0 : s % 60;
  // The signature number is the largest unit that is not zero.
  const [value, unit] =
    days > 0 ? [days, days === 1 ? ' zi' : ' zile'] : hours > 0 ? [hours, hours === 1 ? ' oră' : ' ore'] : [minutes, ' min'];
  const rest = days > 0 ? `${pad(hours)} ore · ${pad(minutes)} min · ${pad(seconds)} sec` : hours > 0 ? `${pad(minutes)} min · ${pad(seconds)} sec` : `${pad(seconds)} sec`;

  return (
    <section aria-label="Competiția începe în" className="max-md:bg-surface max-md:p-4">
      <StatTile
        tone="surface"
        label="Competiția începe în"
        value={s === null ? <span aria-hidden className="inline-block h-10 w-16 animate-shimmer rounded-control align-middle" /> : value}
        unit={s === null ? undefined : unit}
        caption={
          <span className="flex flex-col gap-0.5">
            {/* Ticking every second: kept out of the accessibility tree's live announcements. */}
            <span aria-live="off" className="t-body-strong text-ink-2 tabular-nums">
              {s === null ? '\u00a0' : rest}
            </span>
            <span>{caption}</span>
          </span>
        }
        // The kit tile as specified (radius bento, 18px padding); on the page ground it takes the e0 hairline.
        className="h-full max-md:bg-page md:shadow-e0"
      />
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
