'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { FishIcon } from '@/components/icons/brand';
import { IconButton } from '@/components/nav/IconButton';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { SEARCH_SHELL, TextAction } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import {
  getLakeLocationSubtitle,
  publicWaterName,
  publicWaterSubtitle,
  VENUE_SEARCH_MIN_CHARS,
  type LakeCard,
  type PublicWaterListItem,
} from '@/core/lakes';
import { lakeCardToVenue, publicWaterToVenue, type SelectedVenue } from '@/core/partide';
import { clearRecentVenueSearches, readRecentVenueSearches, saveRecentVenueSearch, type RecentVenuePick } from './recentVenueSearches';
import { useVenueSearch } from './useVenueSearch';

/*
 * «Filtrează după baltă» — fish features/partide/components/community/VenueSearchScreen.tsx (parity
 * partide.exploreaza c17–c20), a single-pick venue filter over ALL lakes and public waters. A sheet on
 * the phone (fish's full-screen modal, at 90%), a dialog from 768 (components/surfaces
 * ResponsiveSurface). Reused read-only by «Începe o partidă» (partide.incepe).
 *
 *  - No term: «Toate bălțile» (clears the filter), «Căutări recente» (up to 5, «Șterge tot») and
 *    «Cu partide acum» (the venues of the live pages loaded so far).
 *  - A term (≥2 characters, 250ms debounce, useVenueSearch): catalog lakes first, then public waters
 *    under «Ape publice» — never interleaved; waters without a linkCode are left out (no venue key).
 *  - A pick applies at once (no «Aplică»), closes the picker and is remembered (a search result:
 *    key, name, subtitle, thumbnail). The search field has focus on open.
 */

export type VenueFilterOption = { value: string; name: string; helper?: string | null; imageUrl?: string | null };

export const VENUE_FILTER_TITLE = 'Filtrează după baltă';

export function VenueFilterDialog({
  open,
  onClose,
  selectedKey,
  liveOptions,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  /** The applied venue key; null = «Toate bălțile». */
  selectedKey: string | null;
  /** Venues with live partide right now — the browse list before typing. */
  liveOptions: VenueFilterOption[];
  /** A venue, or null for «Toate bălțile». The caller closes the picker. */
  onSelect: (venue: SelectedVenue | null) => void;
}) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title={VENUE_FILTER_TITLE} sheetSnap={0.9} pinnedActions>
      {/* Mounted with each opening: the term starts empty, the recents are read again (fish). */}
      {open ? <PickerBody selectedKey={selectedKey} liveOptions={liveOptions} onSelect={onSelect} /> : null}
    </ResponsiveSurface>
  );
}

const lakeThumb = (lake: LakeCard): string | null => {
  const img = lake.images?.[0];
  return img?.thumbnailUrl ?? img?.smallUrl ?? img?.url ?? null;
};

function PickerBody({
  selectedKey,
  liveOptions,
  onSelect,
}: {
  selectedKey: string | null;
  liveOptions: VenueFilterOption[];
  onSelect: (venue: SelectedVenue | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [recents, setRecents] = useState<RecentVenuePick[]>(readRecentVenueSearches);
  // One pick per opening: a double tap never commits twice.
  const picked = useRef(false);

  useEffect(() => {
    // After showModal(), which focuses the first control (the close X): the field takes it (c17).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const search = useVenueSearch(term);
  const trimmed = term.trim();
  const hasTerm = trimmed.length > 0;
  const searchable = trimmed.length >= VENUE_SEARCH_MIN_CHARS;
  const waters = search.waters.filter(w => w.linkCode !== null);
  const noRows = search.lakes.length === 0 && waters.length === 0;
  const initialLoading = search.isLoading && noRows;
  // Owner rule 4: a half that failed is unknown, never «no results». With no rows at all a failure
  // is «Căutarea nu a mers.»; beside the other half's rows, a short retry for the failed half.
  const failed = search.lakesError || search.watersError;
  const settled = searchable && !search.isLoading;
  const settledEmpty = settled && !failed && noRows;
  const searchFailed = settled && failed && noRows;
  const halfFailed = settled && failed && !noRows;

  const pick = (venue: SelectedVenue | null, remember?: RecentVenuePick) => {
    if (picked.current) return;
    picked.current = true;
    if (remember) setRecents(saveRecentVenueSearch(remember));
    onSelect(venue);
  };
  const pickLake = (lake: LakeCard) => {
    const venue = lakeCardToVenue(lake);
    if (!venue) return;
    pick(venue, { key: venue.key, name: venue.name, helper: getLakeLocationSubtitle(lake, { includeAddress: false }), imageUrl: lakeThumb(lake) });
  };
  const pickWater = (water: PublicWaterListItem) => {
    const venue = publicWaterToVenue(water);
    if (!venue) return;
    pick(venue, { key: venue.key, name: venue.name, helper: publicWaterSubtitle(water), imageUrl: null });
  };

  const resultCount = search.lakes.length + waters.length;
  const announcement = !searchable || search.isLoading
    ? ''
    : searchFailed
      ? 'Căutarea nu a mers.'
      : resultCount > 0
        ? formatCount(resultCount, 'rezultat', 'rezultate')
        : 'Nu am găsit nicio baltă sau apă publică.';

  return (
    <div className="flex flex-col pt-1" data-testid="venue-picker">
      <form role="search" onSubmit={e => e.preventDefault()} className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-2">
        <div className={cn(SEARCH_SHELL, 'relative gap-2.5 pl-3.5')}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Caută o baltă sau o apă publică"
            aria-label="Caută o baltă sau o apă publică"
            className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted"
          />
          {term ? (
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
          {/* fish CollapsibleSearchInput `loading`: the field's own edge pulses while results load. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -inset-px rounded-control border-2 border-accent opacity-0 transition-opacity duration-(--duration-fast) ease-fast',
              search.isLoading && 'animate-live opacity-100',
            )}
          />
        </div>
      </form>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {hasTerm ? (
        <div className="flex flex-col pb-2">
          {halfFailed && search.lakesError ? <HalfError text="Bălțile nu s-au încărcat." onRetry={search.retryLakes} /> : null}
          {search.lakes.length > 0 ? (
            <Rows label="Bălți">
              {search.lakes.map(lake => (
                <VenueRow
                  key={lake.documentId}
                  name={lake.name}
                  helper={getLakeLocationSubtitle(lake, { includeAddress: false })}
                  imageUrl={lakeThumb(lake)}
                  kind="lake"
                  selected={`lake:${lake.documentId}` === selectedKey}
                  onPress={() => pickLake(lake)}
                />
              ))}
            </Rows>
          ) : null}
          {waters.length > 0 ? (
            <Section title="Ape publice">
              {waters.map(water => (
                <VenueRow
                  key={water.id}
                  name={publicWaterName(water)}
                  helper={publicWaterSubtitle(water)}
                  imageUrl={null}
                  kind="water"
                  selected={`water:${water.linkCode}` === selectedKey}
                  onPress={() => pickWater(water)}
                />
              ))}
            </Section>
          ) : null}
          {halfFailed && search.watersError ? <HalfError text="Apele publice nu s-au încărcat." onRetry={search.retryWaters} /> : null}
          {initialLoading ? <RowsSkeleton /> : null}
          {settledEmpty ? (
            <p className="px-0.5 py-3.5 t-body text-muted" data-testid="venue-picker-empty">
              Nu am găsit nicio baltă sau apă publică pentru căutarea ta.
            </p>
          ) : null}
          {searchFailed ? (
            <div role="alert" className="flex flex-wrap items-baseline gap-x-2 px-0.5 py-3.5" data-testid="venue-picker-error">
              <p className="t-body text-ink-2">Căutarea nu a mers.</p>
              <TextAction onClick={search.retry}>Încearcă din nou</TextAction>
            </div>
          ) : null}

          {!searchable ? <p className="px-0.5 py-3.5 t-caption text-muted">Scrie cel puțin {VENUE_SEARCH_MIN_CHARS} litere.</p> : null}
        </div>
      ) : (
        <div className="flex flex-col pb-2">
          <Rows label="Fără filtru">
            <OptionRow
              option={{ value: '', name: 'Toate bălțile', helper: 'Fără filtru — tot ce e public' }}
              selected={selectedKey === null}
              onPress={() => pick(null)}
            />
          </Rows>
          {recents.length > 0 ? (
            <Section
              title="Căutări recente"
              action={
                <button
                  type="button"
                  onClick={() => {
                    clearRecentVenueSearches();
                    setRecents([]);
                    inputRef.current?.focus();
                  }}
                  className="-mr-2 min-h-11 cursor-pointer rounded-control px-2 t-label text-accent-ink hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Șterge tot
                </button>
              }
            >
              {recents.map(p => (
                <VenueRow
                  key={p.key}
                  name={p.name}
                  helper={p.helper}
                  imageUrl={p.imageUrl}
                  kind={p.key.startsWith('water:') ? 'water' : 'lake'}
                  selected={p.key === selectedKey}
                  onPress={() => pick({ key: p.key, name: p.name })}
                />
              ))}
            </Section>
          ) : null}
          {liveOptions.length > 0 ? (
            <Section title="Cu partide acum">
              {liveOptions.map(o => (
                <OptionRow key={o.value} option={o} selected={o.value === selectedKey} onPress={() => pick({ key: o.value, name: o.name })} />
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One half of the search failed while the other has rows: a short line and its own retry. */
function HalfError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-baseline gap-x-2 px-0.5 py-2" data-testid="venue-picker-partial-error">
      <p className="t-caption text-muted">{text}</p>
      <TextAction onClick={onRetry}>Încearcă din nou</TextAction>
    </div>
  );
}

function Rows({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {children}
    </ul>
  );
}

/** A titled group of rows (fish's section row: 12/700 gray title, an optional «Șterge tot»). */
function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col pt-3">
      <div className="flex min-h-8 items-center justify-between gap-3 px-0.5 pb-1">
        <p id={id} className="t-label text-muted">
          {title}
        </p>
        {action}
      </div>
      <ul aria-labelledby={id} className="flex flex-col">
        {children}
      </ul>
    </div>
  );
}

const ROW = cn(
  'group -mx-2 flex min-h-14 w-[calc(100%+var(--spacing)*4)] cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left',
  'transition-colors duration-(--duration-fast) hover:bg-soft-fill',
  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
);

/**
 * fish VenueRow — a search result or a recent pick: the lake photo as a round thumb, else a 42 icon
 * disc (waves: sky for a public water, indigo for a lake); «Activ» on the applied venue.
 */
function VenueRow({
  name,
  helper,
  imageUrl,
  kind,
  selected,
  onPress,
}: {
  name: string;
  helper: string | null;
  imageUrl: string | null;
  kind: 'lake' | 'water';
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onPress} aria-current={selected || undefined} className={ROW} data-testid="venue-row">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a CMS thumbnail, already sized.
          <img src={imageUrl} alt="" loading="lazy" decoding="async" className="size-10.5 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className={cn(
              'flex size-10.5 shrink-0 items-center justify-center rounded-full [&>svg]:size-5',
              kind === 'water' ? 'bg-bento-sky/20 text-ink' : 'bg-accent-tint text-accent-ink',
            )}
          >
            <WavesGlyph />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate t-body-strong text-ink">{name}</span>
          {helper ? <span className="truncate t-caption text-muted group-hover:text-ink-2">{helper}</span> : null}
        </span>
        {selected ? <span className="shrink-0 t-label text-accent-ink">Activ</span> : null}
      </button>
    </li>
  );
}

/** fish VenueFilterRow — «Toate bălțile» and the live venues: a 40 rounded tile, a check circle. */
function OptionRow({ option, selected, onPress }: { option: VenueFilterOption; selected: boolean; onPress: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPress} aria-current={selected || undefined} className={ROW} data-testid="venue-option">
        {option.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a CMS rendition, already sized.
          <img src={option.imageUrl} alt="" loading="lazy" decoding="async" className="size-10 shrink-0 rounded-control object-cover" />
        ) : (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
            <FishIcon size={18} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate t-body text-ink">{option.name}</span>
          {option.helper ? <span className="truncate t-caption text-muted group-hover:text-ink-2">{option.helper}</span> : null}
        </span>
        {selected ? (
          <CheckCircleIcon aria-hidden className="size-5.5 shrink-0 text-accent-ink" />
        ) : (
          <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-hairline" />
        )}
      </button>
    </li>
  );
}

/** lucide «waves» (fish WavesIcon), 24 outline. */
function WavesGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

/** fish SearchResultsSkeleton: rows of a disc and two lines. Silent: the status line speaks. */
function RowsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-1 pt-2" data-testid="venue-picker-skeleton">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 py-2">
          <span className="size-10.5 shrink-0 animate-shimmer rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-1/2 animate-shimmer rounded-full" />
            <span className="h-3 w-1/3 animate-shimmer rounded-full" />
          </span>
        </li>
      ))}
    </ul>
  );
}
