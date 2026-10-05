import Image from 'next/image';
import Link from 'next/link';
import { TrophyIcon } from '@heroicons/react/20/solid';
import { CompetitionCard as PosterCard } from '@/components/cards';
import { plural } from '@/components/cards/format';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import type { CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';

/*
 * How one competition card DTO (/feed/competition-cards) is drawn in the two T1 densities:
 * «Afiș» = the kit poster card in ListGrid, «Listă» = a dense row in ListRows (table columns once
 * the LIST is 768px wide — a container query, not the viewport).
 *
 * States are the kit StatusPill and attributes the kit Badge — the same «Înscrieri deschise» /
 * LIVE / «Încheiat» at the same size and type step as the T3 / T6 screens.
 * Demo-local: the competitions screen will own its card (fish CompetitionCardPreview) in M1.
 */

const PLACEHOLDER = '/images/competition-placeholder.jpg';

export function competitionImage(c: CompetitionCard): string {
  return c.banner?.mediumUrl ?? c.banner?.url ?? c.lake?.image?.mediumUrl ?? c.lake?.image?.url ?? PLACEHOLDER;
}

export function lakeLine(c: CompetitionCard): string {
  if (!c.lake) return 'Baltă necunoscută';
  return c.lake.county ? `${c.lake.name} · ${c.lake.county.name}` : c.lake.name;
}

/** The tones a card's state can take — valid both as a kit StatusPill tone and a poster-card status. */
type StatusLook = { label: string; tone: 'live' | 'success' | 'warning' | 'neutral' };

/**
 * The state a card says out loud. «Complet» only when the organiser set a limit (capacity null
 * never reads as full — fish models/competition-card.type.ts).
 */
export function statusLook(c: CompetitionCard): StatusLook {
  if (c.status === 'started') return { label: 'LIVE', tone: 'live' };
  if (c.status === 'completed') return { label: 'Încheiat', tone: 'neutral' };
  if (c.capacity != null && c.placesLeft === 0) return { label: 'Complet', tone: 'neutral' };
  if (c.placesLeft != null && c.placesLeft <= 3)
    return { label: c.placesLeft === 1 ? 'Ultimul loc' : `Ultimele ${c.placesLeft} locuri`, tone: 'warning' };
  return { label: 'Înscrieri deschise', tone: 'success' };
}

function badges(c: CompetitionCard): { label: string; tone: 'green' | 'yellow' }[] {
  const format =
    c.format.kind === 'team' ? (c.format.teamSize ? `Echipe de ${c.format.teamSize}` : 'Echipe') : 'Individual';
  return [
    { label: format, tone: 'green' },
    { label: c.rankingLabel, tone: 'yellow' },
  ];
}

function participants(c: CompetitionCard): string {
  const unit = c.format.unit;
  if (c.capacity != null) return `${c.joinedCount}/${c.capacity} ${unit}`;
  return unit === 'echipe' ? plural(c.joinedCount, 'echipă', 'echipe') : plural(c.joinedCount, 'pescar', 'pescari');
}

function dateLine(c: CompetitionCard): string {
  return c.hoursLabel ? `${c.dateLabel} · ${c.hoursLabel}` : c.dateLabel;
}

/** «Afiș»: the kit poster card. */
export function CompetitionPoster({ competition: c }: { competition: CompetitionCard }) {
  const look = statusLook(c);
  return (
    <PosterCard
      href={routes.competition(c.documentId)}
      title={c.name}
      dateLabel={dateLine(c)}
      lakeName={lakeLine(c)}
      imageSrc={competitionImage(c)}
      live={c.status === 'started'}
      status={look.tone === 'live' ? undefined : { label: look.label, tone: look.tone }}
      followersCount={c.viewers}
      registeredCount={c.joinedCount}
      capacity={c.capacity}
      badges={badges(c)}
    />
  );
}

/**
 * What the last column of a «Listă» row says, decided by the LIST, not the row:
 *  - `status`: rows of mixed or registration states (Viitoare: «Înscrieri deschise» / «Complet»,
 *    results across tabs, Ale mele) — the pill is information;
 *  - `winner`: a list of finished competitions (Rezultate) — «Încheiat» on every row says nothing,
 *    the winner is the one useful fact, and gets the room;
 *  - `none`: a list that is all LIVE — the tab already says it.
 */
export type RowEnd = 'status' | 'winner' | 'none';

/**
 * Column template of the table layout, per RowEnd — shared by the head and the rows. Switched by
 * ListRows' container (`@3xl:` = the list is 768px wide), so a 640px centre at 1280 keeps the
 * stacked row and only a wide list gets columns. Participanți holds the count only (never wraps:
 * fixed width); the format / ranking badges sit under the name, one line.
 */
const ROW_GRID: Record<RowEnd, string> = {
  status: '@3xl:grid @3xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_--spacing(32)_--spacing(40)] @3xl:items-center @3xl:gap-6',
  // The name gets the room (it was the narrowest column in practice: 2.2fr minus the 68px thumb).
  winner: '@3xl:grid @3xl:grid-cols-[minmax(0,2.8fr)_minmax(0,1fr)_--spacing(32)_minmax(0,1.4fr)] @3xl:items-center @3xl:gap-6',
  none: '@3xl:grid @3xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_--spacing(32)] @3xl:items-center @3xl:gap-6',
};

export function CompetitionRowsHead({ end = 'status' }: { end?: RowEnd }) {
  return (
    <div className={ROW_GRID[end]}>
      <span className="pl-17">Concurs</span>
      <span>Baltă</span>
      <span>Participanți</span>
      {end === 'status' ? <span>Stare</span> : end === 'winner' ? <span>Câștigător</span> : null}
    </div>
  );
}

/**
 * The winner line (trophy = presence, so solid 20). `column`: the Câștigător cell's text — t-body,
 * one line (the table keeps one row height; the full name is in `title`), the same step as the
 * cell's «—» when there is no ranking.
 */
function Winner({ name, column = false }: { name: string; column?: boolean }) {
  return (
    <p className={cn('flex min-w-0 items-start gap-1', column ? 't-body text-ink' : 't-caption text-ink-2')} title={column ? name : undefined}>
      <TrophyIcon aria-hidden className={cn('shrink-0 text-rating', column ? 'mt-0.5 size-4' : 'mt-px size-3.5')} />
      <span className="sr-only">Câștigător: </span>
      <span className="line-clamp-1">{name}</span>
    </p>
  );
}

/**
 * «Listă»: a dense row. Stacked (narrow list): thumb + three lines; table (list ≥ 768): columns
 * under the head, every row one line high (the name clamps to one line, full name in `title`). The
 * status pill shows only where it says something (`end="status"`); on a finished list the winner
 * takes the last column. `priority`: the first rows of a list with no hero above them carry the
 * page's LCP image — fetched at once instead of lazily.
 */
export function CompetitionRow({
  competition: c,
  end = 'status',
  priority = false,
}: {
  competition: CompetitionCard;
  end?: RowEnd;
  priority?: boolean;
}) {
  const look = statusLook(c);
  const winner = c.status === 'completed' ? c.results?.podium.find((p) => p.position === 1) : undefined;
  const showPill = end === 'status';
  return (
    <li className="relative px-4 py-3.5 transition-colors duration-(--duration-fast) ease-fast focus-within:bg-soft-fill hover:bg-soft-fill">
      <div className={cn('flex items-start gap-3', ROW_GRID[end])}>
        <div className="flex min-w-0 flex-1 items-start gap-3 @3xl:items-center">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
            <Image
              src={competitionImage(c)}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-eyebrow text-muted uppercase">{dateLine(c)}</p>
            <h3 className="t-body-strong line-clamp-2 text-ink @3xl:line-clamp-1">
              <Link
                href={routes.competition(c.documentId)}
                title={c.name}
                className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-accent"
              >
                {c.name}
              </Link>
            </h3>
            <p className="t-caption truncate text-ink-2 @3xl:hidden">{lakeLine(c)}</p>
            {winner ? (
              <div className="mt-0.5 @3xl:hidden">
                <Winner name={winner.displayName} />
              </div>
            ) : null}
            <div className="mt-1.5 flex items-center gap-2 @3xl:hidden">
              {showPill ? <StatusPill tone={look.tone}>{look.label}</StatusPill> : null}
              <span className="t-label text-ink-2">{participants(c)}</span>
            </div>
            {/* Table: the attributes ride under the name, one line. The LAST badge gives way with an
                ellipsis inside it (never a hard clip mid-word at the column edge). */}
            <div className="mt-1 hidden min-w-0 gap-1 @3xl:flex">
              {badges(c).map((b, i, all) => (
                <Badge key={b.label} color={b.tone} className={i === all.length - 1 ? 'min-w-0 shrink!' : undefined}>
                  <span className="min-w-0 truncate" title={i === all.length - 1 ? b.label : undefined}>
                    {b.label}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden min-w-0 @3xl:block">
          <p className="t-body truncate text-ink">{c.lake?.name ?? '—'}</p>
        </div>
        <div className="hidden @3xl:block">
          <span className="t-body whitespace-nowrap text-ink tabular-nums">{participants(c)}</span>
        </div>
        {end === 'status' ? (
          <div className="hidden @3xl:block">
            <StatusPill tone={look.tone}>{look.label}</StatusPill>
          </div>
        ) : end === 'winner' ? (
          <div className="hidden min-w-0 @3xl:block">
            {winner ? (
              <Winner name={winner.displayName} column />
            ) : (
              // Same step as a winner (t-body), muted; a dash, not a phrase repeated down the column.
              <p className="t-body text-muted">
                <span aria-hidden>—</span>
                <span className="sr-only">Fără clasament</span>
              </p>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
