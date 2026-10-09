'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RichTextNode } from '@/core/shared';
import { DetailProse, richTextToPlain } from '@/components/templates/T3';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { cn } from '@/components/ui/cn';

/*
 * Parts shared by the competition's route tabs (Informații, Participanți, Extra Cântare,
 * Regulament).
 */

/** A text bone inside a line of the given type step (as tall as the loaded text). */
export function Bone({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full" />
    </span>
  );
}

/** A first guess, from the text alone, that it is longer than the 100px clamp at some width. */
function likelyOverflows(blocks: RichTextNode[]): boolean {
  const filled = blocks.filter(b => richTextToPlain([b]));
  return filled.length >= 4 || richTextToPlain(blocks).length > 160;
}

/**
 * fish ExpandableText + PortalContent (CompetitionInfo «Descriere» / «Premii»): the rich text held to
 * 100px with a fade, and — only when it is longer — «Vezi mai mult», which opens the whole text in
 * an overlay titled like the section (phone: a bottom sheet at 90%; from 768 a dialog at the 720
 * reading measure). TODO(kit, T3 owner): DetailProse `collapsed` expands in place with «Citește mai
 * mult»; fish opens an overlay — give DetailProse an `onMore` mode and drop this wrapper.
 *
 * No layout shift on hydration: the server cannot measure, so it guesses from the text
 * (likelyOverflows) and reserves the button's row when the text is probably long. Measured in the
 * browser, a reserved row is kept (its button hidden, inert) when the text fits at this width, and
 * the row only appears late for a short text that still overflows (rare).
 *
 * Keyboard: a link in the clipped part can still take focus (tel: / https links are common in
 * descriptions and prizes). The moment focus lands inside the clamped text, the clamp lifts (the
 * whole text in place, no fade), so the focused link and its ring are never hidden (WCAG 2.4.7 /
 * 2.4.11); «Vezi mai mult» then has nothing more to show and keeps its reserved row, hidden.
 */
export function ClampedRichText({ blocks, title }: { blocks: RichTextNode[]; title: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const reserve = useMemo(() => likelyOverflows(blocks), [blocks]);
  const [overflows, setOverflows] = useState(reserve);
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const clamped = !lifted;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [blocks, lifted]);
  return (
    <div className="flex flex-col gap-2">
      <div
        id={id}
        ref={ref}
        // 100px, fish's clamp (spacing 25).
        className={cn(clamped && 'max-h-25 overflow-hidden', clamped && overflows && '[mask-image:linear-gradient(to_bottom,black_45%,transparent)]')}
        onFocus={
          clamped && overflows
            ? e => {
                const target = e.target;
                setLifted(true);
                // The text grew under the focused link: bring it back into view.
                requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest' }));
              }
            : undefined
        }
      >
        <DetailProse blocks={blocks} stripLeadingLabel={title} />
      </div>
      {reserve || overflows ? (
        <div className="flex min-h-11 items-center" aria-hidden={!overflows || undefined} inert={!overflows || undefined}>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className={cn(
              'inline-flex min-h-11 items-center self-start rounded-control t-body-strong text-accent-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent',
              !overflows && 'invisible',
            )}
          >
            Vezi mai mult
            <span className="sr-only">: {title}</span>
          </button>
        </div>
      ) : null}
      <TextOverlay open={open} onClose={() => setOpen(false)} title={title}>
        <DetailProse blocks={blocks} stripLeadingLabel={title} />
      </TextOverlay>
    </div>
  );
}

/** fish PortalContent: a whole text over the page — the phone's bottom sheet, a reading dialog from 768. */
function TextOverlay({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const breakpoint = useBreakpoint();
  if (breakpoint === 'mobile') {
    return (
      <Sheet open={open} onClose={onClose} title={title} initialSnap={0.9}>
        {/* Focusable so a keyboard can scroll the sheet's text (axe scrollable-region-focusable:
            TODO(kit, Sheet) — make the Sheet's own scroll body focusable). */}
        <div tabIndex={0} role="region" aria-label={title} className="rounded-control pb-6 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent">
          {children}
        </div>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} closeButton className="md:max-w-180">
      <div
        tabIndex={0}
        role="region"
        aria-label={title}
        className="-mx-5 max-h-[70dvh] overflow-y-auto px-5 pb-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        {children}
      </div>
    </Dialog>
  );
}
