'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon, PhoneIcon } from '@heroicons/react/24/outline';
import {
  DEFAULT_PARTICIPANTS_LIMIT,
  getParticipationType,
  getRankingTypeLabel,
  registrationCounts,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import type { RichTextNode } from '@/core/shared';
import { DetailAsideCard, type DetailFact } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { speciesImage } from './species';

/*
 * Parts shared by the competition's Informații, Regulament and Preview: the «Detalii» facts (the kit
 * DetailFacts), the Contact card (fish CompetitionContact), the banner, the species, the meter.
 */

/**
 * A definition list with every fact's label (t-caption, muted) over its value, hairlines between —
 * the narrow ≥1280 left column (Preview, Informații, Regulament, Extra Cântare). `from="xl"`: a
 * label | value row below 1280 that stacks from 1280 (Preview's «Detalii», which sits in a pair
 * below 1280). Its own markup — never the kit DetailFacts' DOM restyled from outside.
 * TODO(kit, T3 owner): move to DetailFacts as `layout="stacked"` and use it on the lake page too.
 */
export function StackedFacts({ facts, from = 'always', className }: { facts: DetailFact[]; from?: 'always' | 'xl'; className?: string }) {
  if (!facts.length) return null;
  const xl = from === 'xl';
  return (
    <dl className={cn('flex flex-col', className)}>
      {facts.map(f => (
        <div
          key={f.key}
          className={cn(
            'flex border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0',
            xl ? 'items-center gap-3 xl:flex-col xl:items-start xl:gap-0.5' : 'flex-col items-start gap-0.5',
          )}
        >
          <dt className={cn('whitespace-nowrap', xl ? 'min-w-0 flex-1 t-body text-ink-2 xl:flex-none xl:t-caption xl:text-muted' : 't-caption text-muted')}>{f.label}</dt>
          <dd className={cn('t-body-strong text-ink', xl && 'max-w-3/5 text-right xl:max-w-none xl:text-left')}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const LINK_FOCUS = 'rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/**
 * Informații's four facts: fee, ranking type, participation type, registrations (fish CompetitionInfo).
 * Plain t-body-strong values in both layouts (the ranking type in the accent ink, as fish's indigo
 * badge text), so every value starts at the tile's edge and has one line height:
 *  - `grid` (the kit DetailFacts tiles below 1280): the registrations an inline link, its pending
 *    count as text — every tile's value row the same height, the four labels on one baseline;
 *  - `stacked` (StackedFacts, the ≥1280 left column): the pending count as a status pill.
 */
export function competitionFacts(c: CompetitionWithMyStatus, layout: 'grid' | 'stacked' = 'grid'): DetailFact[] {
  const { approved, pending } = registrationCounts(c.registrations);
  const limit = c.participantsLimit || DEFAULT_PARTICIPANTS_LIMIT;
  const team = c.competitionType === 'team';
  // fish: the pending count only before the start.
  const waiting = c.competitionStatus === 'notStarted' && pending > 0 ? pending : 0;
  const count = (
    <Link href={routes.competitionParticipants(c.documentId)} className={cn('tabular-nums hover:underline', LINK_FOCUS)}>
      {approved} / {limit}
      <span className="sr-only">, vezi participanții</span>
      <ChevronRightIcon aria-hidden className="ml-1 inline size-4 align-middle text-muted" />
    </Link>
  );
  return [
    { key: 'taxa', label: 'Taxă de înscriere', value: c.registerFee ? `${c.registerFee} lei` : 'Intrare gratuită' },
    { key: 'tip', label: 'Tipul de concurs', value: <span className="text-accent-ink">{getRankingTypeLabel(c)}</span> },
    { key: 'participare', label: 'Tipul de participare', value: getParticipationType(c) },
    {
      key: 'inscrieri',
      label: team ? 'Echipe înscrise' : 'Participanți înscriși',
      // fish: pressing it opens the Participanți tab.
      value:
        layout === 'grid' ? (
          <>
            {count}
            {waiting ? <span className="text-muted"> · {waiting} în așteptare</span> : null}
          </>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {count}
            {waiting ? <StatusPill tone="pending">{waiting} în așteptare</StatusPill> : null}
          </span>
        ),
    },
  ];
}

/** «Detalii» in the ≥1280 left column (an h2: the left column comes first in the DOM). */
export function FactsAside({ competition }: { competition: CompetitionWithMyStatus }) {
  return (
    <DetailAsideCard title="Detalii" as="h2">
      <StackedFacts facts={competitionFacts(competition, 'stacked')} />
    </DetailAsideCard>
  );
}

/* ------------------------------------------------------------------ */
/* Contact — fish CompetitionContact                                   */
/* ------------------------------------------------------------------ */

/** The right column's Contact card (an h3 after the centre's h2s; its groups are h4s). */
export function ContactSection({ competition: c, title = 'Contact' }: { competition: CompetitionWithMyStatus; title?: string }) {
  const lakeContacts = c.lake?.contact ?? [];
  const empty = !c.author && c.referees.length === 0 && lakeContacts.length === 0;
  return (
    <DetailAsideCard title={title}>
      {empty ? (
        <p className="t-body text-ink-2">Nu există date de contact pentru acest concurs.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {c.author ? <ContactGroup title="Organizator Concurs" people={[{ key: c.author.documentId, name: c.author.username, phone: c.author.phone }]} /> : null}
          {c.referees.length > 0 ? (
            <ContactGroup
              title={c.referees.length === 1 ? 'Arbitru' : 'Arbitri'}
              people={c.referees.map(r => ({ key: r.documentId, name: r.username, phone: r.phone }))}
            />
          ) : null}
          {lakeContacts.map(lc => (
            <ContactGroup key={lc.id} title={lc.header ?? undefined} people={[{ key: String(lc.id), name: lc.name ?? '', phone: lc.phone }]} />
          ))}
        </div>
      )}
    </DetailAsideCard>
  );
}

/** The role is a label (t-caption, muted — as the facts' labels), the person the data (body-strong). */
function ContactGroup({ title, people }: { title?: string; people: { key: string; name: string; phone: string | null | undefined }[] }) {
  return (
    <div className="flex flex-col">
      {title ? <h4 className="t-caption text-muted">{title}</h4> : null}
      <ul className="flex flex-col">
        {people.map(p => (
          <li key={p.key} className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0 t-body-strong text-ink">{p.name || '–'}</span>
            {p.phone ? (
              // fish: a phone is a tel: link (analytics contact_pressed lands with GA4 in M8).
              <a
                href={`tel:${p.phone.replace(/\s+/g, '')}`}
                aria-label={p.name ? `Sună pe ${p.name}: ${p.phone}` : `Sună la ${p.phone}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-1 t-body-strong text-accent-ink tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                <PhoneIcon aria-hidden className="size-4" />
                {p.phone}
              </a>
            ) : (
              // No phone: the same dash as a missing name (fish «-»), not a link.
              <span className="shrink-0 t-body text-muted">
                –<span className="sr-only">fără telefon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banner                                                              */
/* ------------------------------------------------------------------ */

type Banner = NonNullable<CompetitionWithMyStatus['banner']>;

/** A banner narrower than this (CSS px) is shown at its own size on a card, at every width. */
const SMALL_BANNER_PX = 640;

export function bannerSource(banner: Banner): string {
  return banner.formats.large?.url ?? banner.formats.medium?.url ?? banner.formats.small?.url ?? banner.url;
}

export function bannerShape(banner: Pick<Banner, 'width' | 'height'>): { w: number; h: number; known: boolean; small: boolean } {
  const w = banner.width || 0;
  const h = banner.height || 0;
  const known = w > 0 && h > 0;
  return { w, h, known, small: known && w < SMALL_BANNER_PX };
}

/**
 * The competition's banner (fish: first, at its own aspect ratio). Never upscaled past its own size,
 * and its box never depends on the image decoding (width / height known → the ratio is reserved):
 *  - a large banner: at its own ratio at every width (fish), edge to edge on the phone like the T3
 *    blocks around it; from 768 a card (radius, e0), capped at 480px tall — a very tall poster is
 *    cropped there (object-cover), never letterboxed on a grey stage;
 *  - a small one (a logo-sized upload): at its own size, centred on a white card at every width —
 *    a crisp logo, not a 100px picture blown up to the column;
 *  - unknown size: a 16:9 card, cropped (as before the CMS knew sizes).
 */
export function CompetitionBanner({ banner, name }: { banner: Banner; name: string }) {
  const { w, h, known, small } = bannerShape(banner);
  const image = (className: string, style?: CSSProperties) => (
    <Image
      src={bannerSource(banner)}
      alt={`Afișul concursului ${name}`}
      width={w || 1600}
      height={h || 900}
      sizes={small ? `${w}px` : '(min-width: 1280px) 50vw, (min-width: 768px) 720px, 100vw'}
      priority
      style={style}
      className={className}
    />
  );
  if (small) {
    return (
      <div className="flex items-center justify-center bg-surface p-6 md:rounded-card md:shadow-e0">
        {image('h-auto w-full', { maxWidth: `${w}px`, maxHeight: `${h}px` })}
      </div>
    );
  }
  if (!known) {
    return <div className="relative aspect-video overflow-hidden bg-soft-fill md:rounded-card md:shadow-e0">{image('size-full object-cover')}</div>;
  }
  return (
    // At most the upload's own width (CSS px), centred when the column is wider.
    <div className="flex justify-center">{image('h-auto w-full object-cover md:max-h-120 md:rounded-card md:shadow-e0', { maxWidth: `${w}px` })}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Species — fish CompetitionInfo «Pești de prins»                     */
/* ------------------------------------------------------------------ */

/**
 * fish FishSpeciesList: one card per species — its artwork (fish getFishImage, ./species) contained
 * on a white 2:1 card, the name under it. fish scrolls them sideways; the web lays them on an
 * auto-fill grid of fixed ~152px tiles (as the sponsors: more per row as the screen grows, never
 * wider cards).
 * TODO(kit, T3 owner): move to the T3 kit (DetailSpecies) and use it on the lake page's FishList too.
 */
export function SpeciesList({ species, label }: { species: { id: string; name: string }[]; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-[repeat(auto-fill,--spacing(38))] gap-3">
      {species.map(s => (
        <li key={s.id} data-species className="flex flex-col gap-1.5">
          <span className="relative block aspect-2/1 w-full overflow-hidden rounded-control bg-surface shadow-e0">
            <Image src={speciesImage(s.name)} alt="" fill sizes="152px" className="object-contain" />
          </span>
          <span className="t-label text-ink">{s.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Meter                                                               */
/* ------------------------------------------------------------------ */

/**
 * The kit's meter (BentoTile StatTile `progress`: 6px, accent on accent-tint-2; a pill — the radius
 * token, not BentoTile's raw 3px), with an optional thumb (fish's read-only slider) held inside the
 * track's ends. TODO(kit, ui owner): extract StatTile's bar as components/ui/Meter (track, fill,
 * thumb, progressbar ARIA, rounded-full) and use it in BentoTile and here.
 */
export function Meter({
  value,
  label,
  valueText,
  thumb = false,
}: {
  /** 0–100, or null while unknown (an empty track). */
  value: number | null;
  label: string;
  valueText: string;
  thumb?: boolean;
}) {
  const pct = value === null ? null : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={valueText}
      className="relative flex h-4 items-center"
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-tint-2">
        {pct !== null ? <div className="h-full bg-accent" style={{ width: `${pct}%` }} /> : null}
      </div>
      {thumb && pct !== null ? (
        <span
          aria-hidden
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-e0"
          style={{ left: `clamp(8px, ${pct}%, calc(100% - 8px))` }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rich-text links                                                     */
/* ------------------------------------------------------------------ */

/**
 * fish CustomBlocksRenderer: a link whose url starts with «tel» is a phone — organizers save
 * «tel0712…», which the browser would resolve as a relative page. Rewritten to «tel:0712…».
 * TODO(kit, T3 owner): DetailProse should render tel: links without target=_blank, with a PhoneIcon,
 * and mark external links «(se deschide într-o filă nouă)».
 */
export function normalizeRichLinks(blocks: RichTextNode[]): RichTextNode[] {
  const walk = (n: RichTextNode): RichTextNode => {
    const url = n.type === 'link' && typeof n.url === 'string' ? n.url.trim() : null;
    const fixed = url && /^tel/i.test(url) && !/^tel:/i.test(url) ? `tel:${url.slice(3).replace(/\s+/g, '')}` : null;
    const kids = n.children?.map(walk);
    return fixed || kids ? { ...n, ...(fixed ? { url: fixed } : {}), ...(kids ? { children: kids } : {}) } : n;
  };
  return blocks.map(walk);
}
