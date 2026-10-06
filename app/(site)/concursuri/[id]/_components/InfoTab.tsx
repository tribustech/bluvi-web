'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { competitionProgress, type CompetitionWithMyStatus } from '@/core/competitions';
import { DetailAsideCard, DetailBody, DetailFacts, DetailSection } from '@/components/templates/T3';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { competitionDuration, timeBadge } from './dates';
import { CompetitionBanner, competitionFacts, ContactSection, FactsAside, Meter, normalizeRichLinks, SpeciesList } from './infoParts';
import { ClampedRichText } from './tabParts';

/*
 * Concurs · Informații — fish components/competition/CompetitionInfo.tsx + CompetitionContact.tsx
 * (parity competition-page.informatii) on the T3 body:
 *  - below 1280 fish's order, one column — banner, Descriere, the four facts (the kit DetailFacts
 *    tiles: two by two on the phone, four in a row from 768), Durata, Pești de prins, Premii,
 *    Contact, Sponsori;
 *  - from 1280 the three columns (ROADMAP §4): the facts on the left (StackedFacts — the same
 *    block Preview shows there; an h2 card), the reading content in the centre (banner, Descriere,
 *    Durata, Pești, Premii), Contact and Sponsori on the right (DetailAsideCard, h3).
 * The facts render twice (left column ≥1280, centre below), one of them display:none — as Preview.
 * The banner is never blown up past its own size (CompetitionBanner).
 *
 * Web differences: fish's «Taxă de inscriere» is spelt «Taxă de înscriere»; «CONTACT» is the
 * sentence-case section title «Contact» and the duration dates are sentence case (Fundații: no
 * all-caps); «51 de ore» (fish: «51 ore»); sponsors are an auto-fill grid, not a sideways rail.
 */

export function InfoTab({ competition }: { competition: CompetitionWithMyStatus }) {
  const c = competition;
  return (
    <DetailBody
      left={<FactsAside competition={c} />}
      leftLabel="Detalii"
      aside={
        <>
          <ContactSection competition={c} />
          {c.sponsors.length > 0 ? <SponsorsSection sponsors={c.sponsors} /> : null}
        </>
      }
      asideLabel="Contact și sponsori"
    >
      {c.banner ? <CompetitionBanner banner={c.banner} name={c.name} /> : null}

      {c.description?.length ? (
        <DetailSection id="descriere" title="Descriere">
          <ClampedRichText blocks={normalizeRichLinks(c.description)} title="Descriere" />
        </DetailSection>
      ) : null}

      {/* Below 1280 (from 1280 the left column has them). */}
      <DetailSection title="Detalii" className="xl:hidden">
        <DetailFacts layout="grid" className="md:grid-cols-4" facts={competitionFacts(c, 'grid')} />
      </DetailSection>

      <DurationSection competition={c} />

      {c.fishType.length > 0 ? (
        <DetailSection id="pesti" title="Pești de prins">
          <SpeciesList label="Pești de prins" species={c.fishType.map(f => ({ id: f.documentId, name: f.Name }))} />
        </DetailSection>
      ) : null}

      {c.reward?.length ? (
        <DetailSection id="premii" title="Premii">
          <ClampedRichText blocks={normalizeRichLinks(c.reward)} title="Premii" />
        </DetailSection>
      ) : null}
    </DetailBody>
  );
}

/* ------------------------------------------------------------------ */
/* Durata concursului                                                  */
/* ------------------------------------------------------------------ */

const MINUTE = 60_000;

/**
 * fish's read-only slider: the elapsed share of the competition, with the start and end markers
 * under the track's ends. The share depends on the clock, so the server render (and the static
 * shell) takes it from the status — 0 before the start, 100 once ended, unknown while running — and
 * the browser computes it and keeps it moving (once a minute).
 */
function DurationSection({ competition: c }: { competition: CompetitionWithMyStatus }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, MINUTE);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const progress = now
    ? competitionProgress(c.startDate, c.endDate, now)
    : c.competitionStatus === 'notStarted'
      ? 0
      : c.competitionStatus === 'completed'
        ? 100
        : null;
  const start = timeBadge(c.startDate);
  const end = timeBadge(c.endDate);
  return (
    <DetailSection id="durata" title={`Durata concursului (${competitionDuration(c.startDate, c.endDate)})`}>
      <div className="flex flex-col gap-2">
        <Meter thumb value={progress} label="Timp scurs din concurs" valueText={progress === null ? 'Se calculează' : `${progress}%`} />
        <div className="flex justify-between gap-4">
          <TimeMark label="Începe" {...start} />
          <TimeMark label="Se termină" {...end} align="end" />
        </div>
      </div>
    </DetailSection>
  );
}

function TimeMark({ label, time, date, dateLong, align = 'start' }: { label: string; time: string; date: string; dateLong: string; align?: 'start' | 'end' }) {
  return (
    <p className={cn('flex flex-col gap-1', align === 'end' ? 'items-end text-right' : 'items-start')}>
      <span className="sr-only">{label}: </span>
      {/* The end mark's badge sits flush right, under the bar's end (Badge is self-start). */}
      <Badge color="indigo" className={cn('tabular-nums', align === 'end' && 'self-end!')}>
        {time}
      </Badge>
      <span className="t-caption text-muted md:hidden">{date}</span>
      <span className="t-caption text-muted max-md:hidden">{dateLong}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Sponsori — fish SponsorsList                                        */
/* ------------------------------------------------------------------ */

function SponsorsSection({ sponsors }: { sponsors: CompetitionWithMyStatus['sponsors'] }) {
  return (
    <DetailAsideCard title="Sponsori">
      {/* Auto-fill: more logos per row as the column grows, never wider tiles (fixed 128px tiles). */}
      <ul className="grid grid-cols-[repeat(auto-fill,--spacing(32))] gap-3">
        {sponsors.map(s => (
          <li key={s.documentId}>
            <Link
              href={routes.sponsor(s.documentId)}
              className="group flex flex-col gap-1.5 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
            >
              <span className="relative flex aspect-8/5 w-full items-center justify-center overflow-hidden rounded-card bg-page shadow-e0 transition-shadow duration-(--duration-fast) ease-fast group-hover:shadow-e2">
                {s.image?.url ? (
                  <Image src={s.image.url} alt="" fill sizes="128px" className="object-contain p-3" />
                ) : (
                  <span aria-hidden className="p-2 text-center t-body-strong text-ink">
                    {s.name}
                  </span>
                )}
              </span>
              <span className="text-center t-label text-ink group-hover:underline">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DetailAsideCard>
  );
}
