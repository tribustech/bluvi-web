'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ChevronRightIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  competitionsKeys,
  getParticipationType,
  getRankingTypeLabel,
  rankingsKeys,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import { DetailBody, DetailSection } from '@/components/templates/T3';
import { plural } from '@/components/cards/format';
import { BentoTile, StatTile } from '@/components/ui/BentoTile';
import { StatusPill } from '@/components/ui/StatusPill';
import { PROSE_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import type { CompetitionDates } from './CompetitionScreen';
import { TAB_ON_WEB } from './tabs';
import { competitionDuration } from './dates';
import { StackedFacts } from './infoParts';

/*
 * fish components/competition/CompetitionPreview.tsx (notStarted: the ranking is replaced by it):
 * countdown, «Competiția nu a început», details, registrations, sectors, the closing line — on the
 * T3 body and section cards (parity competition-page.previzualizare).
 *
 * The labels (Durată, Tip clasament, Tip competiție) are core's (core/competitions/domain/
 * competitionLabels.ts, fish getRankingType / getParticipationType); the duration is dates.ts
 * competitionDuration (fish getCompetitionDuration with «de» from 20).
 */
export function CompetitionPreview({ competition, dates }: { competition: CompetitionWithMyStatus; dates: CompetitionDates }) {
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  const pending = competition.registrations.filter(r => r.registrationStatus === 'pending').length;
  const limit = competition.participantsLimit;
  const stands = competition.sectors.reduce((n, s) => n + s.stands.length, 0);
  // fish: min(approved / limit × 100, 100), shown rounded.
  const progress = limit ? Math.min((registered / limit) * 100, 100) : null;

  const full = !!limit && registered >= limit;
  // CMS order is not the sectors' order («C, A, B, D»): A→Z, numbers in order (fish's sector pills).
  const sectors = [...competition.sectors].sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }));
  const duration = competitionDuration(competition.startDate, competition.endDate);
  const rankingType = getRankingTypeLabel(competition);
  const participation = getParticipationType(competition);

  const countdown = <Countdown competition={competition} caption={dates.startShort} />;
  const registrations = (
    // The kit StatTile (icon + label, «12/48», the kit's progress bar) — the countdown's header and
    // number steps; pending registrations are a state, the «în așteptare» pill; a full one «Complet».
    // On the phone a flat white band like the other sections (no tile inside a band); a card from 768.
    <section aria-label="Înscrieri">
      <StatTile
        tone="surface"
        icon={<UserGroupIcon />}
        label="Înscrieri"
        value={registered}
        unit={limit ? `/${limit}` : undefined}
        progress={limit ? { value: registered, max: limit, label: 'Progres înscrieri' } : undefined}
        caption={
          <span className="flex flex-col gap-2">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {progress !== null ? (
                <span>
                  Progres înscrieri <span className="t-label text-ink tabular-nums">{Math.round(progress)}%</span>
                </span>
              ) : null}
              {full ? <StatusPill tone="neutral">Complet</StatusPill> : null}
              {pending > 0 ? <StatusPill tone="pending">{pending} în așteptare</StatusPill> : null}
            </span>
            {registered === 0 && pending === 0 ? <span className="t-caption text-ink-2">Fii primul care se înscrie la această competiție!</span> : null}
            {TAB_ON_WEB.participanti ? (
              <MoreLink href={routes.competitionParticipants(competition.documentId)}>Vezi toate înscrierile</MoreLink>
            ) : null}
          </span>
        }
        className={cn('h-full md:shadow-e0', PHONE_BAND)}
      />
    </section>
  );

  // One «Detalii» (StackedFacts) at every width: from 1280 in the left column, below in
  // the pairs. The dates are the compact form (one line); in the narrow left column every fact
  // stacks its label over its value (StackedFacts `from="xl"`, as Informații and Regulament).
  const details = (
    <DetailSection title="Detalii">
      <StackedFacts
        from="xl"
        facts={[
          { key: 'durata', label: 'Durată', value: duration },
          { key: 'incepe', label: 'Începe', value: dates.startCompact },
          { key: 'termina', label: 'Se termină', value: dates.endCompact },
          { key: 'clasament', label: 'Tip clasament', value: rankingType },
          { key: 'competitie', label: 'Tip competiție', value: participation },
        ]}
      />
      {TAB_ON_WEB.informatii ? (
        <div className="mt-3">
          <MoreLink href={routes.competitionInfo(competition.documentId)}>Vezi toate informațiile</MoreLink>
        </div>
      ) : null}
    </DetailSection>
  );

  // Below 1280 fish's order in pairs (countdown · notice, details · registrations); from 1280 the
  // T3 three columns (ROADMAP §4): the left column the details, the centre the notice (reading text,
  // capped at 720) and the sectors, the right column «ce mă așteaptă» the countdown and the
  // registrations. The blocks render once per composition (the other is display: none — DetailBody
  // shows its side columns only from 1280).
  return (
    <DetailBody
      left={details}
      leftLabel="Detalii"
      aside={
        <>
          {countdown}
          {registrations}
        </>
      }
      asideLabel="Ce mă așteaptă"
      asideBelowXl="hidden"
      asideSticky
    >
      {/* From 768 the countdown and the notice share a row (a lone tile would stretch to 1200px). */}
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-1 xl:gap-5">
        <div className="contents xl:hidden">{countdown}</div>
        <DetailSection title="Competiția nu a început">
          <p className={cn('t-body text-ink-2', PROSE_MAX)}>
            Această competiție încă nu a început. Odată ce va începe, vei putea vedea clasamentul live, progresul
            participanților în timp real, statistici și multe altele. Revino la momentul potrivit pentru a urmări acțiunea!
          </p>
        </DetailSection>
      </div>

      {/* Below 1280: Detalii beside Înscrieri. */}
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:hidden">
        {details}
        {registrations}
      </div>

      {/* fish CompetitionSectorsPreview: «Sectoare: n | Standuri: m» («-» for none). */}
      <DetailSection title={`Sectoare: ${sectors.length || '–'} · Standuri: ${stands || '–'}`}>
        {sectors.length ? (
          // Auto-fill: more sectors per row as the column grows, never wider tiles.
          <ul className="grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(56),1fr))]">
            {sectors.map(s => {
              const names = s.stands.map(st => st.name).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
              return (
                <li key={s.documentId} className="flex items-baseline justify-between gap-3 rounded-control bg-soft-fill px-3 py-2">
                  <span className="t-body whitespace-nowrap text-ink-2">Sectorul {s.name}</span>
                  {names.length ? (
                    <span className="min-w-0 text-right">
                      <span className="t-body-strong">{plural(s.stands.length, 'stand', 'standuri')}</span>
                      <span className="block t-caption text-muted">({names.join(', ')})</span>
                    </span>
                  ) : (
                    // No stands yet: the heading's «–», said in words — never a bold «0 standuri».
                    <span className="min-w-0 text-right t-body text-muted">Fără standuri</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="t-body text-muted">Configurarea standurilor nu a fost finalizată încă</p>
        )}
      </DetailSection>

      {/* fish's closing line; on the phone it also keeps clear of the action bar's reason line. */}
      <p className="px-4 pb-2 text-center t-caption text-muted max-md:pb-8 md:px-0">Revino când competiția începe pentru a vedea clasamentul live!</p>
    </DetailBody>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 t-label text-accent-ink hover:underline">
      {children}
      <ChevronRightIcon aria-hidden className="size-4" />
    </Link>
  );
}

/** Phone: a tile is a flat white band like the sections around it (DetailSection's padding). */
const PHONE_BAND = 'max-md:rounded-none max-md:px-4 max-md:py-5';

const pad = (n: number) => String(n).padStart(2, '0');
const MINUTE = 60_000;

/**
 * fish CompetitionCountdown «COMPETIȚIA ÎNCEPE ÎN» with ZILE : ORE : MIN : SEC (two digits, every
 * second) on the kit BentoTile. Ticks in the browser only (no clock on the server render: bones
 * until then). fish re-reads the competition once under a minute and once at the start; the web
 * does the same (and the ranking at the start), so the page flips to the live ranking.
 *
 * Web difference: once the start has passed while the CMS still says «notStarted» (its cron has
 * not run yet), fish hides the countdown; the web keeps the slot (no layout shift), says the start
 * is late, and re-reads the competition every minute until it starts.
 */
function Countdown({ competition, caption }: { competition: CompetitionWithMyStatus; caption: string }) {
  const qc = useQueryClient();
  const id = competition.documentId;
  const start = new Date(competition.startDate).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const left = now === null ? null : Math.max(0, start - now);

  // fish: one re-read when under a minute is left, one when the start passes (during the visit).
  const underMinute = useRef(false);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = left;
    if (left === null) return;
    if (left > 0 && left < MINUTE && !underMinute.current) {
      underMinute.current = true;
      void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id) });
    }
    if (left === 0 && before !== null && before > 0) {
      void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id) });
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) });
    }
  }, [left, qc, id]);
  // Late start: re-read the competition every minute (the page switches to the ranking when it starts).
  const late = left === 0;
  useEffect(() => {
    if (!late) return;
    const timer = setInterval(() => void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id) }), MINUTE);
    return () => clearInterval(timer);
  }, [late, qc, id]);

  if (Number.isNaN(start)) return null;
  const s = left === null ? null : Math.floor(left / 1000);
  const units: [string, string][] =
    s === null
      ? []
      : [
          [pad(Math.floor(s / 86400)), 'ZILE'],
          [pad(Math.floor((s % 86400) / 3600)), 'ORE'],
          [pad(Math.floor((s % 3600) / 60)), 'MIN'],
          [pad(s % 60), 'SEC'],
        ];

  const label = late ? 'Start întârziat' : 'Competiția începe în';
  // The digits row (or its bones): also the late state's measure, so nothing shifts when it flips.
  const digits = (
    <div className="flex items-start gap-1.5 tabular-nums">
      {(units.length ? units : [['', 'ZILE'], ['', 'ORE'], ['', 'MIN'], ['', 'SEC']]).map(([value, unit], i) => (
        <div key={unit} className="flex items-start gap-1.5">
          {i > 0 ? (
            <span aria-hidden className="t-num-40 text-faint">
              :
            </span>
          ) : null}
          <span className="flex min-w-12 flex-col items-center">
            {value ? (
              <span className="t-num-40 text-ink">{value}</span>
            ) : (
              <span aria-hidden className="relative block t-num-40">
                &nbsp;
                <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-control" />
              </span>
            )}
            <span className="t-micro text-muted">{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <section aria-label={label}>
      <BentoTile tone="surface" className={cn('h-full md:shadow-e0', PHONE_BAND)}>
        {/* The kit StatTile's label row (icon + sentence-case t-label), as «Înscrieri» under it. */}
        <div className="flex items-center gap-2 t-label text-muted">
          <span aria-hidden className="flex size-4 items-center justify-center text-accent [&>svg]:size-4">
            <ClockIcon />
          </span>
          {label}
        </div>
        {late ? (
          // The start has passed, the CMS has not flipped yet: what the page is waiting for, in the
          // digits' slot (their invisible row keeps the height).
          <div className="grid">
            <div aria-hidden className="invisible col-start-1 row-start-1">
              {digits}
            </div>
            <p role="status" className="col-start-1 row-start-1 flex items-center gap-2 self-center t-heading text-ink">
              <ArrowPathIcon aria-hidden className="size-5 shrink-0 animate-spin text-accent-ink motion-reduce:animate-none" />
              Așteptăm pornirea de către organizator
            </p>
          </div>
        ) : (
          // Ticking every second: a timer role is not announced on every change.
          // The StatTile number step (t-num-40), as «20/20» beside it.
          <div role="timer" aria-live="off">
            {digits}
          </div>
        )}
        <p className="t-caption text-muted">{late ? `Programat: ${caption}` : caption}</p>
      </BentoTile>
    </section>
  );
}
