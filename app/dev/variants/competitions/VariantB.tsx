import Link from 'next/link';
import type { ReactNode } from 'react';
import { EyeIcon } from '@heroicons/react/20/solid';
import { Pill } from '@/components/cards/parts';
import { formatInt } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { MineRow, VariantData } from './data';
import { Cta, FormatChips, kg, lakeLine, MedalChip, myStatusPills, nextStep, Places, Thumb, upcomingCta, type TabKey } from './shared';

/*
 * B — «Uniform cards»: ONE anatomy for every tab, every slot a fixed size:
 *   photo 16:10 · status pills on it · title clamped to 2 lines (its 2-line box is reserved) ·
 *   one meta line (date · lake) · format chips · a 72px footer whose CONTENT changes by status
 *   (places + CTA / live numbers / winner / my status + next step).
 * Equal heights by construction, in an auto-fill grid (more columns as the screen grows).
 */

export function VariantB({ tab, data }: { tab: TabKey; data: VariantData }) {
  const items: Array<{ card: CompetitionCard; mine?: MineRow }> =
    tab === 'viitoare'
      ? data.upcoming.map((card) => ({ card }))
      : tab === 'live'
        ? data.live.map((card) => ({ card }))
        : tab === 'rezultate'
          ? data.completed.map((card) => ({ card }))
          : data.mine.map((m) => ({ card: m.card, mine: m }));
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-5">
      {items.map(({ card, mine }) => (
        <UniformCard key={card.documentId} card={card} mine={mine} viewerName={data.viewerName} />
      ))}
    </div>
  );
}

function UniformCard({ card: c, mine, viewerName }: { card: CompetitionCard; mine?: MineRow; viewerName: string | null }) {
  const href = routes.competition(c.documentId);
  return (
    <article className="relative flex flex-col overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)] transition-shadow duration-(--duration-fast) hover:shadow-[var(--shadow-e2),var(--shadow-e0)]">
      <Thumb card={c} big sizes="(min-width: 1280px) 320px, 50vw" className="aspect-[16/10] w-full">
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <PhotoPills card={c} mine={mine} />
        </div>
      </Thumb>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 min-h-11 t-heading text-ink">
          <Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-accent">
            {c.name}
          </Link>
        </h3>
        <p className="truncate t-caption text-muted">
          <span className="t-label text-ink-2">{c.dateLabel}</span> · {lakeLine(c)}
        </p>
        <FormatChips card={c} size="sm" />
      </div>
      <footer className="flex h-18 shrink-0 items-center gap-3 border-t border-hairline px-4">
        <Footer card={c} mine={mine} viewerName={viewerName} href={href} />
      </footer>
    </article>
  );
}

function PhotoPills({ card: c, mine }: { card: CompetitionCard; mine?: MineRow }): ReactNode {
  if (mine) {
    return (
      <>
        {myStatusPills(mine)
          .filter((p) => p.tone !== 'info')
          .map((p) => (
            <Pill key={p.label} tone={p.tone === 'live' ? 'live' : 'light'}>
              {p.label}
            </Pill>
          ))}
        {mine.sample ? <Pill tone="scrim">Exemplu</Pill> : null}
      </>
    );
  }
  if (c.status === 'started') {
    return (
      <>
        <Pill tone="live">LIVE</Pill>
        {c.viewers > 0 ? (
          <Pill tone="scrim">
            <EyeIcon aria-hidden className="size-3" />
            {formatInt(c.viewers)}
          </Pill>
        ) : null}
      </>
    );
  }
  if (c.status === 'completed') return <Pill tone="scrim">Încheiat</Pill>;
  if (c.capacity != null && c.placesLeft === 0) return <Pill tone="scrim">Complet</Pill>;
  if (c.capacity != null && c.placesLeft != null && c.placesLeft <= 3) return <Pill tone="light">Ultimele {c.placesLeft} locuri</Pill>;
  return <Pill tone="light">Înscrieri deschise</Pill>;
}

function Footer({ card: c, mine, viewerName, href }: { card: CompetitionCard; mine?: MineRow; viewerName: string | null; href: string }) {
  if (mine) {
    const step = nextStep(mine, viewerName);
    return (
      <>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-label text-ink">{mine.stand ? `Stand ${mine.stand}` : 'Fără stand încă'}</span>
          <span className="line-clamp-2 t-caption text-muted">{step.text}</span>
        </span>
        <Cta href={href} label={step.cta} variant={c.status === 'started' ? 'primary' : 'secondary'} />
      </>
    );
  }
  if (c.status === 'started') {
    return (
      <>
        <Stat value={kg(c.results?.biggestFishKg)} unit={c.results?.biggestFishKg != null ? 'kg' : null} label="cea mai mare" />
        <Stat value={formatInt(c.results?.catchCount ?? 0)} label="capturi" />
        <Cta href={href} label="Live" variant="primary" className="ms-auto" />
      </>
    );
  }
  if (c.status === 'completed') {
    const w = c.results?.podium[0];
    return (
      <>
        {w ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar name={w.displayName} src={w.avatarUrls[0] ?? null} size={32} />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1 t-caption text-muted">
                <MedalChip position={1} className="size-4" /> Câștigător
              </span>
              <span className="truncate t-label text-ink">{w.displayName}</span>
            </span>
          </span>
        ) : (
          <span className="flex-1 t-caption text-muted">{c.results?.hasCatches ? 'Clasament în lucru' : 'Fără capturi'}</span>
        )}
        <Stat value={kg(c.results?.biggestFishKg)} unit={c.results?.biggestFishKg != null ? 'kg' : null} label="cea mai mare" align="end" />
      </>
    );
  }
  const cta = upcomingCta(c);
  return (
    <>
      <Places card={c} className="flex-1" />
      <Cta href={href} {...cta} />
    </>
  );
}

function Stat({ value, unit, label, align = 'start' }: { value: string; unit?: string | null; label: string; align?: 'start' | 'end' }) {
  return (
    <span className={align === 'end' ? 'flex shrink-0 flex-col items-end' : 'flex shrink-0 flex-col'}>
      <span className="t-num-18 text-ink">
        {value}
        {unit ? <span className="ms-0.5 t-caption text-muted">{unit}</span> : null}
      </span>
      <span className="t-caption text-muted">{label}</span>
    </span>
  );
}
