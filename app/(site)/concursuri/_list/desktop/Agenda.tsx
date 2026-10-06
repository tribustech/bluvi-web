import Link from 'next/link';
import { formatInt } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { dateWithHours, entrantsCount, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { FollowersPill } from '../Followers';
import type { PeopleOf } from './data';
import type { Face } from './model';
import { bucketOf, Cta, DateBlock, enrolledCount, FormatChips, LakeLine, PAST_BUCKET, ROW_LIST, STRETCHED_LINK, Thumb, upcomingCta } from './parts';
import { StartsIn } from './StartsIn';

/*
 * Viitoare on desktop (≥1024) — an agenda (owner: «îmi place A, e foarte clean»), with people:
 *  - grouped by time: this week, next week, then by month; one row per competition, one column
 *    template for every row, so rows never differ in height and every column lines up;
 *  - a face stack per row (Luma «+N going»): followed anglers first with an indigo ring, photos
 *    next; hovering opens the stack up and the tooltip lists the names;
 *  - one social-proof line when it is true («Andrei participă»);
 *  - the capacity bar with an honest label: «Ultimele 3 locuri», «Complet»;
 *  - a ticking «Începe în …» on the nearest competition only (the one animated thing in the list).
 * Signed out, the registrations route is closed (auth: required): only the card's faces show.
 */

/*
 * Compact, never stretched (§4b.5, §4b.16): from xl the name track is capped and the leftover width
 * goes to the CTA's track (the button sits at its end), so the chips, faces and bar stay next to the
 * name instead of floating mid-row at 1440+.
 */
const COLS =
  'grid-cols-[64px_minmax(0,1fr)_152px_232px_112px] xl:grid-cols-[64px_120px_minmax(0,480px)_168px_256px_minmax(112px,1fr)] 2xl:grid-cols-[64px_136px_minmax(0,560px)_176px_288px_minmax(112px,1fr)]';

export function Agenda({ cards, people }: { cards: CompetitionCard[]; people: Record<string, PeopleOf> }) {
  const now = new Date();
  const groups = new Map<string, { label: string; order: number; cards: CompetitionCard[] }>();
  for (const c of cards) {
    const b = bucketOf(c.startDate, now);
    const g = groups.get(b.key) ?? { label: b.label, order: b.order, cards: [] };
    g.cards.push(c);
    groups.set(b.key, g);
  }
  const nearest = cards
    .filter((c) => c.startDate && new Date(c.startDate).getTime() > now.getTime())
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0]?.documentId;
  return (
    <div className="flex flex-col gap-8">
      {[...groups.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, g]) => (
          <section key={key} aria-labelledby={`agenda-${key}`} className="flex flex-col gap-3">
            <h3 id={`agenda-${key}`} className={cn('flex items-baseline gap-2 t-title2', key === PAST_BUCKET ? 'text-muted' : 'text-ink')}>
              {g.label}
              <span className="t-body text-muted">{g.cards.length}</span>
            </h3>
            <ul className={ROW_LIST}>
              {g.cards.map((c) => {
                const p = people[c.documentId] ?? { faces: [], followed: [] };
                const href = routes.competition(c.documentId);
                return (
                  <li
                    key={c.documentId}
                    data-row=""
                    className={cn('relative grid items-center gap-5 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-soft-fill', COLS)}
                  >
                    <DateBlock card={c} />
                    <Thumb card={c} className="hidden h-20 rounded-control xl:block" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 t-eyebrow text-muted uppercase">
                        {dateWithHours(c)}
                        <span className="inline-flex normal-case">
                          <FollowersPill viewers={c.viewers} competitionId={c.documentId} />
                        </span>
                        {c.documentId === nearest && c.startDate ? <StartsIn iso={c.startDate} /> : null}
                      </p>
                      <Link href={href} className={cn('truncate t-heading text-ink', STRETCHED_LINK)}>
                        {c.name}
                      </Link>
                      <LakeLine card={c} />
                    </div>
                    <FormatChips card={c} />
                    <People card={c} faces={p.faces} followed={p.followed} />
                    <Cta href={href} rowHref={href} {...upcomingCta(c, key === PAST_BUCKET)} className="justify-self-end" />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** Faces + count on one line, the capacity bar under it, one honest status line. */
function People({ card: c, faces, followed }: { card: CompetitionCard; faces: Face[]; followed: string[] }) {
  const cap = c.capacity;
  const pct = cap ? Math.min(100, Math.round((c.joinedCount / cap) * 100)) : 0;
  const full = cap != null && c.placesLeft === 0;
  const tight = !full && cap != null && c.placesLeft != null && c.placesLeft <= Math.max(1, Math.ceil(cap * 0.2));
  const shown = faces.slice(0, 5);
  const more = Math.max(0, c.joinedCount - shown.length);
  const status = full
    ? 'Complet'
    : tight
      ? c.placesLeft === 1
        ? 'Ultimul loc'
        : `Ultimele ${c.placesLeft} locuri`
      : cap != null
        ? `${c.placesLeft} ${c.placesLeft === 1 ? 'loc liber' : 'locuri libere'}`
        : 'Fără limită de locuri';
  const named = faces.filter((f) => !f.name.startsWith('Participant '));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {shown.length ? (
          <span
            className="relative z-above flex shrink-0 items-center *:transition-[margin] *:duration-(--duration-fast) *:ease-fast *:not-first:-ml-2 hover:*:not-first:ml-0.5"
            title={named.length ? named.slice(0, 12).map((f) => f.name).join(', ') + (named.length > 12 ? ` și încă ${named.length - 12}` : '') : undefined}
            role="img"
            aria-label={`${enrolledCount(c.joinedCount, c.format.unit)}${named.length ? `, printre ei ${named.slice(0, 3).map((f) => f.name).join(', ')}` : ''}`}
          >
            {shown.map((f, i) => (
              <span key={`${f.name}-${i}`} className={cn('rounded-full', f.followed && 'shadow-[0_0_0_2px_var(--color-accent)]')}>
                <Avatar name={f.name} src={f.src} size={32} ring />
              </span>
            ))}
            {more > 0 ? (
              <span className="box-border inline-flex h-8 shrink-0 items-center rounded-full border-2 border-surface bg-soft-fill px-2.5 text-facestack-32 font-extrabold text-ink-2 tabular-nums">
                +{more}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="t-body-strong whitespace-nowrap text-ink tabular-nums">
            {c.joinedCount > 0
              ? cap != null
                ? `${formatInt(c.joinedCount)}/${formatInt(cap)} ${c.format.unit}`
                : entrantsCount(c.joinedCount, c.format.unit)
              : c.pendingCount > 0
                ? `${formatInt(c.pendingCount)} în așteptare`
                : 'Fii primul înscris'}
          </span>
          {followed.length ? (
            <span className="truncate t-caption text-accent-ink">
              {followed.length === 1 ? `${followed[0]} participă` : `${followed[0]} și încă ${followed.length - 1} pe care îi urmărești`}
            </span>
          ) : c.joinedCount > 0 && c.pendingCount > 0 ? (
            <span className="truncate t-caption text-muted">{formatInt(c.pendingCount)} în așteptare</span>
          ) : null}
        </span>
      </div>
      {cap != null ? (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-accent-tint-2" aria-hidden>
            <div className={cn('h-full rounded-full', full ? 'bg-faint' : tight ? 'bg-status-pending-fg' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </div>
          <span className={cn('shrink-0 t-caption', tight ? 'text-status-pending-fg' : full ? 'text-muted' : 'text-status-success-fg')}>{status}</span>
        </div>
      ) : (
        <span className="t-caption text-muted">{status}</span>
      )}
    </div>
  );
}
