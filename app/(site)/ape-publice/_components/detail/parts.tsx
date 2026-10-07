'use client';

import {
  ArrowsPointingOutIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  GlobeEuropeAfricaIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Dialog } from '@/components/surfaces/Dialog';
import { H3_CLASS, type DetailFact } from '@/components/templates/T3';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { formatDecimal, formatInt } from '@/components/cards/format';
import { FactTile } from '@/components/ui/BentoTile';
import { DIRECTIONS_UNAVAILABLE, directionsLinks, publicWaterFacts, type PublicWaterDetail } from '@/core/lakes';

/*
 * Pieces of the public-water page that the T3 kit has no part for yet.
 */

const noSubscribe = () => () => {};

export type QuickAction = {
  key: string;
  label: string;
  icon: ReactNode;
  /** A page link (`external`: another site, new tab)… */
  href?: string;
  external?: boolean;
  /** …or an action on this page (Direcții opens the chooser; Capturi scrolls to its section). With
   * neither, the web does not have it yet: named in the «În curând pe web: …» line, never a tile. */
  onClick?: () => void;
  badge?: number;
  /** What the badge counts, for screen readers («2 partide active acum»): read after the label. */
  badgeLabel?: (n: number) => string;
  /** From 1024 the summary card carries it (Direcții, the map): no tile there. */
  belowSummary?: boolean;
};

const TILE =
  'group flex w-full cursor-pointer flex-col items-center gap-2 rounded-control text-center transition-opacity duration-(--duration-fast) ease-fast active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * fish VenueQuickActions on the T3 DetailQuickActions look (64px accent tiles, the label under,
 * a red count pill on the corner, four spread across a phone row, 64px tracks 24 apart from 768),
 * with the kit's rules — a tile only for what the web has (link, external link or an action on the
 * page), everything else named once in the muted «În curând pe web: …» line — plus button tiles.
 * TODO(kit): DetailQuickActions `onClick` (button tiles); then this, and the lake's own copy, go.
 */
export function QuickActions({ actions, title = 'Acțiuni rapide', className }: { actions: QuickAction[]; title?: string; className?: string }) {
  const shown = actions.filter((a) => a.href || a.onClick);
  const later = actions.filter((a) => !a.href && !a.onClick);
  if (!actions.length) return null;
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <h3 className={H3_CLASS}>{title}</h3>
      {shown.length ? (
        <ul
          className={cn(
            'grid gap-y-4',
            shown.length >= 4
              ? 'grid-cols-[repeat(4,--spacing(16))] justify-between md:grid-cols-[repeat(auto-fill,--spacing(16))] md:justify-start md:gap-x-6'
              : 'grid-cols-[repeat(auto-fill,--spacing(16))] justify-start gap-x-6',
          )}
        >
          {shown.map((a) => {
            const tile = (
              <>
                <span className="relative flex size-16 items-center justify-center rounded-card bg-accent-tint-2 text-accent-ink transition-[filter] duration-(--duration-fast) ease-fast group-hover:brightness-95 [&>svg]:size-6">
                  {a.icon}
                  {a.badge ? (
                    <span aria-hidden={a.badgeLabel ? true : undefined} className="absolute -top-1.25 -right-1.25 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-status-live-bg px-1.25 t-micro-strong text-status-live-fg">
                      {a.badge}
                    </span>
                  ) : null}
                </span>
                <span className="t-label whitespace-nowrap">{a.label}</span>
                {/* The visible label stays the name; the count is read after it. */}
                {a.badge && a.badgeLabel ? <span className="sr-only">{`, ${a.badgeLabel(a.badge)}`}</span> : null}
              </>
            );
            return (
              <li key={a.key} className={cn('flex justify-center', a.belowSummary && 'min-[1024px]:hidden')}>
                {a.href && a.external ? (
                  <a href={a.href} target="_blank" rel="noopener noreferrer" className={TILE} data-action={a.key}>
                    {tile}
                    <span className="sr-only"> (se deschide într-o filă nouă)</span>
                  </a>
                ) : a.href ? (
                  <Link href={a.href} className={TILE} data-action={a.key}>
                    {tile}
                  </Link>
                ) : (
                  <button type="button" onClick={a.onClick} className={TILE} data-action={a.key}>
                    {tile}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {later.length ? (
        <p className="t-caption text-muted" data-testid="quick-actions-later">
          În curând pe web: {later.map((a) => a.label).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}

const FACT_ICON: Record<string, ReactNode> = {
  basin: <GlobeEuropeAfricaIcon />,
  area: <ArrowsPointingOutIcon />,
  volume: <BeakerIcon />,
  elevation: <ArrowTrendingUpIcon />,
  euCode: <HashtagIcon />,
};

/** A numeric fact: fish's rounding (toFixed), drawn in Romanian notation, the unit a word of its own. */
export type WaterFigure = { key: 'area' | 'volume' | 'elevation'; label: string; value: string; unit: string };

/**
 * The water's numeric facts (core publicWaterFacts' presence rules and fish's toFixed rounding),
 * in Romanian notation — «0,18», never «0.18» beside the coordinates' «44,40606°» — with the unit
 * apart (owner rule 10). formatDecimal / formatInt, not Intl: server and client draw the same string.
 */
export function waterFigures(water: Pick<PublicWaterDetail, 'areaKm2' | 'volumeMilM3' | 'elevationM'>): WaterFigure[] {
  const out: WaterFigure[] = [];
  if (water.areaKm2) out.push({ key: 'area', label: 'Suprafață', value: formatDecimal(Number(water.areaKm2.toFixed(2)), 2, 2), unit: 'km²' });
  if (water.volumeMilM3) out.push({ key: 'volume', label: 'Volum', value: formatInt(Number(water.volumeMilM3.toFixed(0))), unit: 'mil. m³' });
  if (water.elevationM) out.push({ key: 'elevation', label: 'Altitudine', value: formatInt(Number(water.elevationM.toFixed(0))), unit: 'm' });
  return out;
}

/** «5,57 km²» inside a line: the figure at the line's weight, the unit smaller and muted after a no-break space. */
function FigureValue({ figure }: { figure: WaterFigure }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {figure.value}
      <span className="ms-0.5 t-caption text-muted">{`\u00a0${figure.unit}`}</span>
    </span>
  );
}

/** fish «Detalii» facts as the kit's DetailFacts (the list in the aside and the phone's «Detalii»). */
export function waterDetailFacts(water: PublicWaterDetail): DetailFact[] {
  const figures = waterFigures(water);
  return publicWaterFacts(water).map((f) => {
    const figure = figures.find((g) => g.key === f.key);
    return { ...f, value: figure ? <FigureValue figure={figure} /> : f.value, icon: FACT_ICON[f.key] };
  });
}

/**
 * The bento's tiles: the figures but `omit` (the summary card's headline figure — one figure, one
 * place), then the basin and the EU code. Fewer than two is no bento (never an orphan tile).
 */
export function waterBentoTiles(water: PublicWaterDetail, omit?: WaterFigure['key']) {
  const figures = waterFigures(water).filter((f) => f.key !== omit);
  const texts = publicWaterFacts(water).filter((f) => f.key === 'basin' || f.key === 'euCode');
  return { figures, texts, count: figures.length + texts.length };
}

/**
 * From 1024, when the water has no community sections: «Detalii» as a bento in the left column
 * (owner rules 1, 9) — area, volume and altitude as fact tiles at the signature step, the basin and
 * the EU code as small text tiles — so the page is not a map over a stub card.
 */
export function WaterDetailsBento({ water, omit, className }: { water: PublicWaterDetail; omit?: WaterFigure['key']; className?: string }) {
  const { figures, texts, count } = waterBentoTiles(water, omit);
  if (count < 2) return null;
  const figSpan = figures.length === 1 ? 'col-span-6' : figures.length === 2 ? 'col-span-3' : 'col-span-2';
  const textSpan = texts.length === 1 ? 'col-span-6' : 'col-span-3';
  return (
    <div className={cn('flex flex-col gap-3.5', className)} data-testid="water-details-bento">
      <h3 className={H3_CLASS}>Detalii</h3>
      <ul className="grid grid-cols-6 gap-2.5">
        {figures.map((f) => (
          <li key={f.key} className={figSpan}>
            <FactTile label={f.label} icon={FACT_ICON[f.key]} value={f.value} unit={f.unit} className="h-full" />
          </li>
        ))}
        {texts.map((f) => (
          <li key={f.key} className={cn(textSpan, 'flex min-w-0 items-center gap-3 rounded-bento bg-page p-4')}>
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-4">
              {FACT_ICON[f.key]}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="t-label text-muted">{f.label}</span>
              <span className="truncate t-body-strong text-ink">{f.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type MoreLink = { key: string; label: string; icon: ReactNode; href: string; srSuffix?: string };

/**
 * The summary card's way to the water's other pages: full-width rows (icon, label, chevron) under a
 * small «Mai multe despre apă» heading, a hairline above them — navigation, not tags.
 */
export function MoreAboutWater({ links }: { links: MoreLink[] }) {
  if (!links.length) return null;
  return (
    <nav aria-labelledby="mai-multe-apa" className="flex flex-col gap-1 border-t border-hairline pt-4">
      <h3 id="mai-multe-apa" className="t-label text-muted">
        Mai multe despre apă
      </h3>
      <ul className="flex flex-col">
        {links.map((l) => (
          <li key={l.key} className="border-b border-hairline last:border-b-0">
            <Link
              href={l.href}
              data-more={l.key}
              className="-mx-2 flex min-h-12 items-center gap-3 rounded-control px-2 py-2.5 transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-accent [&>svg]:size-6">
                {l.icon}
              </span>
              <span className="min-w-0 flex-1 t-body text-ink-2">
                {l.label}
                {l.srSuffix ? <span className="sr-only">{l.srSuffix}</span> : null}
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * fish LinkCodeRow: the ANAR code a lake owner gives to associate the water; activating it copies
 * the code and «Copiază» reads «Copiat» for 1.5s.
 */
export function LinkCodeRow({ code }: { code: string }) {
  return <CopyRow label="Cod apă (pentru asociere)" value={code} copyLabel={`Copiază codul apei ${code}`} />;
}

const COORD = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 5, maximumFractionDigits: 5 });

/** The water's centre (where Direcții leads): shown in Romanian notation, copied as «lat, lng» for a maps app. */
export function CoordinatesRow({ lat, lng }: { lat: number; lng: number }) {
  return (
    <CopyRow
      label="Coordonate (centrul apei)"
      value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      display={
        // Two unbreakable halves: a narrow card wraps between them, never inside one («… 25,53034°» / «E»).
        <>
          <span className="whitespace-nowrap">{`${COORD.format(lat)}° N,`}</span> <span className="whitespace-nowrap">{`${COORD.format(lng)}° E`}</span>
        </>
      }
      copyLabel="Copiază coordonatele apei"
    />
  );
}

/** A labelled value that copies itself; «Copiază» reads «Copiat» for 1.5s. */
function CopyRow({ label, value, display = value, copyLabel }: { label: string; value: string; display?: ReactNode; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      aria-label={copyLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // No clipboard permission (an embedded frame): nothing to confirm.
          return;
        }
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
      }}
      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-control bg-page px-3 py-2.5 text-left transition-opacity duration-(--duration-fast) active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-caption text-muted">{label}</span>
        <span className={cn('t-body-strong text-ink-2 tabular-nums', typeof display === 'string' && 'break-all')}>{display}</span>
      </span>
      <span className={cn('flex shrink-0 items-center gap-1 t-caption', copied ? 'text-status-success-fg' : 'text-muted')}>
        {copied ? <CheckIcon aria-hidden className="size-4" /> : <DocumentDuplicateIcon aria-hidden className="size-4" />}
        <span aria-live="polite">{copied ? 'Copiat' : 'Copiază'}</span>
      </span>
    </button>
  );
}

/**
 * fish NavigationSheet: Google Maps (driving) and Waze to the water's centre; Apple Maps only on
 * Apple platforms; without coordinates, the sheet's error line.
 */
export function DirectionsDialog({ open, onClose, lat, lng }: { open: boolean; onClose: () => void; lat: number | null; lng: number | null }) {
  const links = directionsLinks(lat, lng);
  const apple = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent), () => false);
  const option = buttonClass({ variant: 'secondary', className: 'w-full justify-center' });
  return (
    <Dialog open={open} onClose={onClose} title="Direcții" subtitle="Alege aplicația de navigație" closeButton>
      {links ? (
        <ul className="flex flex-col gap-2">
          <li>
            <a href={links.google} target="_blank" rel="noopener noreferrer" className={option} onClick={onClose}>
              Google Maps<span className="sr-only"> (se deschide într-o filă nouă)</span>
            </a>
          </li>
          <li>
            <a href={links.waze} target="_blank" rel="noopener noreferrer" className={option} onClick={onClose}>
              Waze<span className="sr-only"> (se deschide într-o filă nouă)</span>
            </a>
          </li>
          {apple ? (
            <li>
              <a href={links.apple} target="_blank" rel="noopener noreferrer" className={option} onClick={onClose}>
                Apple Maps<span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
          ) : null}
        </ul>
      ) : (
        <p role="alert" className="t-body text-status-danger-fg">
          {DIRECTIONS_UNAVAILABLE}
        </p>
      )}
    </Dialog>
  );
}
