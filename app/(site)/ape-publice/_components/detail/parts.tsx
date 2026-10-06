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
import { DIRECTIONS_UNAVAILABLE, directionsLinks, type PublicWaterFact } from '@/core/lakes';

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
              <li key={a.key} className="flex justify-center">
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

/** fish «Detalii» facts as the kit's DetailFacts (the lake page's look: list in the aside, tiles below 1280). */
export function waterDetailFacts(facts: PublicWaterFact[]): DetailFact[] {
  return facts.map((f) => ({ ...f, icon: FACT_ICON[f.key] }));
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
