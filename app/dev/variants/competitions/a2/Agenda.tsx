import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatInt } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { dateWithHours, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { bucketOf, Cta, DateBlock, FormatChips, LakeLine, Thumb, upcomingCta } from '../shared';
import type { Face, UpcomingPeople } from './data';
import { StartsIn } from './StartsIn';
import s from './a2.module.css';

/*
 * A2 · Viitoare — A's agenda, kept clean (owner: «îmi place A, e foarte clean»), plus people:
 *  - a face stack per row (Luma «+N going», Meetup's footer stack): followed anglers first with an
 *    indigo ring, photos next; hovering the stack opens it up and the tooltip lists the names;
 *  - one social-proof line when it is true (Partiful's guest list: «Andrew participă»);
 *  - the capacity bar with an honest label (Eventbrite urgency): «Ultimele 3 locuri», «Complet»;
 *  - a ticking «Începe în …» on the nearest competition only (the one animated thing in the list).
 * Signed out, the registrations route is closed (auth: required): only the card's faces show.
 */

const COLS = 'grid-cols-[64px_120px_minmax(0,1fr)_168px_256px_112px] 2xl:grid-cols-[64px_136px_minmax(0,1fr)_176px_288px_112px]';

export function Agenda({ cards, people }: { cards: CompetitionCard[]; people: UpcomingPeople }) {
  const now = new Date();
  const groups = new Map<string, { label: string; order: number; cards: CompetitionCard[] }>();
  for (const c of cards) {
    const b = bucketOf(c.startDate, now);
    const g = groups.get(b.key) ?? { label: b.label, order: b.order, cards: [] };
    g.cards.push(c);
    groups.set(b.key, g);
  }
  const nearest = cards.filter((c) => c.startDate && new Date(c.startDate).getTime() > now.getTime()).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0]?.documentId;
  let i = 0;
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
            <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">
              {g.cards.map((c) => {
                const cta = upcomingCta(c);
                const faces = people.faces[c.documentId] ?? [];
                const followed = people.followedNames[c.documentId] ?? [];
                return (
                  <li
                    key={c.documentId}
                    className={cn('relative grid items-center gap-5 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-soft-fill', COLS, s.rise)}
                    style={{ '--i': i++ } as CSSProperties}
                  >
                    <DateBlock card={c} />
                    <Thumb card={c} className="h-20 rounded-control" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex items-center gap-2 t-eyebrow text-muted uppercase">
                        {dateWithHours(c)}
                        {c.documentId === nearest && c.startDate ? <StartsIn iso={c.startDate} /> : null}
                      </p>
                      <Link
                        href={routes.competition(c.documentId)}
                        className="truncate t-heading text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                      >
                        {c.name}
                      </Link>
                      <LakeLine card={c} />
                    </div>
                    <FormatChips card={c} />
                    <People card={c} faces={faces} followed={followed} />
                    <Cta href={routes.competition(c.documentId)} {...cta} className="justify-self-end" />
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
  const status = full ? 'Complet' : tight ? (c.placesLeft === 1 ? 'Ultimul loc' : `Ultimele ${c.placesLeft} locuri`) : cap != null ? `${c.placesLeft} locuri libere` : 'Fără limită de locuri';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {shown.length ? (
          <span
            className="group/faces relative z-above flex shrink-0 items-center *:transition-[margin] *:duration-(--duration-fast) *:ease-fast *:not-first:-ml-2 hover:*:not-first:ml-0.5"
            title={faces.slice(0, 12).map((f) => f.name).join(', ') + (faces.length > 12 ? ` și încă ${faces.length - 12}` : '')}
            role="img"
            aria-label={`${formatInt(c.joinedCount)} ${c.format.unit} înscriși${faces.length ? `, printre ei ${faces.slice(0, 3).map((f) => f.name).join(', ')}` : ''}`}
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
            {c.joinedCount === 0 ? 'Fii primul înscris' : `${formatInt(c.joinedCount)}${cap != null ? `/${formatInt(cap)}` : ''} ${c.format.unit}`}
          </span>
          {followed.length ? (
            <span className="truncate t-caption text-accent-ink">
              {followed.length === 1 ? `${followed[0]} participă` : `${followed[0]} și încă ${followed.length - 1} pe care îi urmărești`}
            </span>
          ) : null}
        </span>
      </div>
      {cap != null ? (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-accent-tint-2" aria-hidden>
            <div className={cn('h-full rounded-full', full ? 'bg-faint' : tight ? 'bg-status-pending-fg' : 'bg-accent')} style={{ width: `${pct}%` }} />
          </div>
          <span className={cn('shrink-0 t-caption', tight ? 'text-status-pending-fg' : 'text-muted')}>{status}</span>
        </div>
      ) : (
        <span className="t-caption text-muted">{status}</span>
      )}
    </div>
  );
}
