'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { FishIcon } from '@/components/icons/brand';
import { IconButton } from '@/components/nav/IconButton';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { SEARCH_SHELL, TextAction } from '@/components/templates/T1';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import type { VenueOption } from './view';

/*
 * «Filtrează după baltă» — fish features/partide/components/community/VenueFilterScreen.tsx (parity
 * partide.istoric.c4): a multi-select over the venues of the viewer's finished partide (the caller
 * gives them, alphabetical). A sheet on the phone (fish's full-screen modal), a dialog from 768.
 *
 *  - The selection is a draft, seeded from the applied filter at each opening; «Aplică (n)» commits
 *    it, the X / Escape / the backdrop discard it (fish).
 *  - The search is local and diacritic-insensitive over the name and the helper (fish normalize).
 *  - «{n} selectate» / «Nicio baltă selectată», and «Golește filtrele» clears the draft.
 */

export const VENUE_FILTER_TITLE = 'Filtrează după baltă';

/** fish normalize (helpers/lakesSearch normalizeSearchText). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function VenueMultiFilterDialog({
  open,
  onClose,
  options,
  selected,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  options: VenueOption[];
  selected: string[];
  /** The caller applies and closes. */
  onApply: (values: string[]) => void;
}) {
  // The draft lives here (not in the body) so the pinned «Aplică (n)» footer reads it; it is
  // re-seeded on every opening (fish: on the `visible` transition only).
  const [draft, setDraft] = useState<string[]>(selected);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(selected);
  }

  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title={VENUE_FILTER_TITLE}
      sheetSnap={0.9}
      pinnedActions
      actions={
        <Button type="button" block className="md:w-auto md:min-w-40" onClick={() => onApply(draft)} data-testid="venue-apply">
          {draft.length > 0 ? `Aplică (${draft.length})` : 'Aplică'}
        </Button>
      }
    >
      {open ? <PickerBody options={options} draft={draft} setDraft={setDraft} /> : null}
    </ResponsiveSurface>
  );
}

function PickerBody({
  options,
  draft,
  setDraft,
}: {
  options: VenueOption[];
  draft: string[];
  setDraft: (next: (prev: string[]) => string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');

  useEffect(() => {
    // After showModal(), which focuses the first control (the close X): the field takes it.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const shown = useMemo(() => {
    const q = normalize(term);
    if (!q) return options;
    return options.filter(o => normalize(o.name).includes(q) || normalize(o.helper).includes(q));
  }, [options, term]);

  const toggle = (value: string) => setDraft(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]));

  return (
    <div className="flex flex-col pt-1" data-testid="venue-multi-picker">
      <form role="search" onSubmit={e => e.preventDefault()} className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-1">
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
            placeholder="Caută o baltă"
            aria-label="Caută o baltă"
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
        </div>
      </form>

      <div className="flex min-h-11 items-center justify-between gap-3 px-0.5">
        <p role="status" className="t-label text-ink-2" data-testid="venue-draft-count">
          {draft.length > 0 ? formatCount(draft.length, 'selectată', 'selectate') : 'Nicio baltă selectată'}
        </p>
        {draft.length > 0 ? (
          <TextAction onClick={() => setDraft(() => [])} className="mr-0">
            Golește filtrele
          </TextAction>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <ul aria-label="Bălți" className="flex flex-col pb-2">
          {shown.map(o => (
            <VenueRow key={o.value} option={o} checked={draft.includes(o.value)} onToggle={() => toggle(o.value)} />
          ))}
        </ul>
      ) : (
        <p className="px-0.5 py-3 t-body text-muted" data-testid="venue-multi-empty">
          Nu am găsit rezultate pentru căutarea ta.
        </p>
      )}
    </div>
  );
}

/** fish VenueFilterRow: a 40 rounded tile (the fish glyph without a photo), name, helper, a check circle. */
function VenueRow({ option, checked, onToggle }: { option: VenueOption; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        data-testid="venue-multi-option"
        className={cn(
          'group -mx-2 flex min-h-14 w-[calc(100%+var(--spacing)*4)] cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left',
          'transition-colors duration-(--duration-fast) hover:bg-soft-fill',
          'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
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
          <span className="truncate t-caption text-muted group-hover:text-ink-2">{option.helper}</span>
        </span>
        {checked ? (
          <CheckCircleIcon aria-hidden className="size-5.5 shrink-0 text-accent-ink" />
        ) : (
          <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-hairline" />
        )}
      </button>
    </li>
  );
}
