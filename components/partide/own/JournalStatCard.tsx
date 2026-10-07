import { ClockIcon, StarIcon, TrophyIcon } from '@heroicons/react/24/solid';
import type { ReactNode } from 'react';
import { CatchIcon, FishingRodIcon, ScaleIcon } from '@/components/icons/brand';
import { BentoTile, StatTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { fmtKg, fmtKgStat, type MonthlyStats } from '@/core/partide';
import { MonthlyCatchesChart } from './MonthlyCatchesChart';

/*
 * Ale mele's figures (parity partide.ale-mele.c5, c11–c13): fish AleMeleScene's stat card (C1,
 * Revolut lens — ONE flat card, four equal columns split by hairlines, the one accent on «Capturi»)
 * and its «Statistici» (the «Capturi pe lună» chart card, the «Cea mai bună captură» and «Ore
 * pescuite» tiles).
 *
 * Below 1280 fish's order and shapes: <JournalStatStrip/>, then <JournalStatistics/>. From 1280
 * the two become one bento (owner rules 9, 19): <JournalBento/> — the four figures as tiles of their
 * own surface (navy signature «Partide», indigo «Capturi», lavender «Cantitate», amber «Record»)
 * beside the chart, which takes a tall double tile, and the two facts as wide tiles under them.
 * Units are their own smaller element (owner rule 10); kg via fmtKgStat (decimals traded for
 * magnitude, «t» past a tonne).
 */

export type JournalStats = { partide: number; capturi: number; recordKg: number | null; totalKg: number };

/** fish StatTile «Cea mai bună captură»: «{kg} kg» + «{specie} · {baltă}» (or the venue), else «—» / «Nicio captură încă». */
export function bestCatchView(best: MonthlyStats['bestCatch']): { value: string; unit: string | null; detail: string } {
  if (!best) return { value: '—', unit: null, detail: 'Nicio captură încă' };
  return { value: fmtKg(best.weightKg), unit: 'kg', detail: best.species ? `${best.species} · ${best.venueName}` : best.venueName };
}

/** fish StatTile «Ore pescuite»: «{n} h» + «~{x,x} h / partidă» (comma decimal), else «—». */
export function hoursView(m: Pick<MonthlyStats, 'totalHours' | 'avgHoursPerPartida'>): { value: string; detail: string } {
  return {
    value: String(Math.round(m.totalHours)),
    detail: m.avgHoursPerPartida != null ? `~${m.avgHoursPerPartida.toFixed(1).replace('.', ',')} h / partidă` : '—',
  };
}

/* ------------------------------------------------------------------ below 1280: fish's shapes */

function StatCell({ label, value, unit, accent = false, divider = true }: { label: string; value: string; unit?: string; accent?: boolean; divider?: boolean }) {
  return (
    // min-w-0: the four cells stay equal whatever the widest value is (fish «Record» wrapping). The
    // hairline divider (26px, centred) is the cell's own ::before, so the <dl> holds only its groups.
    <div
      className={cn(
        'relative flex min-w-0 flex-1 flex-col-reverse items-center gap-1.25 px-1',
        divider && 'before:absolute before:top-1/2 before:left-0 before:h-6.5 before:w-px before:-translate-y-1/2 before:bg-hairline',
      )}
      data-testid={`stat-${label}`}
    >
      <dt className="max-w-full truncate t-micro tracking-[0.4px] text-muted">{label}</dt>
      <dd className="flex max-w-full items-baseline gap-0.5">
        <span className={cn('truncate t-title1 tabular-nums', accent ? 'text-accent-ink' : 'text-ink')}>{value}</span>
        {unit ? <span className="shrink-0 t-micro-strong text-muted">{unit}</span> : null}
      </dd>
    </div>
  );
}

/** c5 — the one flat card: Partide · Capturi (accent) · Cantitate · Record. */
export function JournalStatStrip({ stats }: { stats: JournalStats }) {
  const total = fmtKgStat(stats.totalKg);
  const record = fmtKgStat(stats.recordKg ?? 0);
  return (
    <dl className="flex rounded-card bg-surface px-1 py-3.5 shadow-e0" aria-label="Jurnalul tău în cifre" data-testid="journal-stat-strip">
      <StatCell label="Partide" value={String(stats.partide)} divider={false} />
      <StatCell label="Capturi" value={String(stats.capturi)} accent />
      <StatCell label="Cantitate" value={total.value} unit={total.unit} />
      <StatCell label="Record" value={record.value} unit={record.unit} />
    </dl>
  );
}

/** fish StatTile — a white tile: the micro label, the icon + the value, the detail line. */
function FactCard({ label, icon, value, unit, detail, testId }: { label: string; icon: ReactNode; value: string; unit?: string | null; detail: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-card bg-surface px-3.5 py-3.25 shadow-e0" data-testid={testId}>
      <p className="t-micro text-muted">{label}</p>
      <p className="mt-2.5 flex items-center gap-1.75">
        <span aria-hidden className="flex size-4 shrink-0 [&>svg]:size-4">
          {icon}
        </span>
        <span className="t-body-strong text-ink">
          {value}
          {unit ? <span className="ms-1 t-label text-muted">{unit}</span> : null}
        </span>
      </p>
      <p className="mt-2 truncate t-micro text-muted">{detail}</p>
    </div>
  );
}

/** c11–c13 below 1280: the chart card, then the two tiles side by side. */
export function JournalStatistics({ monthly }: { monthly: MonthlyStats }) {
  const best = bestCatchView(monthly.bestCatch);
  const hours = hoursView(monthly);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-card bg-surface px-3.75 py-3.5 shadow-e0">
        <div className="mb-3.25 flex items-center justify-between gap-3">
          <h3 className="t-label text-ink">Capturi pe lună</h3>
          <p className="t-micro text-muted">ultimele 7 luni</p>
        </div>
        <MonthlyCatchesChart months={monthly.months} />
      </div>
      <div className="flex gap-2.75">
        <FactCard label="Cea mai bună captură" icon={<StarIcon className="text-rating" />} value={best.value} unit={best.unit} detail={best.detail} testId="best-catch" />
        <FactCard label="Ore pescuite" icon={<ClockIcon className="text-muted" />} value={hours.value} unit="h" detail={hours.detail} testId="hours-fished" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ from 1280: the bento */

/** One KPI tile with its own surface and corner art (the label on top, the number at the foot). */
function KpiTile({ label, value, unit, tone, art, testId }: { label: string; value: string; unit?: string; tone: 'signature' | 'indigo' | 'lavender' | 'amber'; art: ReactNode; testId: string }) {
  const number = tone === 'signature' ? 'lavender' : tone === 'indigo' ? 'onIndigo' : 'ink';
  const unitTone = tone === 'signature' ? 'lavender' : tone === 'indigo' ? 'onIndigo' : 'current';
  return (
    <BentoTile tone={tone} art={art} className="min-h-0">
      <p className="t-label">{label}</p>
      <div data-testid={testId}>
        <SignatureNumber size="stat" value={value} unit={unit} tone={number} unitTone={unitTone} />
      </div>
    </BentoTile>
  );
}

/**
 * The four figures as bento tiles, two by two (navy «Partide», indigo «Capturi», lavender
 * «Cantitate», amber «Record»): the bento's figure block, and Istoric's summary column from 1280.
 */
export function JournalKpiGrid({ stats, label = 'Jurnalul tău în cifre', className }: { stats: JournalStats; label?: string; className?: string }) {
  const total = fmtKgStat(stats.totalKg);
  const record = fmtKgStat(stats.recordKg ?? 0);
  return (
    <div role="group" className={cn('grid grid-cols-2 gap-4', className)} aria-label={label}>
      <KpiTile label="Partide" value={String(stats.partide)} tone="signature" art={<FishingRodIcon />} testId="bento-partide" />
      <KpiTile label="Capturi" value={String(stats.capturi)} tone="indigo" art={<CatchIcon />} testId="bento-capturi" />
      <KpiTile label="Cantitate" value={total.value} unit={total.unit} tone="lavender" art={<ScaleIcon />} testId="bento-cantitate" />
      <KpiTile label="Record" value={record.value} unit={record.unit} tone="amber" art={<TrophyIcon />} testId="bento-record" />
    </div>
  );
}

/** c5 + c11–c13 from 1280: one bento — four figures, the chart (double tile), the two facts. */
export function JournalBento({ stats, monthly }: { stats: JournalStats; monthly: MonthlyStats }) {
  const best = bestCatchView(monthly.bestCatch);
  const hours = hoursView(monthly);
  return (
    <div className="grid grid-cols-4 gap-4" data-testid="journal-bento">
      <JournalKpiGrid stats={stats} className="col-span-2" />
      <section aria-labelledby="ale-mele-chart" className="col-span-2 flex flex-col justify-between gap-4 rounded-bento bg-surface p-4.5 shadow-e0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="ale-mele-chart" className="t-heading text-ink">
            Capturi pe lună
          </h3>
          <p className="t-caption text-muted">ultimele 7 luni</p>
        </div>
        <MonthlyCatchesChart months={monthly.months} tall />
      </section>
      <StatTile
        className="col-span-2 min-h-0"
        tone="peach"
        label="Cea mai bună captură"
        icon={<StarIcon />}
        value={best.value}
        unit={best.unit ?? undefined}
        caption={<span className="block truncate">{best.detail}</span>}
      />
      <StatTile
        className="col-span-2 min-h-0"
        tone="sky"
        label="Ore pescuite"
        icon={<ClockIcon />}
        value={hours.value}
        unit="h"
        caption={hours.detail}
      />
    </div>
  );
}
