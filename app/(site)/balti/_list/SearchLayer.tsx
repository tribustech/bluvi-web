'use client';

import { BuildingOffice2Icon, ExclamationCircleIcon, MagnifyingGlassIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/components/nav/IconButton';
import { Dialog } from '@/components/surfaces/Dialog';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { plural } from '@/components/cards/format';
import { SEARCH_SHELL, TextAction } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  DEFAULT_NEARBY_RADIUS_KM,
  flattenLakesExploreSuggestions,
  LAKES_EXPLORE_SUGGESTIONS_DEBOUNCE_MS,
  lakesExploreSuggestionsInfiniteQuery,
  nearbyCommittedSearch,
  suggestionToCommittedSearch,
  type LakesCommittedSearch,
  type LakesSearchSuggestion,
} from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { NavigationIcon, WavesIcon } from './icons';
import { requestUserPosition } from './location';
import type { LocationDialogMode } from './LocationDialog';
import { PhoneSheet } from './PhoneSheet';
import { clearRecentLakeSearches, readRecentLakeSearches, saveRecentLakeSearch } from './storage';

/*
 * lakes.search — fish features/lakes/components/LakesSearchScreen.tsx: a type-ahead over lakes,
 * counties and cities (/lakes/explore/suggestions) with «În jurul meu» first and the recent picks.
 * The kit surfaces: a 90% Sheet on a phone (fish Modal; PhoneSheet — its title row with the «Închide»
 * X and the input stay on top while the list scrolls), the kit Dialog from 768 opening over the
 * page's search pill like a command palette (the input lands where the pill was and never moves
 * while the list changes; the list scrolls inside it) — focus stays inside, Escape (even with text
 * in the field) and the scrim close both. The rows are the ⌘K palette's (CommandPalette): the same
 * 56px rows, t-body-strong titles, the soft-fill highlight. TODO(kit): export the palette's row
 * class from components/nav/CommandPalette so both read it from one place.
 *
 * Keyboard: the input is an ARIA combobox over the rows (listbox / option): ↑ ↓ move the
 * highlight, Enter picks it. With nothing highlighted Enter takes the row whose title IS the term
 * («giurgiu» → the county, not the first lake ranked above it) or the only row; otherwise it
 * highlights the first row, and a second Enter picks it. Pressed before the answer is in, Enter
 * waits for it (typing again cancels).
 */

/** fish NEARBY_FALLBACK_ROW — always the first row of an empty term. */
const NEARBY_ROW: LakesSearchSuggestion = {
  id: 'nearby',
  type: 'nearby',
  title: 'În jurul meu',
  subtitle: 'Bălți în apropiere',
  icon: 'location',
  color: '',
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish LakesSearchSuggestionsList: an icon per type on its coloured circle. The CMS sends the
 * circle's hex colour; the web keeps one token tone per type (raw colours are not allowed).
 */
const ROW_ICON: Record<LakesSearchSuggestion['icon'], { Icon: Icon; tone: string }> = {
  // «În jurul meu» is the special first row: the solid accent, apart from the tinted county circles.
  location: { Icon: NavigationIcon, tone: 'bg-accent text-on-accent' },
  county: { Icon: MapPinIcon, tone: 'bg-accent-tint-2 text-accent-ink' },
  // Never a tone equal to the row's hover / highlight fill (soft-fill): the circle would vanish.
  city: { Icon: BuildingOffice2Icon, tone: 'bg-badge-yellow-bg text-badge-yellow-fg' },
  lake: { Icon: WavesIcon, tone: 'bg-badge-green-bg text-badge-green-fg' },
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function SearchLayer({
  open,
  onClose,
  onCommit,
  onLocationBlocked,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  /** A county / city / nearby pick (a lake opens its page here). */
  onCommit: (search: LakesCommittedSearch) => void;
  /** «În jurul meu» could not get a position: the page closes this layer and opens its location dialog. */
  onLocationBlocked: (mode: LocationDialogMode) => void;
  /** The page's search pill (from 768 the dialog opens over it). Without it: anchored at 12dvh. */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const phone = useBreakpoint() === 'mobile';
  // The phone sheet's pinned slot (under its title row): the input row is portalled there, so it
  // stays on top while the list scrolls.
  const [pinned, setPinned] = useState<HTMLDivElement | null>(null);
  // The layer's content mounts with each opening: the term, the recents and the request state start
  // fresh (fish resets the term on close, lakes.search.c13).
  const content = open ? (
    <SearchContent
      phone={phone}
      pinTarget={phone ? pinned : null}
      anchorRef={anchorRef}
      onClose={onClose}
      onCommit={onCommit}
      onLocationBlocked={onLocationBlocked}
    />
  ) : null;
  return phone ? (
    <PhoneSheet open={open} onClose={onClose} title={TITLE} pinned={<div ref={setPinned} />}>
      {content}
    </PhoneSheet>
  ) : (
    // Not centred: over the page's search pill (or at 12dvh without one), so the input stays put
    // while the list grows, shrinks or says «no results». Wider than the kit's 480 so subtitles hold
    // one line (cn does not merge: the ! beats the kit's max-w-[480px]).
    <Dialog open={open} onClose={onClose} title={TITLE} closeButton className="mt-[12dvh] mb-auto max-w-160!">
      {content}
    </Dialog>
  );
}

const TITLE = 'Caută în Bălți';

/** Rank of an exact-title row when the term names several («Giurgiu»: the county before the city, then a lake). */
const EXACT_RANK: Record<LakesSearchSuggestion['type'], number> = { county: 0, city: 1, lake: 2, nearby: 3 };

function SearchContent({
  phone,
  pinTarget,
  anchorRef,
  onClose,
  onCommit,
  onLocationBlocked,
}: {
  phone: boolean;
  pinTarget: HTMLElement | null;
  anchorRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onCommit: (search: LakesCommittedSearch) => void;
  onLocationBlocked: (mode: LocationDialogMode) => void;
}) {
  const router = useRouter();
  const t = useMemo(() => createBrowserTransport(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const [term, setTerm] = useState('');
  // Mounted only while the layer is open (in the browser): storage is readable here.
  const [recents, setRecents] = useState<LakesSearchSuggestion[]>(readRecentLakeSearches);
  const [requestingNearby, setRequestingNearby] = useState(false);
  // The keyboard highlight, tied to the term it was moved on (a new term starts with none).
  const [highlight, setHighlight] = useState<{ term: string; index: number }>({ term: '', index: -1 });
  // Enter pressed before the term's answer was in: resolved once it is (typing again cancels).
  const [pendingEnter, setPendingEnter] = useState<string | null>(null);
  // The layer closed while «În jurul meu» was reading the position: the late answer is dropped.
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  useEffect(() => {
    // After the surface's showModal(), which focuses its first control (the close / the handle).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // From 768 the dialog opens over the page's search pill: its input lands where the pill is (from
  // 1280 also at the pill's left edge), so the pill reads as opening — the dialog's top never cuts
  // through the toolbar. Offsets, not rects: the dialog is still scaling in (transforms ignored).
  useLayoutEffect(() => {
    if (phone) return;
    const anchor = anchorRef?.current;
    const input = inputRef.current;
    const dialog = input?.closest('dialog');
    if (!anchor || !input || !dialog) return;
    const place = () => {
      const pill = anchor.getBoundingClientRect();
      if (!pill.height) return;
      let top = 0;
      let left = 0;
      // The input's shell (the field), from the dialog's border box.
      const shell = (input.parentElement ?? input) as HTMLElement;
      for (let el: HTMLElement | null = shell; el && el !== dialog; el = el.offsetParent as HTMLElement | null) {
        top += el.offsetTop;
        left += el.offsetLeft;
      }
      dialog.style.marginTop = `${Math.max(16, Math.round(pill.top - top))}px`;
      if (window.innerWidth >= 1280) {
        const width = dialog.offsetWidth;
        dialog.style.marginLeft = `${Math.max(16, Math.min(Math.round(pill.left - left), window.innerWidth - width - 16))}px`;
        dialog.style.marginRight = 'auto';
      } else {
        dialog.style.marginLeft = '';
        dialog.style.marginRight = '';
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      dialog.style.marginTop = '';
      dialog.style.marginLeft = '';
      dialog.style.marginRight = '';
    };
  }, [phone, anchorRef]);

  const trimmed = term.trim();
  const settled = useDebounced(trimmed, LAKES_EXPLORE_SUGGESTIONS_DEBOUNCE_MS);
  const debouncing = settled !== trimmed;
  const q = useInfiniteQuery({
    ...lakesExploreSuggestionsInfiniteQuery(t, {
      mode: settled ? 'text' : null,
      q: settled,
      radiusKm: DEFAULT_NEARBY_RADIUS_KM,
      latitude: null,
      longitude: null,
      nearbyLakeIds: [],
    }),
    // The shown list stays while the next term debounces and loads (lakes.search.c6: the skeleton
    // only when there is nothing to show) — it is marked stale meanwhile.
    placeholderData: keepPreviousData,
  });
  const raw = useMemo(() => flattenLakesExploreSuggestions(q.data), [q.data]);

  // fish: a spinner (never the «no results» line) while the term debounces or its first page is in
  // flight; with nothing to show yet, the skeleton.
  const stale = debouncing || q.isPlaceholderData || (q.isFetching && !q.isFetchingNextPage);
  const initialLoading = raw.length === 0 && !q.isError && (stale || q.isPending);
  const suggestions = useMemo(() => {
    // «În jurul meu» reads the same at every moment (lakes.search.c3: «Bălți în apropiere»): the
    // CMS's own nearby row («Arie de 50km») takes the web row's copy, so the subtitle never swaps
    // when the defaults arrive.
    const rows = raw.map((s) => (s.type === 'nearby' ? NEARBY_ROW : s));
    // An empty term: «În jurul meu» is always the first row, usable while the default suggestions
    // load (the skeleton goes under it) or after they failed.
    if (!trimmed) return [NEARBY_ROW, ...rows.filter((s) => s.type !== 'nearby')];
    return initialLoading ? [] : rows;
  }, [initialLoading, raw, trimmed]);

  // fish onEndReached: the next page when the end of the list comes near — observed against the
  // list's real scroller (the sheet's / the dialog's), so the 40% look-ahead applies (a viewport
  // root would not see past the scroller's clip). A failed page waits for its retry button.
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = q;
  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasNextPage || isFetchNextPageError) return;
    const root = phone ? end.closest<HTMLElement>('.overflow-y-auto') : scrollRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { root, rootMargin: '0px 0px 40% 0px' },
    );
    io.observe(end);
    return () => io.disconnect();
  }, [phone, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, suggestions.length]);

  const select = async (s: LakesSearchSuggestion) => {
    if (s.type === 'nearby') {
      // A second tap while the position is being read is ignored (lakes.search.c12).
      if (requestingNearby) return;
      setRequestingNearby(true);
      const result = await requestUserPosition();
      // Closed meanwhile: no map, no location dialog over a page the user went back to.
      if (unmounted.current) return;
      setRequestingNearby(false);
      if (result.state === 'denied') return onLocationBlocked('permission');
      // The prompt was never answered (./location.ts watchdog): the row is free again, nothing opens.
      if (result.state === 'never_asked') return;
      if (!result.position) return onLocationBlocked('services_off');
      onCommit(nearbyCommittedSearch(result.position.latitude, result.position.longitude));
      return;
    }
    const saved = commitPlace(s);
    if (saved) setRecents(saved);
  };
  /** A county / city / lake pick: saved to the recents (returned), then committed. Null: not pickable. */
  function commitPlace(s: LakesSearchSuggestion): LakesSearchSuggestion[] | null {
    const search = suggestionToCommittedSearch(s);
    if (!search) return null;
    // A picked lake opens its page. fish's map focused on a lake is only the fallback for its old
    // recents saved without an id; the web never saves those (./storage.ts drops them).
    if (search.mode === 'lake' && !search.lakeId) return null;
    const saved = saveRecentLakeSearch(s);
    if (search.mode === 'lake' && search.lakeId) {
      onClose();
      router.push(routes.lake(search.lakeId));
    } else onCommit(search);
    return saved;
  }

  const showRecents = !trimmed && recents.length > 0;
  const recentCount = showRecents ? recents.length : 0;
  const places = suggestions.filter((s) => s.type !== 'nearby');
  const noMatches = !!trimmed && !stale && !initialLoading && !q.isError && places.length === 0;
  const busy = stale || requestingNearby;
  // The suggestions read failed (the nearby row stays on an empty term), the line says so.
  const listError = q.isError && !q.isFetchNextPageError;

  /* ---------------------------------------------------------------- combobox */
  const optionId = (i: number) => `${inputId}-option-${i}`;
  const recentsListId = `${inputId}-recents`;
  const suggestionsListId = `${inputId}-suggestions`;
  // Every pickable row in screen order: the recents, then the suggestions.
  const options = [...(showRecents ? recents : []), ...suggestions];
  const active = highlight.term === trimmed && highlight.index < options.length ? highlight.index : -1;
  const activeId = active >= 0 ? optionId(active) : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  /**
   * Enter with nothing highlighted on a typed term whose answer is in: the row whose title is the
   * term, or the only row (picked); else the first row's index (highlighted, a second Enter picks).
   */
  const enterTarget = (): { pick: LakesSearchSuggestion } | { highlight: number } | null => {
    if (!places.length) return null;
    const needle = fold(trimmed).folded.trim();
    const exact = places
      .filter((s) => fold(s.title).folded.trim() === needle)
      .sort((x, y) => EXACT_RANK[x.type] - EXACT_RANK[y.type])[0];
    const pick = exact ?? (places.length === 1 ? places[0] : undefined);
    return pick ? { pick } : { highlight: recentCount + suggestions.indexOf(places[0]) };
  };
  // An Enter that waited for its answer resolves on the render the answer arrives (no effect
  // round-trip for the highlight); a pick goes through the effect below (it navigates).
  const [enterPick, setEnterPick] = useState<{ suggestion: LakesSearchSuggestion } | null>(null);
  if (pendingEnter !== null && pendingEnter === trimmed && !stale && !initialLoading) {
    setPendingEnter(null);
    const target = enterTarget();
    if (target && 'pick' in target) setEnterPick({ suggestion: target.pick });
    else if (target) setHighlight({ term: trimmed, index: target.highlight });
  }
  useEffect(() => {
    // A place (never «În jurul meu»): it navigates or commits, and the layer closes.
    if (enterPick) commitPlace(enterPick.suggestion);
    // One pick per resolved Enter (a new object each time); commitPlace reads the latest props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterPick]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // type=search would clear the text first (with its native X hidden, unseen): Escape closes.
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      const n = options.length;
      const index = e.key === 'ArrowDown' ? (active + 1) % n : active <= 0 ? n - 1 : active - 1;
      setHighlight({ term: trimmed, index });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) return void select(options[active]);
      if (!trimmed) return;
      // The answer is not in yet: Enter is remembered, not dropped.
      if (stale || initialLoading) return setPendingEnter(trimmed);
      const target = enterTarget();
      if (target && 'pick' in target) void select(target.pick);
      else if (target) setHighlight({ term: trimmed, index: target.highlight });
    }
  };

  const row = (s: LakesSearchSuggestion, index: number) => (
    <SuggestionRow
      key={`${index < recentCount ? 'r' : 's'}-${s.id}`}
      id={optionId(index)}
      suggestion={s}
      query={index < recentCount ? '' : settled}
      active={index === active}
      onSelect={() => void select(s)}
      busy={s.type === 'nearby' && requestingNearby}
    />
  );

  /** A retry keeps the user's place: focus stays in the combobox (the button unmounts on success). */
  const retry = (run: () => unknown) => () => {
    inputRef.current?.focus();
    void run();
  };

  const list = (
    <>
      {showRecents ? (
        <section aria-labelledby="balti-recents" className="border-b border-hairline pb-3">
          <div className="flex items-center justify-between gap-3 py-1">
            <h3 id="balti-recents" className="t-label text-muted">
              Căutări recente
            </h3>
            <TextAction
              onClick={() => {
                clearRecentLakeSearches();
                setRecents([]);
                inputRef.current?.focus();
              }}
            >
              Șterge tot
            </TextAction>
          </div>
          <ul id={recentsListId} role="listbox" aria-labelledby="balti-recents" className="flex flex-col">
            {recents.map((s, i) => row(s, i))}
          </ul>
        </section>
      ) : null}

      {/* The CMS answers every term with its «În jurul meu» row, so «nothing found» is judged on
          the places and lakes (fish shows the empty line only for an empty answer, which this CMS
          never sends — the message never appeared). The nearby row stays under it. */}
      {noMatches ? (
        <StateRow
          icon={<MagnifyingGlassIcon />}
          title="Nu am găsit rezultate pentru căutarea ta."
          hint="Încearcă numele bălții, județul sau localitatea, fără prescurtări."
          className="pt-2"
        />
      ) : null}
      {suggestions.length ? (
        <ul
          id={suggestionsListId}
          role="listbox"
          aria-label="Sugestii"
          aria-busy={stale || undefined}
          className={cn('flex flex-col pt-2 transition-opacity duration-(--duration-fast) ease-fast', stale && !requestingNearby && !initialLoading && 'opacity-60')}
        >
          {suggestions.map((s, i) => row(s, recentCount + i))}
        </ul>
      ) : null}
      {initialLoading ? <SuggestionsSkeleton className={suggestions.length ? undefined : 'pt-2'} /> : null}
      {listError ? (
        <div role="alert">
          <StateRow
            icon={<ExclamationCircleIcon />}
            title="Sugestiile nu s-au încărcat."
            hint="Verifică conexiunea și încearcă din nou."
            action={
              <Button variant="secondary" size="compact" onClick={retry(() => q.refetch())}>
                Încearcă din nou
              </Button>
            }
          />
        </div>
      ) : null}

      <div ref={endRef} aria-hidden className="h-px" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <T2Spinner className="size-5 text-muted" />
          <span className="sr-only">Se încarcă mai multe sugestii</span>
        </div>
      ) : isFetchNextPageError ? (
        <div role="alert">
          <StateRow
            icon={<ExclamationCircleIcon />}
            title="Nu am putut încărca mai multe sugestii."
            action={
              <Button variant="secondary" size="compact" onClick={retry(() => fetchNextPage())}>
                Încearcă din nou
              </Button>
            }
          />
        </div>
      ) : null}
    </>
  );

  const inputRow = (
    <div className={cn(SEARCH_SHELL, 'min-w-0 gap-2.5 pl-3.5')}>
      <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
        aria-controls={showRecents ? `${recentsListId} ${suggestionsListId}` : suggestionsListId}
        aria-activedescendant={activeId}
        enterKeyHint="search"
        autoComplete="off"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setPendingEnter(null);
        }}
        onKeyDown={onKeyDown}
        placeholder="Caută o baltă, județ sau localitate"
        aria-label="Caută o baltă, județ sau localitate"
        aria-describedby={`${inputId}-status`}
        className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {/* The spinner sits beside the clear X: the X never leaves while results load. */}
      {busy ? <T2Spinner className={cn('size-5 shrink-0 text-muted', !term && 'mr-2')} /> : null}
      {term ? (
        <IconButton
          aria-label="Șterge textul"
          size="size-9"
          onClick={() => {
            setTerm('');
            setPendingEnter(null);
            inputRef.current?.focus();
          }}
        >
          <XMarkIcon aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );

  const status = (
    <p id={`${inputId}-status`} role="status" className="sr-only">
      {requestingNearby
        ? 'Se caută locația ta'
        : busy
          ? 'Se încarcă sugestiile'
          : listError
            ? 'Sugestiile nu s-au încărcat.'
            : noMatches
              ? 'Nu am găsit rezultate pentru căutarea ta.'
              : trimmed
                ? plural(places.length, 'sugestie', 'sugestii')
                : ''}
    </p>
  );

  if (phone) {
    // The input row lives in PhoneSheet's pinned slot (under the title row with its «Închide» X),
    // so it stays on top while the sheet scrolls the list.
    return (
      <>
        {pinTarget ? createPortal(inputRow, pinTarget) : null}
        {status}
        <div className="pt-1 pb-[max(var(--spacing)*2,env(safe-area-inset-bottom))]">{list}</div>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3 pt-2">
      {inputRow}
      {status}
      {/* The list scrolls inside the dialog; its bottom fades out (on the dialog's bottom padding, so
          with nothing more to scroll the last row is whole) — there is more below. */}
      <div
        ref={scrollRef}
        className="-mx-5 -mb-5 max-h-[60dvh] overflow-y-auto overscroll-contain px-5 pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-var(--spacing)*5),transparent)]"
      >
        {list}
      </div>
    </div>
  );
}

/**
 * A state in the list's place (no results, a failed read): the row's leading slot — a 42px soft
 * circle — with a title and a hint, aligned to the rows (same -mx-2 px-2 box), and its action.
 */
function StateRow({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('-mx-2 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2', className)}>
      <span aria-hidden className="flex size-10.5 shrink-0 items-center justify-center rounded-full bg-soft-fill text-muted [&>svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-body-strong text-ink">{title}</span>
        {hint ? <span className="t-caption text-muted">{hint}</span> : null}
      </span>
      {action}
    </div>
  );
}

/** Folds a string for matching as the CMS does (NFD, combining marks dropped, lower case), with each folded char's index in the original. */
function fold(text: string): { folded: string; at: number[] } {
  let folded = '';
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const c of text[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) {
      folded += c;
      at.push(i);
    }
  }
  return { folded, at };
}

/** The typed term marked in a row's subtitle (diacritic- and case-insensitive, ink on muted), so why a row matched shows. */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const needle = fold(query).folded.trim();
  if (!needle) return text;
  const { folded, at } = fold(text);
  const i = folded.indexOf(needle);
  if (i < 0) return text;
  const start = at[i];
  const end = at[i + needle.length - 1] + 1;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent text-ink">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function SuggestionRow({
  id,
  suggestion,
  query,
  active,
  onSelect,
  busy = false,
}: {
  id: string;
  suggestion: LakesSearchSuggestion;
  /** The term the row answers (marked in its text); empty for the recents. */
  query: string;
  /** The keyboard highlight (aria-activedescendant on the input). */
  active: boolean;
  onSelect: () => void;
  busy?: boolean;
}) {
  const { Icon, tone } = ROW_ICON[suggestion.icon] ?? ROW_ICON.lake;
  return (
    // An option of the input's listbox: picked with a click / tap or ↑ ↓ + Enter in the input (the
    // focus stays there — mousedown does not take it).
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-busy={busy || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      // The ⌘K palette's row: 56px, the soft-fill highlight (the menus' hover look, no ring), the
      // kit press on a row (opacity .7, Fundații §06).
      className={cn(
        '-mx-2 flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 hover:bg-soft-fill active:opacity-70',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast',
        active && 'bg-soft-fill',
      )}
    >
      <span aria-hidden className={cn('flex size-10.5 shrink-0 items-center justify-center rounded-full [&>svg]:size-5', tone)}>
        {busy ? <T2Spinner className="size-5" /> : <Icon />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate t-body-strong text-ink">{suggestion.title}</span>
        {suggestion.subtitle ? (
          <span className="line-clamp-2 t-caption text-muted">
            <Highlight text={suggestion.subtitle} query={query} />
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** fish SearchResultsSkeleton: a page of rows (10) on the real row's metrics, in the ⌘K palette's skeleton look (soft-fill blocks). */
function SuggestionsSkeleton({ className }: { className?: string }) {
  return (
    <ul aria-hidden className={cn('flex flex-col', className)}>
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 py-1.5">
          <span className="size-10.5 shrink-0 rounded-full bg-soft-fill" />
          <span className="flex flex-1 flex-col gap-2">
            <span className={cn('block h-3 rounded-badge bg-soft-fill', i % 3 === 1 ? 'w-1/2' : 'w-2/3')} />
            <span className="block h-2.5 w-1/3 rounded-badge bg-soft-fill" />
          </span>
        </li>
      ))}
    </ul>
  );
}
