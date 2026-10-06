import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { dateWithHours, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { MineState } from './data';
import { Cta, DateBlock, LakeLine, ROW_LIST, STRETCHED_LINK, Thumb, ValueBone } from './parts';

/*
 * Ale mele on desktop (≥1024) — one row per registration, led by MY status and my next step: the
 * registered list (fish scope registered, one mixed list: live → soonest → finished), my status from
 * /feed/competitions/:id/my-status and my stand from the registrations once the draw placed me;
 * finished, my place from my own registration (finalPlacement, else my ranking row by identity).
 * Unknown until those answer: a neutral bar, never a guessed status (ROADMAP §4b.4).
 */

/* The name track is capped from xl; the leftover width goes to the next-step text (§4b.16). */
const COLS = 'grid-cols-[64px_minmax(0,1fr)_200px_minmax(0,1fr)_128px] xl:grid-cols-[64px_120px_minmax(0,480px)_220px_minmax(0,1fr)_128px]';

type Pill = { label: string; tone: StatusTone };

function pillsOf(c: CompetitionCard, m: MineState): Pill[] {
  const out: Pill[] = [];
  if (c.status === 'started') out.push({ label: 'LIVE', tone: 'live' });
  if (m.status === 'pending') out.push({ label: 'În așteptare', tone: 'pending' });
  else if (m.status === 'registered') out.push({ label: 'Înscris', tone: 'success' });
  else if (m.status === 'rejected') out.push({ label: 'Respins', tone: 'neutral' });
  else if (m.status === 'cancelled') out.push({ label: 'Anulat', tone: 'cancelled' });
  if (m.stand) out.push({ label: `Stand ${m.stand}`, tone: 'info' });
  return out;
}

/** What I do next, in one line + the CTA it leads to. */
function nextStep(c: CompetitionCard, m: MineState): { label: string; text: string; cta: string } {
  if (c.status === 'started') {
    return { label: 'Acum', text: m.stand ? `Pescuiești la standul ${m.stand} · cântărirea e live` : 'Concursul e live', cta: 'Clasament live' };
  }
  if (c.status === 'completed') {
    // My place by identity (my registration), never by matching my name against the podium.
    return { label: 'Rezultat', text: m.place ? `Ai terminat pe locul ${m.place}` : 'Concurs încheiat · vezi unde ai terminat', cta: 'Rezultate' };
  }
  if (m.status === 'pending') return { label: 'Pasul următor', text: 'Organizatorul îți confirmă înscrierea', cta: 'Vezi' };
  if (m.status === 'rejected' || m.status === 'cancelled') return { label: 'Înscriere', text: 'Înscrierea nu mai e activă', cta: 'Vezi' };
  if (m.stand) {
    const start = c.hoursLabel ? `, ${c.hoursLabel.split('–')[0]}` : '';
    return { label: 'Pasul următor', text: `Standul ${m.stand} e al tău · începe ${c.dateLabel}${start}`, cta: 'Detalii' };
  }
  return { label: 'Pasul următor', text: 'Standurile se trag la sorți înainte de start', cta: 'Detalii' };
}

export function MineRows({ cards, states }: { cards: CompetitionCard[]; states: Record<string, MineState> }) {
  return (
    <ul className={ROW_LIST}>
      {cards.map((c) => {
        const m = states[c.documentId] ?? { status: undefined, stand: null, known: false };
        const step = nextStep(c, m);
        // A finished row waits for my place before it says anything about it.
        const stepKnown = c.status === 'completed' ? m.place !== undefined : m.known || c.status !== 'notStarted';
        const rowHref = routes.competition(c.documentId);
        const href = c.status === 'started' || c.status === 'completed' ? routes.competitionRanking(c.documentId) : rowHref;
        return (
          <li
            key={c.documentId}
            data-row=""
            className={cn('relative grid items-center gap-5 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-soft-fill', COLS)}
          >
            <DateBlock card={c} />
            <Thumb card={c} className="hidden h-20 rounded-control xl:block" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="t-eyebrow text-muted uppercase">{dateWithHours(c)}</p>
              <Link href={rowHref} className={cn('truncate t-heading text-ink', STRETCHED_LINK)}>
                {c.name}
              </Link>
              <LakeLine card={c} />
            </div>
            {m.known ? (
              <span className="flex flex-wrap gap-1.5">
                {pillsOf(c, m).map((p) => (
                  <StatusPill key={p.label} tone={p.tone}>
                    {p.label}
                  </StatusPill>
                ))}
              </span>
            ) : (
              <ValueBone className="w-24" />
            )}
            {stepKnown ? (
              <span className="flex min-w-0 flex-col">
                <span className="t-label text-muted uppercase">{step.label}</span>
                <span className="t-body text-ink">{step.text}</span>
              </span>
            ) : (
              <ValueBone className="w-40" />
            )}
            <Cta href={href} rowHref={rowHref} label={step.cta} variant={c.status === 'started' ? 'primary' : 'secondary'} className="justify-self-end" />
          </li>
        );
      })}
    </ul>
  );
}
