import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { Tag } from '@/components/cards/parts';
import { formatInt } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { cardRankingLabel, formatKg, type CardPodiumRow, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { MineRow } from './data';

/*
 * What the three prototypes share: the card's derived copy (dates, chips, places, CTA, my status),
 * the small pieces (thumb, date block, podium, places bar) and the phone list. Composition only —
 * every visual is a kit component or a token utility.
 */

export type TabKey = 'viitoare' | 'live' | 'rezultate' | 'ale-mele';
export const TABS: TabKey[] = ['viitoare', 'live', 'rezultate', 'ale-mele'];

/* ---------------------------------------------------------------- dates (Bucharest) */

const TZ = 'Europe/Bucharest';
const DAYS = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'] as const;
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;
const MONTHS_FULL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'] as const;
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });

export type DayParts = { year: number; month: number; day: number; weekday: number; index: number };

/** A date's calendar day in Bucharest; `index` counts days since the epoch (week maths). */
export function dayParts(iso: string | Date): DayParts {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  const year = Number(out.year);
  const month = Number(out.month) - 1;
  const day = Number(out.day);
  return { year, month, day, weekday: WD[out.weekday] ?? 0, index: Math.round(Date.UTC(year, month, day) / 86_400_000) };
}

export function monthShort(m: number) {
  return MONTHS[m];
}

/** Agenda bucket: this week (Mon–Sun), next week, then the month's name. */
export function bucketOf(startIso: string | null, now: Date): { key: string; label: string; order: number } {
  if (!startIso) return { key: 'tbd', label: 'Fără dată', order: 9e9 };
  const d = dayParts(startIso);
  const today = dayParts(now);
  const weekStart = today.index - ((today.weekday + 6) % 7);
  if (d.index < weekStart + 7) return { key: 'w0', label: 'Săptămâna asta', order: 0 };
  if (d.index < weekStart + 14) return { key: 'w1', label: 'Săptămâna viitoare', order: 1 };
  const label = d.year === today.year ? MONTHS_FULL[d.month] : `${MONTHS_FULL[d.month]} ${d.year}`;
  return { key: `m${d.year}-${d.month}`, label, order: 2 + d.year * 12 + d.month };
}

/** The calendar leaf: weekday, day, month (start day; a range adds «+1» days). */
export function DateBlock({ card, size = 'md' }: { card: CompetitionCard; size?: 'md' | 'sm' }) {
  if (!card.startDate) return <div className="t-caption text-muted">—</div>;
  const s = dayParts(card.startDate);
  const e = card.endDate ? dayParts(card.endDate) : s;
  const days = e.index - s.index;
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-control bg-accent-tint text-accent-ink',
        size === 'md' ? 'size-16' : 'size-12',
      )}
      aria-hidden
    >
      <span className="t-eyebrow uppercase">{DAYS[s.weekday]}</span>
      <span className={size === 'md' ? 't-num-26' : 't-num-18'}>{s.day}</span>
      <span className="t-eyebrow uppercase">
        {MONTHS[s.month]}
        {days > 0 ? ` +${days}` : ''}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- media */

export function photoOf(c: CompetitionCard, big = false): string | null {
  const m = c.banner ?? c.lake?.image ?? null;
  if (!m) return null;
  return big ? (m.mediumUrl ?? m.url) : (m.smallUrl ?? m.url);
}

/** A fixed-size photo; a card without one keeps the slot (soft-fill), so rows never shift. */
export function Thumb({ card, className, big = false, sizes = '120px', children }: { card: CompetitionCard; className?: string; big?: boolean; sizes?: string; children?: ReactNode }) {
  const src = photoOf(card, big);
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', className)}>
      {src ? <Image src={src} alt="" fill sizes={sizes} className="object-cover" /> : null}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- copy */

export function lakeLine(c: CompetitionCard): string {
  if (!c.lake) return 'Baltă nespecificată';
  return c.lake.county ? `${c.lake.name} · ${c.lake.county.name}` : c.lake.name;
}

export function formatLabel(c: CompetitionCard): string {
  if (c.format.kind === 'team') return c.format.teamSize ? `Echipe de ${c.format.teamSize}` : 'Echipe';
  return 'Individual';
}

export function FormatChips({ card, size = 'md' }: { card: CompetitionCard; size?: 'sm' | 'md' }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Tag tone="indigo" size={size}>
        {formatLabel(card)}
      </Tag>
      <Tag tone="gray" size={size}>
        {cardRankingLabel(card)}
      </Tag>
    </span>
  );
}

export function LakeLine({ card, className }: { card: CompetitionCard; className?: string }) {
  return (
    <p className={cn('flex min-w-0 items-center gap-1 t-label text-accent-ink', className)}>
      <MapPinIcon aria-hidden className="size-3 shrink-0 text-accent" />
      <span className="truncate">{lakeLine(card)}</span>
    </p>
  );
}

export function kg(value: number | null | undefined): string {
  return value == null ? '–' : formatKg(value);
}

/** «Înscrie-te» while there are places, «Complet» when none, «Vezi» when the limit is unknown. */
export function upcomingCta(c: CompetitionCard): { label: string; variant: 'primary' | 'secondary' | 'ghost'; full: boolean } {
  if (c.capacity != null && c.placesLeft === 0) return { label: 'Complet', variant: 'ghost', full: true };
  if (c.capacity != null) return { label: 'Înscrie-te', variant: 'primary', full: false };
  return { label: 'Vezi', variant: 'secondary', full: false };
}

/** The CTA as a link above the row's stretched link. */
export function Cta({ href, label, variant, full = false, className }: { href: string; label: string; variant: 'primary' | 'secondary' | 'ghost' | 'outline'; full?: boolean; className?: string }) {
  if (full) {
    return (
      <span className={cn('relative z-above inline-flex h-9 items-center justify-center rounded-control bg-soft-fill px-3 t-button-compact text-muted', className)}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClass({ variant, size: 'compact', className: cn('relative z-above', className) })}>
      {label}
    </Link>
  );
}

/* ---------------------------------------------------------------- places */

export function placesText(c: CompetitionCard): string {
  if (c.capacity == null) return `${formatInt(c.joinedCount)} ${c.format.unit}`;
  return `${formatInt(c.joinedCount)}/${formatInt(c.capacity)} ${c.format.unit}`;
}

/** Places taken out of the limit, with a 4px bar (warning tone in the last 20%, neutral when full). */
export function Places({ card, className }: { card: CompetitionCard; className?: string }) {
  const cap = card.capacity;
  const pct = cap ? Math.min(100, Math.round((card.joinedCount / cap) * 100)) : 0;
  const full = cap != null && card.placesLeft === 0;
  const tight = !full && cap != null && card.placesLeft != null && card.placesLeft <= Math.max(1, Math.ceil(cap * 0.2));
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-body-strong text-ink tabular-nums">{placesText(card)}</span>
        {cap != null ? (
          <span className={cn('t-caption whitespace-nowrap', full ? 'text-muted' : tight ? 'text-status-pending-fg' : 'text-muted')}>
            {full ? 'complet' : `${card.placesLeft} libere`}
          </span>
        ) : null}
      </div>
      {cap != null ? (
        <div className="h-1 overflow-hidden rounded-full bg-soft-fill" aria-hidden>
          <div className={cn('h-full rounded-full', full ? 'bg-faint' : tight ? 'bg-status-pending-fg' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- podium */

const MEDAL = ['bg-medal-gold', 'bg-medal-silver', 'bg-medal-bronze'] as const;

export function MedalChip({ position, className }: { position: number; className?: string }) {
  return (
    <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full t-micro-strong text-on-medal', MEDAL[position - 1] ?? 'bg-soft-fill', className)}>
      {position}
    </span>
  );
}

/** Medal, face, name: the podium slot (the medal leads, so it never covers the initials). */
export function PodiumSlot({ row, size = 32 }: { row: CardPodiumRow; size?: 24 | 32 }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <MedalChip position={row.position} />
      <Avatar name={row.displayName} src={row.avatarUrls[0] ?? null} size={size} />
      <span className="min-w-0 truncate t-label text-ink">{row.displayName}</span>
    </span>
  );
}

/** Top three in three equal slots (they line up row to row); «Fără capturi» when nobody weighed. */
export function PodiumInline({ card, max = 3 }: { card: CompetitionCard; max?: number }) {
  const podium = card.results?.podium.slice(0, max) ?? [];
  if (!podium.length) {
    return <span className="t-caption text-muted">{card.results?.hasCatches ? 'Clasament în lucru' : 'Fără capturi'}</span>;
  }
  return (
    <ol className="grid min-w-0 grid-cols-3 items-center gap-4">
      {podium.map((r) => (
        <li key={`${r.position}-${r.displayName}`} className="min-w-0">
          <PodiumSlot row={r} />
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- my status */

export function myStatusPills(r: MineRow): Array<{ label: string; tone: StatusTone }> {
  const out: Array<{ label: string; tone: StatusTone }> = [];
  if (r.card.status === 'started') out.push({ label: 'LIVE', tone: 'live' });
  if (r.status === 'pending') out.push({ label: 'În așteptare', tone: 'pending' });
  else if (r.status === 'registered') out.push({ label: 'Înscris', tone: 'success' });
  else if (r.status === 'rejected') out.push({ label: 'Respins', tone: 'neutral' });
  else if (r.status === 'cancelled') out.push({ label: 'Anulat', tone: 'cancelled' });
  if (r.stand) out.push({ label: `Stand ${r.stand}`, tone: 'info' });
  return out;
}

export function MyStatusPills({ row }: { row: MineRow }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {myStatusPills(row).map((p) => (
        <StatusPill key={p.label} tone={p.tone}>
          {p.label}
        </StatusPill>
      ))}
    </span>
  );
}

/** What the viewer does next, in one line + the CTA it leads to. */
export function nextStep(r: MineRow, viewerName: string | null): { label: string; text: string; cta: string } {
  const c = r.card;
  if (c.status === 'started') {
    return { label: 'Acum', text: r.stand ? `Pescuiești la standul ${r.stand} · cântărirea e live` : 'Concursul e live', cta: 'Clasament live' };
  }
  if (c.status === 'completed') {
    const mine = c.results?.podium.find((p) => viewerName && p.displayName === viewerName);
    return { label: 'Rezultat', text: mine ? `Ai terminat pe locul ${mine.position}` : 'Concurs încheiat · vezi unde ai terminat', cta: 'Rezultate' };
  }
  if (r.status === 'pending') return { label: 'Pasul următor', text: 'Organizatorul îți confirmă înscrierea', cta: 'Vezi' };
  if (r.stand) return { label: 'Pasul următor', text: `Standul ${r.stand} e al tău · începe ${c.dateLabel}${c.hoursLabel ? `, ${c.hoursLabel.split('–')[0]}` : ''}`, cta: 'Detalii' };
  return { label: 'Pasul următor', text: 'Standurile se trag la sorți înainte de start', cta: 'Detalii' };
}

export function SampleTag() {
  return (
    <Tag tone="yellow" size="sm" title="Rând de exemplu construit dintr-un concurs real">
      Exemplu
    </Tag>
  );
}

/* ---------------------------------------------------------------- phone list (all variants) */

/** Below 768 every prototype shows the fish-like list: thumb, date, name, lake, one status line. */
export function PhoneList({ tab, data }: { tab: TabKey; data: { upcoming: CompetitionCard[]; live: CompetitionCard[]; completed: CompetitionCard[]; mine: MineRow[] } }) {
  const rows: Array<{ card: CompetitionCard; line: ReactNode; sample?: boolean }> =
    tab === 'viitoare'
      ? data.upcoming.map((c) => ({ card: c, line: placesText(c) }))
      : tab === 'live'
        ? data.live.map((c) => ({ card: c, line: `${kg(c.results?.biggestFishKg)} kg cea mai mare · ${formatInt(c.results?.catchCount ?? 0)} capturi` }))
        : tab === 'rezultate'
          ? data.completed.map((c) => ({ card: c, line: c.results?.podium[0] ? `Câștigător: ${c.results.podium[0].displayName}` : 'Fără capturi' }))
          : data.mine.map((r) => ({ card: r.card, line: myStatusPills(r).map((p) => p.label).join(' · '), sample: r.sample }));
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map(({ card, line, sample }) => (
        <li key={card.documentId} className="relative flex gap-3 rounded-card bg-surface p-3 shadow-e0">
          <Thumb card={card} className="size-18 rounded-control" sizes="72px" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-center gap-1.5 t-eyebrow text-muted uppercase">
              {card.status === 'started' ? <span className="size-1.5 rounded-full bg-live animate-live" aria-hidden /> : null}
              {card.dateLabel}
              {sample ? <SampleTag /> : null}
            </p>
            <Link href={routes.competition(card.documentId)} className="line-clamp-2 t-heading text-ink after:absolute after:inset-0 after:content-['']">
              {card.name}
            </Link>
            <p className="truncate t-caption text-muted">{line}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
