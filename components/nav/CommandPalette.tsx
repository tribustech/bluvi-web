'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon, Squares2X2Icon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { competitionSuggestionsQuery } from '@/core/competitions';
import { lakesInfiniteQuery } from '@/core/lakes';
import { anglerSearchInfiniteQuery } from '@/core/social';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { IconButton } from './IconButton';
import { SECTIONS, type AdminLink } from './items';

/** Same floor as fish's angler search (enforced by the server too); applied to every group. */
const MIN_CHARS = 2;
const PER_GROUP = 5;
const DEBOUNCE_MS = 200;

export type PaletteOption = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  visual: ReactNode;
};
export type PaletteGroup = { key: string; title: string; options: PaletteOption[] };

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * Angler search is per-user (users-permissions): signed out (false) it shows a sign-in hint
   * instead; while the session is still resolving (null) it says nothing about anglers.
   */
  signedIn: boolean | null;
  /** The session could not be read (signedIn is null): anglers are left out, and the hint says so. */
  sessionUnknown?: boolean;
  signInHref?: string;
  admin?: AdminLink[];
};

/**
 * Sections and Administrare: a bare outline icon (24, ink-2), exactly like the dropdown and
 * phone-menu rows. Photos and monograms (40) are for results with a face — lakes and anglers; a
 * competition result keeps its trophy bare, in a 40 slot so its title lines up with theirs.
 */
const ROW_ICON = 'size-6 shrink-0 text-ink-2';
const RESULT_ICON_SLOT = 'flex size-10 shrink-0 items-center justify-center';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * ⌘K command palette: one field searching lakes (core/lakes `/feed/lakes/search`), competitions
 * (core/competitions suggestions, the «Concursuri» group) and anglers (core/social discovery
 * search). WAI-ARIA combobox + listbox: focus stays in the field, ↑/↓ move the active option,
 * Enter opens it, Escape closes. Empty field: the sections and Administrare shortcuts.
 */
export function CommandPalette({ open, onClose, signedIn, sessionUnknown = false, signInHref = '/intra', admin = [] }: Props) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const listId = useId();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Every opening starts clean with the field focused.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText('');
      setActiveIndex(0);
    }
  }
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const term = useDebounced(text.trim(), DEBOUNCE_MS);
  const searching = term.length >= MIN_CHARS;
  const groups = usePaletteGroups(term, { enabled: open && searching, signedIn, admin });
  const options = useMemo(() => groups.list.flatMap((g) => g.options), [groups.list]);
  const active = options.length ? Math.min(activeIndex, options.length - 1) : -1;
  const optionId = (i: number) => `${listId}-o${i}`;
  // The rows on screen are not the answer to what is typed: the debounce has not caught up, or a
  // group still shows the previous term's rows (keepPreviousData). They are dimmed, not announced as
  // active, and Enter waits for the current term's rows instead of opening an old one.
  const stale = text.trim() !== term || groups.stale;
  const enterQueued = useRef(false);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  // An Enter pressed while stale runs once the current term's rows are in, or is dropped when the
  // term has none. Every render checks it (cheap); typing again cancels it.
  useEffect(() => {
    if (!enterQueued.current || stale || groups.loading) return;
    enterQueued.current = false;
    if (active >= 0) go(options[active].href);
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((active + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((active - 1 + options.length) % options.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActiveIndex(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      setActiveIndex(options.length - 1);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      if (stale) enterQueued.current = true;
      else go(options[active].href);
    }
  };

  const pending = text.trim() !== term || groups.loading;
  const shownTerm = text.trim();
  // Index of each group's first option in the flat `options` list.
  const offsets = groups.list.map((_, gi) => groups.list.slice(0, gi).reduce((n, g) => n + g.options.length, 0));

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        'm-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink',
        'md:mx-auto md:mt-[12dvh] md:h-fit md:max-h-[min(--spacing(160),76dvh)] md:w-[calc(100%-var(--spacing)*12)] md:max-w-160 md:rounded-card md:shadow-e2',
        'backdrop:bg-scrim open:flex open:flex-col',
        'opacity-100 transition-[opacity,scale] duration-(--duration-medium) ease-slow starting:opacity-0 md:scale-100 md:starting:scale-98',
      )}
    >
      <h2 id={titleId} className="sr-only">
        Caută în Bluvi
      </h2>
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4 md:pr-3">
        <MagnifyingGlassIcon className="size-6 shrink-0 text-muted" aria-hidden />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 && !stale ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Caută bălți, concursuri, pescari"
          placeholder="Caută bălți, concursuri, pescari"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActiveIndex(0);
            enterQueued.current = false;
          }}
          onKeyDown={onKeyDown}
          className="t-heading h-14 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none md:h-16"
        />
        <kbd aria-hidden className="t-nano hidden rounded-badge bg-soft-fill px-1.5 py-0.5 text-muted md:block">
          Esc
        </kbd>
        <IconButton onClick={onClose} aria-label="Închide căutarea" className="md:hidden">
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>

      {/* md: content height for the shortcuts (flex-auto: the basis is the content, not 0); while
          searching a stable height, so the dialog does not jump with every debounced keystroke. */}
      <div
        className={cn(
          'min-h-0 flex-auto overflow-y-auto overscroll-contain px-2 pt-2 pb-[max(--spacing(3),env(safe-area-inset-bottom))]',
          searching && 'md:min-h-80',
        )}
      >
        <div
          id={listId}
          role="listbox"
          aria-label="Rezultate"
          aria-busy={stale && options.length > 0 ? true : undefined}
          className={cn('transition-opacity duration-(--duration-fast) ease-fast', stale && options.length > 0 && 'opacity-60')}
        >
          {groups.list.map((g, gi) => (
            <div key={g.key} role="group" aria-labelledby={`${listId}-${g.key}`} className="pb-2">
              <p id={`${listId}-${g.key}`} className="t-eyebrow px-3 pt-2 pb-1.5 text-muted uppercase">
                {g.title}
              </p>
              {g.options.map((o, oi) => {
                const i = offsets[gi] + oi;
                const isActive = i === active;
                return (
                  <Link
                    key={o.id}
                    id={optionId(i)}
                    href={o.href}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onClick={onClose}
                    onPointerMove={() => i !== active && setActiveIndex(i)}
                    // The keyboard highlight is the menus' hover look (soft-fill), never the
                    // current-page tint, so no shortcut reads as «you are here».
                    className={cn(
                      'flex items-center gap-3 rounded-control px-3 py-2 text-ink outline-none',
                      searching ? 'min-h-14' : 'min-h-12',
                      isActive && 'bg-soft-fill',
                    )}
                  >
                    {o.visual}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="t-body-strong truncate">{o.title}</span>
                      {o.subtitle ? <span className="t-caption truncate text-muted">{o.subtitle}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {searching && signedIn === false ? (
          <p className="t-caption px-3 py-2 text-muted">
            <Link href={signInHref} onClick={onClose} className="text-accent-ink underline-offset-2 hover:underline">
              Intră în cont
            </Link>{' '}
            ca să cauți și pescari.
          </p>
        ) : null}
        {searching && signedIn === null && sessionUnknown ? (
          <p className="t-caption px-3 py-2 text-muted">Pescarii nu pot fi căutați acum: nu am putut verifica contul.</p>
        ) : null}

        {searching && pending && options.length === 0 && !groups.error ? <SkeletonRows /> : null}

        <div role="status" aria-live="polite" className="px-3">
          {searching && !pending && !groups.error && groups.failed.length === 0 && options.length === 0 ? (
            <p className="t-body py-8 text-center text-ink-2">Niciun rezultat pentru „{shownTerm}”.</p>
          ) : null}
          {searching && groups.error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="t-body text-ink-2">Căutarea nu a mers. Verifică conexiunea și încearcă din nou.</p>
              <Button variant="secondary" size="compact" onClick={groups.retry}>
                Reîncearcă
              </Button>
            </div>
          ) : null}
          {searching && !groups.error && groups.failed.length > 0 ? (
            <div className="flex items-center justify-between gap-3 py-2">
              <p className="t-caption text-muted">Nu am putut încărca {listRo(groups.failed)}.</p>
              <Button variant="secondary" size="compact" onClick={groups.retry}>
                Reîncearcă
              </Button>
            </div>
          ) : null}
          {shownTerm.length > 0 && shownTerm.length < MIN_CHARS ? (
            <p className="t-caption py-3 text-muted">Scrie cel puțin {MIN_CHARS} litere.</p>
          ) : null}
          {searching && pending && options.length === 0 && !groups.error ? <p className="sr-only">Se caută…</p> : null}
          {searching && !pending && options.length > 0 ? (
            <p className="sr-only">{options.length === 1 ? 'Un rezultat' : `${options.length} rezultate`}</p>
          ) : null}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-4 border-t border-hairline px-4 py-2.5 text-muted md:flex">
        <Hint keys={['↑', '↓']}>navighează</Hint>
        <Hint keys={['↵']}>deschide</Hint>
        <Hint keys={['Esc']}>închide</Hint>
      </div>
    </dialog>
  );
}

/** «a», «a și b», «a, b și c». */
function listRo(items: string[]): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} și ${items.at(-1)}`;
}

/** Three rows shaped like results (tile + title + subtitle) while the first answer is on its way. */
function SkeletonRows() {
  return (
    <div aria-hidden className="flex flex-col px-2 pb-2">
      <span className="mx-3 mt-2 mb-2.5 block h-2.5 w-16 rounded-badge bg-soft-fill" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-3 py-2">
          <span className="size-10 shrink-0 rounded-avatar bg-soft-fill" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className={cn('block h-3 rounded-badge bg-soft-fill', i === 1 ? 'w-1/2' : 'w-2/3')} />
            <span className="block h-2.5 w-1/3 rounded-badge bg-soft-fill" />
          </span>
        </div>
      ))}
    </div>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="t-caption flex items-center gap-1.5" aria-hidden>
      {keys.map((k) => (
        <kbd key={k} className="t-nano min-w-5 rounded-badge bg-soft-fill px-1 py-0.5 text-center text-ink-2">
          {k}
        </kbd>
      ))}
      {children}
    </span>
  );
}

type Groups = {
  list: PaletteGroup[];
  loading: boolean;
  /** Some group still shows the previous term's rows (keepPreviousData). */
  stale: boolean;
  /** Every group that ran failed, or some failed and nothing at all is shown. */
  error: boolean;
  /** Groups that failed while others answered («bălțile», «pescarii»…), for a partial note. */
  failed: string[];
  retry: () => void;
};

/**
 * The groups for a term: sections when empty, else lakes · competitions · anglers (5 each). The
 * previous term's rows stay while the next term loads (keepPreviousData), so the list does not
 * collapse and grow back on every keystroke.
 */
function usePaletteGroups(
  term: string,
  { enabled, signedIn, admin }: { enabled: boolean; signedIn: boolean | null; admin: AdminLink[] },
): Groups {
  const t = useMemo(() => createBrowserTransport(), []);
  const anglersOn = signedIn === true;
  const lakes = useInfiniteQuery({
    ...lakesInfiniteQuery(t, { pageSize: PER_GROUP, search: term }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const competitions = useQuery({ ...competitionSuggestionsQuery(t, term), enabled, placeholderData: keepPreviousData });
  const anglers = useInfiniteQuery({
    ...anglerSearchInfiniteQuery(t, term, { isAuthenticated: anglersOn, pageSize: PER_GROUP }),
    enabled: enabled && anglersOn,
    placeholderData: keepPreviousData,
  });

  if (!enabled) {
    const shortcuts: PaletteGroup[] = [
      {
        key: 'sectiuni',
        title: 'Secțiuni',
        options: SECTIONS.map(({ key, label, href, Icon }) => ({
          id: `s-${key}`,
          title: label,
          href,
          visual: <Icon className={ROW_ICON} aria-hidden />,
        })),
      },
    ];
    if (admin.length) {
      shortcuts.push({
        key: 'administrare',
        title: 'Administrare',
        options: admin.map(({ key, label, caption, href, Icon = Squares2X2Icon }) => ({
          id: `a-${key}`,
          title: label,
          subtitle: caption,
          href,
          visual: <Icon className={ROW_ICON} aria-hidden />,
        })),
      });
    }
    return { list: shortcuts, loading: false, stale: false, error: false, failed: [], retry: () => {} };
  }

  const list: PaletteGroup[] = [];
  const lakeRows = lakes.data?.pages[0]?.data ?? [];
  if (lakeRows.length) {
    list.push({
      key: 'balti',
      title: 'Bălți',
      options: lakeRows.slice(0, PER_GROUP).map((l) => {
        const image = l.images[0];
        return {
          id: `l-${l.documentId}`,
          title: l.name,
          subtitle: [l.countyRef?.name ?? l.county, l.regime].filter(Boolean).join(' · ') || undefined,
          href: routes.lake(l.documentId),
          visual: (
            <Avatar name={l.name} src={image?.thumbnailUrl ?? image?.smallUrl ?? image?.url} size={40} shape="square" />
          ),
        };
      }),
    });
  }

  // Lake and organiser suggestions are filter values of the competitions list; only the
  // «Concursuri» items name a competition page.
  const comps = (competitions.data ?? []).flatMap((g) => g.items).filter((s) => s.type === 'competition');
  if (comps.length) {
    list.push({
      key: 'concursuri',
      title: 'Competiții',
      options: comps.slice(0, PER_GROUP).map((c) => ({
        id: `c-${c.value}`,
        title: c.title,
        subtitle: c.subtitle || undefined,
        href: routes.competition(c.value),
        visual: (
          <span className={RESULT_ICON_SLOT}>
            <TrophyIcon className={ROW_ICON} aria-hidden />
          </span>
        ),
      })),
    });
  }

  const anglerRows = anglersOn ? (anglers.data?.pages[0]?.data ?? []) : [];
  if (anglerRows.length) {
    list.push({
      key: 'pescari',
      title: 'Pescari',
      options: anglerRows.slice(0, PER_GROUP).map((a) => ({
        id: `p-${a.documentId}`,
        title: a.username,
        subtitle: a.subline ?? undefined,
        href: routes.angler(a.documentId),
        visual: <Avatar name={a.username} src={a.avatarUrl} size={40} />,
      })),
    });
  }

  const ran = [
    { q: lakes, name: 'bălțile' },
    { q: competitions, name: 'competițiile' },
    ...(anglersOn ? [{ q: anglers, name: 'pescarii' }] : []),
  ];
  const failedRuns = ran.filter((g) => g.q.isError);
  const loading = ran.some((g) => g.q.isFetching);
  const shown = list.reduce((n, g) => n + g.options.length, 0);
  return {
    list,
    loading,
    stale: ran.some((g) => g.q.isPlaceholderData),
    error: failedRuns.length === ran.length || (failedRuns.length > 0 && shown === 0 && !loading),
    failed: failedRuns.map((g) => g.name),
    retry: () => {
      for (const g of failedRuns) void g.q.refetch();
    },
  };
}
