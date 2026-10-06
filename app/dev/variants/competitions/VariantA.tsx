import Link from 'next/link';
import type { ReactNode } from 'react';
import { Pill } from '@/components/cards/parts';
import { formatInt } from '@/components/cards/format';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { cardRankingLabel, dateWithHours, entrantsCount, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { MineRow, VariantData } from './data';
import {
  bucketOf,
  Cta,
  DateBlock,
  FormatChips,
  kg,
  LakeLine,
  MyStatusPills,
  nextStep,
  Places,
  PodiumInline,
  SampleTag,
  Thumb,
  upcomingCta,
  type TabKey,
} from './shared';

/*
 * A — «Per-tab format»: each tab gets the shape its question needs.
 *  Live      → feature cards, two per row, the live numbers big.
 *  Viitoare  → an agenda grouped by week / month, one row per competition.
 *  Rezultate → rows led by the podium.
 *  Ale mele  → rows led by my status and my next step.
 * Rows share one fixed column template per tab, so every row is the same height and every column
 * lines up — the «different heights» problem cannot happen.
 */

export function VariantA({ tab, data }: { tab: TabKey; data: VariantData }) {
  if (tab === 'live') return <LiveFeatures cards={data.live} />;
  if (tab === 'viitoare') return <Agenda cards={data.upcoming} />;
  if (tab === 'rezultate') return <ResultRows cards={data.completed} />;
  return <MineRows rows={data.mine} viewerName={data.viewerName} />;
}

/* ---------------------------------------------------------------- Live */

function LiveFeatures({ cards }: { cards: CompetitionCard[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {cards.map((c) => (
        <LiveFeature key={c.documentId} card={c} />
      ))}
    </div>
  );
}

function LiveFeature({ card: c }: { card: CompetitionCard }) {
  const href = routes.competition(c.documentId);
  const r = c.results;
  return (
    <article className="relative flex overflow-hidden rounded-bento bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)] transition-shadow duration-(--duration-fast) hover:shadow-[var(--shadow-e2),var(--shadow-e0)]">
      <Thumb card={c} big sizes="(min-width: 1280px) 360px, 40vw" className="w-[40%] min-h-60">
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Pill tone="live">LIVE</Pill>
        </div>
      </Thumb>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="t-eyebrow text-muted uppercase">{dateWithHours(c)}</p>
          <h3 className="line-clamp-2 t-title2 text-ink">
            <Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-accent">
              {c.name}
            </Link>
          </h3>
          <LakeLine card={c} />
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-card bg-page p-4">
          <SignatureNumber size="fact" value={kg(r?.biggestFishKg)} unit={r?.biggestFishKg != null ? 'kg' : undefined} caption="Cea mai mare" />
          <SignatureNumber size="fact" value={formatInt(r?.catchCount ?? 0)} caption="Capturi" />
          <SignatureNumber size="fact" value={formatInt(c.viewers)} caption="Urmăresc acum" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <FormatChips card={c} />
            <span className="t-caption text-muted">{entrantsCount(c.joinedCount, c.format.unit)} în concurs</span>
          </span>
          <Link href={href} className={buttonClass({ variant: 'primary', size: 'compact', className: 'relative z-above' })}>
            Clasament live
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- Viitoare (agenda) */

const AGENDA_COLS = 'grid-cols-[64px_120px_minmax(0,1fr)_176px_200px_112px]';

function Agenda({ cards }: { cards: CompetitionCard[] }) {
  const now = new Date();
  const groups = new Map<string, { label: string; order: number; cards: CompetitionCard[] }>();
  for (const c of cards) {
    const b = bucketOf(c.startDate, now);
    const g = groups.get(b.key) ?? { label: b.label, order: b.order, cards: [] };
    g.cards.push(c);
    groups.set(b.key, g);
  }
  return (
    <div className="flex flex-col gap-8">
      {[...groups.values()]
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <section key={g.label} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2 t-title2 text-ink">
              {g.label}
              <span className="t-body text-muted">{g.cards.length}</span>
            </h2>
            <RowList>
              {g.cards.map((c) => {
                const cta = upcomingCta(c);
                return (
                  <Row key={c.documentId} cols={AGENDA_COLS}>
                    <DateBlock card={c} />
                    <Thumb card={c} className="h-20 rounded-control" />
                    <NameCell card={c} eyebrow={dateWithHours(c)} />
                    <FormatChips card={c} />
                    <Places card={c} />
                    <Cta href={routes.competition(c.documentId)} {...cta} className="justify-self-end" />
                  </Row>
                );
              })}
            </RowList>
          </section>
        ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Rezultate */

const RESULT_COLS = 'grid-cols-[64px_120px_minmax(0,1fr)_minmax(0,1.3fr)_168px_96px]';

function ResultRows({ cards }: { cards: CompetitionCard[] }) {
  return (
    <RowList>
      {cards.map((c) => (
        <Row key={c.documentId} cols={RESULT_COLS}>
          <DateBlock card={c} />
          <Thumb card={c} className="h-20 rounded-control" />
          <NameCell card={c} eyebrow={`${c.dateLabel} · ${cardRankingLabel(c)}`} />
          <PodiumInline card={c} />
          <span className="flex flex-col">
            <span className="t-body-strong text-ink tabular-nums">
              {kg(c.results?.biggestFishKg)}
              {c.results?.biggestFishKg != null ? <span className="ms-1 t-caption text-muted">kg</span> : null}
            </span>
            <span className="t-caption text-muted">cea mai mare · {formatInt(c.results?.catchCount ?? 0)} capturi</span>
          </span>
          <Cta href={routes.competition(c.documentId)} label="Clasament" variant="secondary" className="justify-self-end" />
        </Row>
      ))}
    </RowList>
  );
}

/* ---------------------------------------------------------------- Ale mele */

const MINE_COLS = 'grid-cols-[64px_120px_minmax(0,1fr)_220px_minmax(0,1fr)_128px]';

function MineRows({ rows, viewerName }: { rows: MineRow[]; viewerName: string | null }) {
  return (
    <RowList>
      {rows.map((r) => {
        const step = nextStep(r, viewerName);
        return (
          <Row key={r.card.documentId} cols={MINE_COLS}>
            <DateBlock card={r.card} />
            <Thumb card={r.card} className="h-20 rounded-control" />
            <NameCell card={r.card} eyebrow={dateWithHours(r.card)} extra={r.sample ? <SampleTag /> : null} />
            <MyStatusPills row={r} />
            <span className="flex flex-col">
              <span className="t-label text-muted uppercase">{step.label}</span>
              <span className="t-body text-ink">{step.text}</span>
            </span>
            <Cta href={routes.competition(r.card.documentId)} label={step.cta} variant={r.card.status === 'started' ? 'primary' : 'secondary'} className="justify-self-end" />
          </Row>
        );
      })}
    </RowList>
  );
}

/* ---------------------------------------------------------------- row parts */

function RowList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">{children}</ul>;
}

function Row({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <li className={cn('relative grid items-center gap-5 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-soft-fill', cols)}>
      {children}
    </li>
  );
}

function NameCell({ card, eyebrow, extra }: { card: CompetitionCard; eyebrow: string; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex items-center gap-1.5 t-eyebrow text-muted uppercase">
        {eyebrow}
        {extra}
      </p>
      <Link
        href={routes.competition(card.documentId)}
        className="truncate t-heading text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
      >
        {card.name}
      </Link>
      <LakeLine card={card} />
    </div>
  );
}
