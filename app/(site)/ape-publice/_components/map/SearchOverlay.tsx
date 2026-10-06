'use client';

import { MagnifyingGlassIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { IconButton } from '@/components/nav/IconButton';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { SEARCH_SHELL } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  formatWaterDistance,
  groupSearchResults,
  publicWaterName,
  publicWaterSearchQuery,
  publicWaterSubtitle,
  waterDistanceKm,
  type PublicWaterListItem,
} from '@/core/lakes';
import { browserPublicWaters } from '../client-source';

/*
 * fish PublicWatersSearch (parity public-waters.harta-ape.c26–c31): the kit Sheet on a phone, the
 * kit Dialog from 768. «Caută ape publice» + «Închide»; the field «Caută un râu sau lac»
 * takes focus when it opens; closing forgets the term, the results and the nearby list.
 *  - < 2 characters: «În jurul meu / Ape publice în apropiere» and the recents («Șterge tot»);
 *  - ≥ 2: searched 250ms after the last keystroke (name or county, names starting with the term
 *    first, then shorter names, 40 at most), grouped «Râuri» / «Lacuri»; a skeleton while it
 *    runs; «Niciun rezultat pentru „<term>”.» when nothing matches;
 *  - «În jurul meu»: the 20 nearest waters with a link code under «Cele mai apropiate», each with
 *    its distance first; typing ≥ 2 characters leaves it, and an answer arriving after the user
 *    typed or closed is dropped.
 */

const NEARBY_LIMIT = 20;
const DEBOUNCE_MS = 250;

export type LocationProblem = 'permission' | 'services_off';

type Nearby = { origin: { lat: number; lng: number }; waters: PublicWaterListItem[] };

const TITLE = 'Caută ape publice';

/**
 * The kit surfaces, as the lake search (balti/_list/SearchLayer.tsx) on the same Bălți / Ape publice
 * toggle: the Sheet at 90% on a phone, the kit Dialog from 768 (the list scrolls inside it) — focus
 * kept inside and returned to the search pill, Escape and the scrim close both.
 */
export function SearchOverlay({
  open,
  onClose,
  recents,
  onClearRecents,
  onSelect,
  onLocationBlocked,
}: {
  open: boolean;
  onClose: () => void;
  recents: PublicWaterListItem[];
  onClearRecents: () => void;
  onSelect: (water: PublicWaterListItem) => void;
  onLocationBlocked: (problem: LocationProblem) => void;
}) {
  const phone = useBreakpoint() === 'mobile';
  // Mounted with each opening: closing forgets the term, the results and the nearby list.
  const content = open ? (
    <SearchBody phone={phone} onClose={onClose} recents={recents} onClearRecents={onClearRecents} onSelect={onSelect} onLocationBlocked={onLocationBlocked} />
  ) : null;
  return phone ? (
    <Sheet open={open} onClose={onClose} title={TITLE} initialSnap={0.9}>
      {content}
    </Sheet>
  ) : (
    <Dialog open={open} onClose={onClose} title={TITLE} closeButton>
      {content}
    </Dialog>
  );
}

function SearchBody({
  phone,
  onClose,
  recents,
  onClearRecents,
  onSelect,
  onLocationBlocked,
}: {
  phone: boolean;
  onClose: () => void;
  recents: PublicWaterListItem[];
  onClearRecents: () => void;
  onSelect: (water: PublicWaterListItem) => void;
  onLocationBlocked: (problem: LocationProblem) => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const termRef = useRef('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    // After the surface's showModal(), which focuses its first control (the close / the handle).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      alive.current = false;
      cancelAnimationFrame(id);
    };
  }, []);
  useEffect(() => {
    termRef.current = term;
    const t = window.setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [term]);

  const q = term.trim();
  const searching = q.length >= 2;
  const results = useQuery(publicWaterSearchQuery(browserPublicWaters(), debounced));
  const pending = searching && (debounced.trim() !== q || results.isFetching);
  const groups = groupSearchResults(results.data ?? []);

  const findNearby = () => {
    if (locating) return;
    if (!('geolocation' in navigator)) return onLocationBlocked('services_off');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const waters = await browserPublicWaters().nearestWatersTo(origin.lat, origin.lng, NEARBY_LIMIT);
          // The user typed or closed while we fetched: drop it.
          if (!alive.current || termRef.current.trim().length >= 2) return;
          setNearby({ origin, waters });
        } catch {
          if (alive.current) onLocationBlocked('services_off');
        } finally {
          if (alive.current) setLocating(false);
        }
      },
      (err) => {
        if (!alive.current) return;
        setLocating(false);
        onLocationBlocked(err.code === err.PERMISSION_DENIED ? 'permission' : 'services_off');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center gap-2">
        <div className={cn(SEARCH_SHELL, 'min-w-0 flex-1 gap-2.5 pl-3.5')}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <input
            aria-label="Caută un râu sau lac"
            ref={inputRef}
            type="search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (e.target.value.trim().length >= 2) setNearby(null);
            }}
            placeholder="Caută un râu sau lac"
            autoComplete="off"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {pending || locating ? <T2Spinner className="mr-2 size-5 text-muted" /> : null}
          {term && !pending && !locating ? (
            <IconButton
              aria-label="Șterge textul"
              size="size-9"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
            >
              <XMarkIcon aria-hidden />
            </IconButton>
          ) : null}
        </div>
        {/* The sheet has no close control of its own (the dialog has its «Închide»). */}
        {phone ? (
          <IconButton aria-label="Închide" onClick={onClose} className="-mr-2">
            <XMarkIcon aria-hidden />
          </IconButton>
        ) : null}
      </div>
      <div
        className={
          phone
            ? 'pb-[max(var(--spacing)*2,env(safe-area-inset-bottom))]'
            : // The dialog hugs its content up to the kit filter surface's body height; the list scrolls.
              '-mx-5 max-h-[60dvh] overflow-y-auto overscroll-contain px-5'
        }
      >
        <p role="status" className="sr-only">
          {searching && !pending
            ? results.isError && !results.data
              ? 'Căutarea nu a funcționat.'
              : results.data?.length
                ? `${results.data.length} rezultate`
                : `Niciun rezultat pentru „${q}”.`
            : ''}
        </p>
        {!searching ? (
          <>
            <button
              type="button"
              onClick={findNearby}
              aria-busy={locating || undefined}
              className="-mx-2 flex w-[calc(100%+var(--spacing)*4)] cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-left hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex size-10.5 shrink-0 items-center justify-center rounded-full bg-status-info-fg text-on-accent">
                <PaperAirplaneIcon aria-hidden className="size-5 -rotate-45" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="t-body text-ink">În jurul meu</span>
                <span className="t-caption text-muted">Ape publice în apropiere</span>
              </span>
              {locating ? <T2Spinner className="size-5 text-muted" /> : null}
            </button>
            {nearby ? (
              <Group title="Cele mai apropiate">
                {nearby.waters.map((w) => (
                  <Row
                    key={w.id}
                    water={w}
                    prefix={formatWaterDistance(waterDistanceKm(nearby.origin.lat, nearby.origin.lng, w))}
                    onSelect={onSelect}
                  />
                ))}
              </Group>
            ) : recents.length ? (
              <Group
                title="Căutări recente"
                action={
                  <button type="button" onClick={onClearRecents} className="cursor-pointer rounded-badge t-caption text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                    Șterge tot
                  </button>
                }
              >
                {recents.map((w) => (
                  <Row key={w.id} water={w} onSelect={onSelect} />
                ))}
              </Group>
            ) : null}
          </>
        ) : pending && !results.data?.length && !results.isError ? (
          <ul aria-hidden className="flex flex-col pt-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex flex-col gap-1.5 py-2.5">
                <span className="h-3.5 w-[55%] animate-shimmer rounded-full" />
                <span className="h-3 w-[35%] animate-shimmer rounded-full" />
              </li>
            ))}
          </ul>
        ) : groups.length ? (
          groups.map((g) => (
            <Group key={g.title} title={g.title}>
              {g.items.map((w) => (
                <Row key={w.id} water={w} onSelect={onSelect} />
              ))}
            </Group>
          ))
        ) : results.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-3">
            <p className="t-body-strong text-muted">Căutarea nu a funcționat.</p>
            <Button
              variant="secondary"
              size="compact"
              aria-busy={results.isFetching || undefined}
              aria-disabled={results.isFetching || undefined}
              onClick={() => {
                if (!results.isFetching) void results.refetch();
              }}
            >
              {results.isFetching ? 'Se încarcă…' : 'Încearcă din nou'}
            </Button>
          </div>
        ) : (
          <p className="py-3 t-body-strong text-muted">{`Niciun rezultat pentru „${q}”.`}</p>
        )}
      </div>
    </div>
  );
}

function Group({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="pt-4">
      <div className="flex items-center justify-between pb-1.5">
        <h3 id={id} className="t-label text-muted uppercase">
          {title}
        </h3>
        {action}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

function Row({ water, prefix, onSelect }: { water: PublicWaterListItem; prefix?: string; onSelect: (w: PublicWaterListItem) => void }) {
  const subtitle = [prefix, publicWaterSubtitle(water)].filter(Boolean).join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(water)}
        className="-mx-2 flex w-[calc(100%+var(--spacing)*4)] cursor-pointer flex-col gap-0.5 rounded-control px-2 py-2 text-left hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="t-body-strong text-ink">{publicWaterName(water)}</span>
        <span className="t-caption text-muted">{subtitle}</span>
      </button>
    </li>
  );
}
