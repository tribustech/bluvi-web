'use client';

import { useId, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { lakeCardThumb, mergeVenueResults, type VenueSelection, type VenueSuggestion } from '@/core/partide';
import { TextInput } from '@/components/forms/TextInput';
import { COUNTRY_ZOOM, MapPointPicker, ROMANIA_CENTER } from '@/components/partide/map/MapPointPicker';
import { useVenueSearch } from '@/components/partide/venue/useVenueSearch';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { Transport } from '@/core/transport';
import { LocationDialog, type LocationDialogMode } from '../../../balti/_list/LocationDialog';
import { MapPinnedIcon } from './icons';
import type { StartLocation } from './location';
import type { Coord } from './model';
import { pointInfoKey, resolveDroppedPin, type PointInfo } from './pinPoint';
import { LocationPermissionCard, LocationRetryCard, VENUE_GRID, VenueGlyph, VenueRow } from './parts';
import { useVenueSuggestions } from './suggestions';

/*
 * Step 1 — «Unde pescuiești?» (fish features/partide/components/VenuePicker.tsx; parity
 * partide.incepe c3–c6):
 *  - the search «Caută o baltă sau o apă publică...» (catalog lakes + public waters, from 2
 *    characters, one 250 ms debounce — components/partide/venue/useVenueSearch), lakes first;
 *  - the dashed «Pune un pin pe hartă» card, always there: the map picker, then the pin is resolved
 *    («Verificăm locul...», core resolvePinVenue) — a catalog lake within 400 m, a public water at
 *    the point (a claimed one → its lake), else the naming step «Loc nou pe hartă»;
 *  - without a search: the suggestions — the location card when blocked, the retry card when the
 *    position did not come, «Aproape de tine», «Folosite recent», «Sugestii».
 * From 768 the search and the pin card share a row and every list is a grid of row cards.
 */

export function VenueStep({ t, location, onSelect }: { t: Transport; location: StartLocation; onSelect: (venue: VenueSelection, pinCounty?: string | null) => void }) {
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const search = useVenueSearch(term);
  const [mapOpen, setMapOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pinCoord, setPinCoord] = useState<Coord | null>(null);
  // Starts EMPTY on purpose (fish: «Loc nou» as a value got typed into); the fallback lives at confirm.
  const [pinName, setPinName] = useState('');
  const suggestions = useVenueSuggestions(t, location);
  const [dialog, setDialog] = useState<LocationDialogMode | null>(null);
  const searchId = useId();

  const showResults = term.trim().length >= 2;
  const results = useMemo(() => mergeVenueResults(search.lakes, search.waters), [search.lakes, search.waters]);
  const thumbs = useMemo(() => new Map(search.lakes.map(l => [l.documentId, lakeCardThumb(l)])), [search.lakes]);

  // The pin's county, when the resolution read it (the naming step shows the place it lands in).
  const [pinCounty, setPinCounty] = useState<string | null>(null);

  const handlePinDropped = async (coord: Coord) => {
    setMapOpen(false);
    setResolving(true);
    try {
      const resolved = await resolveDroppedPin(qc, t, coord);
      if (resolved.kind !== 'pin') {
        onSelect(resolved);
        return;
      }
    } catch {
      // resolvePinVenue never throws (every tier is best effort); a failure here is a plain pin.
    } finally {
      setResolving(false);
    }
    setPinCounty(qc.getQueryData<PointInfo>(pointInfoKey(coord))?.county ?? null);
    setPinCoord(coord);
    setPinName('');
  };

  const onBlockedCard = () => {
    if (location.state === 'never_asked') {
      void location.request();
      return;
    }
    setDialog(location.state === 'services_off' ? 'services_off' : 'permission');
  };

  if (resolving) {
    return (
      <div role="status" data-testid="pin-resolving" className="flex flex-col items-center justify-center gap-3 rounded-card bg-surface px-4 py-12 shadow-e0">
        <span aria-hidden className="size-8 animate-spin rounded-full border-3 border-status-success-bg border-t-success" />
        <p className="t-caption text-muted">Verificăm locul...</p>
      </div>
    );
  }

  if (pinCoord) {
    const confirm = () => onSelect({ kind: 'pin', coord: pinCoord, name: pinName.trim() || 'Loc nou' }, pinCounty);
    return (
      <form
        data-testid="pin-naming"
        onSubmit={e => {
          e.preventDefault();
          confirm();
        }}
        className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:max-w-xl md:p-5 xl:p-6"
      >
        <div className="flex items-center gap-3">
          <VenueGlyph kind="pin" />
          <div className="min-w-0 flex-1">
            <h2 className="t-heading text-ink">Loc nou pe hartă</h2>
            <p className="t-caption text-muted tabular-nums">
              {pinCoord.lat.toFixed(4)}, {pinCoord.lng.toFixed(4)}
              {pinCounty ? ` · Jud. ${pinCounty}` : ''}
            </p>
          </div>
        </div>
        <TextInput label="Nume loc" placeholder="ex. Cot Dunăre" value={pinName} onChange={e => setPinName(e.currentTarget.value)} autoComplete="off" maxLength={80} />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setPinCoord(null)}>
            Înapoi
          </Button>
          <Button type="submit" variant="success" className="flex-1">
            Continuă
          </Button>
        </div>
      </form>
    );
  }

  const blocked = location.state === 'never_asked' || location.state === 'denied' || location.state === 'services_off' ? location.state : null;
  const hasSuggestions = !!blocked || location.state === 'unresolved' || suggestions.nearby.length > 0 || suggestions.recent.length > 0 || suggestions.random.length > 0;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-stretch">
        <div className="flex flex-col justify-center">
          <label htmlFor={searchId} className="sr-only">
            Caută o baltă sau o apă publică
          </label>
          <div className="flex h-12 items-center gap-2 rounded-control bg-surface px-3.5 shadow-e0 transition-shadow duration-(--duration-fast) focus-within:shadow-[0_0_0_2px_var(--color-accent)] md:h-full md:min-h-16">
            <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
            <input
              id={searchId}
              type="search"
              value={term}
              onChange={e => setTerm(e.currentTarget.value)}
              placeholder="Caută o baltă sau o apă publică..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              data-testid="venue-search"
              className="h-full min-w-0 flex-1 bg-transparent t-body-strong text-ink outline-none placeholder:text-muted placeholder:font-normal [&::-webkit-search-cancel-button]:hidden"
            />
            {term ? (
              <button type="button" onClick={() => setTerm('')} aria-label="Șterge căutarea" className="-mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
                <XMarkIcon aria-hidden className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          data-testid="drop-pin"
          className={cn(
            'flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-card border border-dashed border-faint p-3 text-left',
            'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-surface active:opacity-70',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-status-success-bg text-status-success-fg">
            <MapPinnedIcon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="t-body-strong text-ink">Pune un pin pe hartă</span>
            <span className="t-caption text-muted">Pentru un loc care nu e în listă</span>
          </span>
        </button>
      </div>

      {showResults ? (
        <SearchResults
          term={search.settledTerm || term.trim()}
          results={results}
          thumbs={thumbs}
          loading={search.isLoading}
          error={search.isError}
          onRetry={search.retry}
          onSelect={onSelect}
        />
      ) : suggestions.isLoading ? (
        <SuggestionsSkeleton />
      ) : hasSuggestions ? (
        <div data-testid="venue-suggestions" className="flex flex-col gap-6">
          {blocked ? <LocationPermissionCard mode={blocked} busy={location.locating} onClick={onBlockedCard} /> : null}
          {location.state === 'unresolved' ? <LocationRetryCard busy={location.locating} onClick={() => void location.request()} /> : null}
          <SuggestionSection id="nearby" title="Aproape de tine" items={suggestions.nearby} onSelect={onSelect} />
          <SuggestionSection id="recent" title="Folosite recent" items={suggestions.recent} onSelect={onSelect} />
          <SuggestionSection id="random" title="Sugestii" items={suggestions.random} onSelect={onSelect} />
        </div>
      ) : null}

      <MapPointPicker
        open={mapOpen}
        title="Alege locul"
        center={ROMANIA_CENTER}
        initialZoom={COUNTRY_ZOOM}
        initialMapType="standard"
        onCancel={() => setMapOpen(false)}
        onConfirm={coord => void handlePinDropped(coord)}
      />
      <LocationDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        onRetry={() => {
          setDialog(null);
          void location.request();
        }}
      />
    </div>
  );
}

function SuggestionSection({ id, title, items, onSelect }: { id: string; title: string; items: VenueSuggestion[]; onSelect: (v: VenueSelection) => void }) {
  if (!items.length) return null;
  const headingId = `venue-${id}-title`;
  return (
    <section aria-labelledby={headingId} data-testid={`venue-section-${id}`} className="flex flex-col gap-2.5">
      <h2 id={headingId} className="t-heading text-ink">
        {title}
      </h2>
      <ul className={VENUE_GRID}>
        {items.map(item => (
          <VenueRow key={item.key} kind={item.selection.kind} name={item.selection.name} subtitle={item.subtitle} thumb={item.thumb} onSelect={() => onSelect(item.selection)} />
        ))}
      </ul>
    </section>
  );
}

function SearchResults({
  term,
  results,
  thumbs,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  term: string;
  results: VenueSelection[];
  thumbs: Map<string, string | null>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (v: VenueSelection) => void;
}) {
  if (error) {
    return (
      <div role="alert" data-testid="venue-search-error" className="flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-8 text-center shadow-e0">
        <p className="t-body text-ink-2">Nu am putut căuta locurile.</p>
        <Button variant="outline" size="compact" onClick={onRetry}>
          Reîncearcă
        </Button>
      </div>
    );
  }
  if (!results.length) {
    if (loading) return <SuggestionsSkeleton heading={false} />;
    return (
      <p data-testid="venue-no-results" role="status" className="rounded-card bg-surface px-4 py-8 text-center t-body text-muted shadow-e0">
        Niciun rezultat pentru „{term}”.
      </p>
    );
  }
  return (
    <section aria-label="Rezultate" aria-busy={loading || undefined} data-testid="venue-results">
      <ul className={VENUE_GRID}>
        {results.map(item =>
          item.kind === 'lake' ? (
            <VenueRow key={`lake-${item.lakeId}`} kind="lake" name={item.name} subtitle={item.locality} thumb={thumbs.get(item.lakeId) ?? null} onSelect={() => onSelect(item)} />
          ) : item.kind === 'publicWater' ? (
            <VenueRow key={`water-${item.linkCode}`} kind="publicWater" name={item.name} subtitle={item.typeLabel} onSelect={() => onSelect(item)} />
          ) : null,
        )}
      </ul>
    </section>
  );
}

/** fish's suggestions loader: a heading bar over three 62px rows (a grid of them from 768). */
export function SuggestionsSkeleton({ heading = true }: { heading?: boolean }) {
  return (
    <div aria-hidden data-testid="venue-suggestions-skeleton" className="flex flex-col gap-2.5">
      {heading ? <span className="h-5 w-36 rounded-full bg-soft-fill animate-shimmer" /> : null}
      <span className={VENUE_GRID}>
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-16 rounded-card bg-soft-fill animate-shimmer" />
        ))}
      </span>
    </div>
  );
}
