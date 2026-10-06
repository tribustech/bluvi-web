'use client';

import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type SVGProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRightIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  TrophyIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { SEARCH_SHELL, TextAction } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import {
  competitionSuggestionsQuery,
  formatCount,
  MAX_RECENT_SEARCHES,
  type CompetitionsCommittedSearch,
  type CompetitionSuggestion,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { clearRecentCompetitionSearches, readRecentCompetitionSearches, saveRecentCompetitionSearch } from './recents';
import { ModalSurface } from '@/components/surfaces/ModalSurface';

/*
 * competitions-list.search — fish features/competitions/components/CompetitionsSearchScreen.tsx +
 * CompetitionsSuggestionsList.tsx. A type-ahead over /feed/competition-suggestions: typing never
 * filters the list behind it, only a pick commits (a lake / organizer by documentId, the free text,
 * or a competition, which opens its page).
 */

/** fish SUGGESTIONS_DEBOUNCE_MS — the same delay as the Bălți search. */
const DEBOUNCE_MS = 260;

type RowKind = CompetitionSuggestion['type'] | 'recent' | 'text';
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish ROW_ICONS / ROW_COLORS: tinted per kind so a baltă, an organizer and a concurs are told apart
 * before the text is read — indigo pin, yellow user, green trophy, neutral clock / magnifier. The
 * fish tints map to the badge tokens the cards already use for the same hues.
 */
const ROW: Record<RowKind, { Icon: Icon; tone: string }> = {
  lake: { Icon: MapPinIcon, tone: 'bg-accent-tint text-accent-ink' },
  organizer: { Icon: UserIcon, tone: 'bg-badge-yellow-bg text-badge-yellow-fg' },
  competition: { Icon: TrophyIcon, tone: 'bg-badge-green-bg text-badge-green-fg' },
  recent: { Icon: ClockIcon, tone: 'bg-soft-fill text-ink-2' },
  text: { Icon: MagnifyingGlassIcon, tone: 'bg-soft-fill text-ink-2' },
};

export const SEARCH_TITLE = 'Caută în Concursuri';

export function SearchDialog({
  open,
  onClose,
  t,
  onCommit,
  onOpenCompetition,
}: {
  open: boolean;
  onClose: () => void;
  t: Transport;
  /** A lake / organizer / free-text pick: enters results mode. */
  onCommit: (search: NonNullable<CompetitionsCommittedSearch>) => void;
  /** A competition pick opens its page instead of filtering. */
  onOpenCompetition: (documentId: string) => void;
}) {
  return (
    <ModalSurface open={open} onClose={onClose} title={SEARCH_TITLE} fullScreen bodyClassName="pb-6">
      {/* Mounted with each opening: the term, the recents and the request start fresh (fish Modal). */}
      {open ? <SearchBody t={t} onCommit={onCommit} onOpenCompetition={onOpenCompetition} /> : null}
    </ModalSurface>
  );
}

function SearchBody({
  t,
  onCommit,
  onOpenCompetition,
}: {
  t: Transport;
  onCommit: (search: NonNullable<CompetitionsCommittedSearch>) => void;
  onOpenCompetition: (documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const recentsTitleId = useId();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  // Read once per opening, in the browser (the body only mounts while open).
  const [recents, setRecents] = useState<CompetitionSuggestion[]>(readRecentCompetitionSearches);
  // b.navigation-guard: one pick per opening — a double tap never commits twice.
  const picked = useRef(false);

  useEffect(() => {
    // After showModal(), which focuses the first control (the close X): the field takes it (c3).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [term]);

  const trimmed = term.trim();
  const debouncing = trimmed !== debounced.trim();
  // c4: no q with an empty term (the default groups); 60s cache; the previous groups stay meanwhile.
  const q = useQuery(competitionSuggestionsQuery(t, debounced));
  const groups = useMemo(() => (q.data ?? []).filter((g) => g.items.length > 0), [q.data]);
  const loading = debouncing || q.isFetching;
  // c5: before the first answer, the skeleton — never a premature empty message. Only then: a later
  // term loading over an empty answer keeps that answer's line (the field's border says it loads),
  // instead of swapping six bones in and out on every keystroke.
  const initialLoading = loading && q.data === undefined;
  const failed = q.isError && !loading && groups.length === 0;

  const select = (s: CompetitionSuggestion) => {
    if (picked.current) return;
    picked.current = true;
    setRecents(saveRecentCompetitionSearch(s));
    if (s.type === 'competition') return onOpenCompetition(s.value);
    onCommit({ type: s.type, value: s.value, label: s.title });
  };

  const commitText = () => {
    if (!trimmed || picked.current) return;
    picked.current = true;
    onCommit({ type: 'text', value: trimmed, label: trimmed });
  };

  const visibleRecents = recents.slice(0, MAX_RECENT_SEARCHES);
  const showRecents = !trimmed && visibleRecents.length > 0;
  // The term the data on screen answers ('' = the default groups): while a new term loads, an empty
  // answer to a previous TERM keeps its line; the default groups never had one.
  const [answeredTerm, setAnsweredTerm] = useState<string | null>(null);
  const settledTerm = q.isSuccess && !q.isPlaceholderData ? debounced.trim() : answeredTerm;
  if (settledTerm !== answeredTerm) setAnsweredTerm(settledTerm);
  const noSuggestions = !!trimmed && !q.isError && groups.length === 0 && (loading ? !!answeredTerm : q.data !== undefined);
  const shownGroups = initialLoading ? [] : groups;

  /*
   * The WAI-ARIA combobox + listbox of the top bar's ⌘K palette (components/nav/CommandPalette):
   * focus stays in the field, ↑ / ↓ move an active option (the soft-fill highlight, the hover look),
   * Enter picks it; with nothing active Enter commits the free text (c3). One flat option list in
   * screen order: the free-text row, the recents, then the server's groups.
   */
  type Option = { key: string; index: number; kind: RowKind; title: string; subtitle: string; suggestion: CompetitionSuggestion | null };
  const options: Option[] = [];
  const add = (o: Omit<Option, 'index'>) => {
    const option = { ...o, index: options.length };
    options.push(option);
    return option;
  };
  const textOption = trimmed
    ? add({ key: 'text', kind: 'text', title: `Caută „${trimmed}”`, subtitle: 'În nume, bălți și organizatori', suggestion: null })
    : null;
  const recentOptions = showRecents
    ? visibleRecents.map((s) => add({ key: `recent:${s.id}`, kind: 'recent', title: s.title, subtitle: s.subtitle, suggestion: s }))
    : [];
  const groupOptions = shownGroups.map((g) =>
    g.items.map((s) => add({ key: s.id, kind: s.type, title: s.title, subtitle: s.subtitle, suggestion: s })),
  );
  const pick = (o: Option) => (o.suggestion ? select(o.suggestion) : commitText());
  const [activeIndex, setActiveIndex] = useState(-1);
  const active = activeIndex < options.length ? activeIndex : -1;
  const optionId = (i: number) => `${listId}-o${i}`;
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Enter on an active option picks it; with none active the form commits the free text.
      if (active < 0) return;
      e.preventDefault();
      pick(options[active]);
      return;
    }
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((active + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(active <= 0 ? options.length - 1 : active - 1);
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActiveIndex(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      setActiveIndex(options.length - 1);
    }
  };

  // c5 / s3 for a screen reader: only settled outcomes are announced, never each keystroke.
  const suggestionCount = groups.reduce((n, g) => n + g.items.length, 0);
  // A failed read is said with an empty term too (the default groups): opening the search while the
  // CMS is down is not silent.
  const announcement = loading
    ? ''
    : failed
      ? 'Sugestiile nu s-au încărcat.'
      : !trimmed
        ? ''
        : suggestionCount > 0
          ? formatCount(suggestionCount, 'sugestie', 'sugestii')
          : 'Nu am găsit sugestii.';

  const renderOption = (o: Option) => (
    <Row
      key={o.key}
      id={optionId(o.index)}
      kind={o.kind}
      title={o.title}
      subtitle={o.subtitle}
      active={o.index === active}
      onHover={() => o.index !== active && setActiveIndex(o.index)}
      onSelect={() => pick(o)}
    />
  );

  return (
    <div className="flex flex-col gap-1 pt-1">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          commitText();
        }}
        className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-2"
      >
        <div className={cn(SEARCH_SHELL, 'relative gap-2.5 pl-3.5')}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            // text, not search: Chromium's search field eats the first Escape to clear itself, so the
            // dialog would need two (the palette's field is text too). «Șterge textul» clears it.
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder="Concurs, baltă sau organizator"
            aria-label="Caută un concurs, o baltă sau un organizator"
            className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted"
          />
          {term ? (
            <IconButton
              aria-label="Șterge textul"
              size="size-9"
              onClick={() => {
                setTerm('');
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
            >
              <XMarkIcon aria-hidden />
            </IconButton>
          ) : null}
          {/* c5: fish SearchLoadingBorder — the field's own edge pulses while the term debounces or
              its suggestions load. */}
          <span
            aria-hidden
            data-loading={loading || undefined}
            className={cn(
              'pointer-events-none absolute -inset-px rounded-control border-2 border-accent opacity-0 transition-opacity duration-(--duration-fast) ease-fast',
              loading && 'animate-live opacity-100',
            )}
          />
        </div>
      </form>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* The recents' «Șterge tot» is a button, which a listbox cannot hold: the group's title row
          sits just above the listbox, and names the group inside it. */}
      {showRecents ? (
        <div className="flex min-h-8 items-center justify-between gap-3 px-0.5 pt-3 pb-1">
          <p id={recentsTitleId} className="t-label text-muted">
            Căutări recente
          </p>
          <button
            type="button"
            onClick={() => {
              clearRecentCompetitionSearches();
              setRecents([]);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="-mr-2 min-h-11 cursor-pointer rounded-control px-2 t-label text-accent-ink hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
          >
            Șterge tot
          </button>
        </div>
      ) : null}

      <div id={listId} role="listbox" aria-label="Sugestii" aria-busy={loading || undefined}>
        {textOption ? (
          <div role="group" aria-label="Căutare liberă" className={showRecents ? undefined : 'pt-2'}>
            {renderOption(textOption)}
          </div>
        ) : null}
        {recentOptions.length ? (
          <div role="group" aria-labelledby={recentsTitleId}>
            {recentOptions.map(renderOption)}
          </div>
        ) : null}
        {shownGroups.map((g, gi) => (
          <Group key={g.title} title={g.title}>
            {groupOptions[gi].map(renderOption)}
          </Group>
        ))}
      </div>

      {initialLoading ? <SuggestionsSkeleton /> : null}
      {noSuggestions ? <p className="px-0.5 py-3.5 t-body text-muted">Nu am găsit sugestii. Poți căuta textul liber de mai sus.</p> : null}
      {failed ? (
        <div className="flex flex-wrap items-baseline gap-x-2 px-0.5 py-3.5">
          <p className="t-body text-ink-2">Sugestiile nu s-au încărcat.</p>
          <TextAction onClick={() => void q.refetch()}>Încearcă din nou</TextAction>
        </div>
      ) : null}
    </div>
  );
}

/** fish SuggestionGroupHeader + its rows: the server's title as given (an option group of the listbox). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="pt-3">
      <p id={id} className="flex min-h-8 items-center px-0.5 pb-1 t-label text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * fish CompetitionSuggestionRow: tinted tile, bold title, muted subtitle, chevron; named «{title}.
 * {subtitle}» (c7). An option of the listbox: the active one (keyboard) and the hovered one share the
 * soft-fill highlight, never the current-page tint.
 */
function Row({
  id,
  kind,
  title,
  subtitle,
  active,
  onHover,
  onSelect,
}: {
  id: string;
  kind: RowKind;
  title: string;
  subtitle: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { Icon, tone } = ROW[kind];
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onPointerMove={onHover}
      aria-label={`${title}. ${subtitle}`}
      data-kind={kind}
      className={cn(
        'group -mx-2 flex min-h-14 w-[calc(100%+var(--spacing)*4)] cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left',
        active && 'bg-soft-fill',
      )}
    >
      <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-control [&>svg]:size-5', tone)}>
        <Icon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-body-strong text-ink">{title}</span>
        {/* On the soft-fill highlight, muted would drop under 4.5:1: the caption steps up to ink-2. */}
        <span className={cn('truncate t-caption', active ? 'text-ink-2' : 'text-muted')}>{subtitle}</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted" />
    </div>
  );
}

/** fish SearchResultsSkeleton: rows of a tile and two lines. Silent: the field's live region speaks. */
function SuggestionsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-1 pt-3">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} data-skeleton-row className="flex min-h-14 items-center gap-3 py-2">
          <span className="size-10 shrink-0 animate-shimmer rounded-control" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-1/2 animate-shimmer rounded-full" />
            <span className="h-3 w-1/3 animate-shimmer rounded-full" />
          </span>
        </li>
      ))}
    </ul>
  );
}
