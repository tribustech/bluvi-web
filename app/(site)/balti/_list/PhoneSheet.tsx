'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/components/nav/IconButton';
import { Sheet, type SheetSnap } from '@/components/surfaces/Sheet';
import { cn } from '@/components/ui/cn';

/*
 * Every phone sheet on Bălți (the search, the filters): the kit Sheet with ONE close affordance —
 * the IconButton X named «Închide», as the kit Dialog has (lakes.search.c1, lakes.filters.c9; fish
 * LakeFilterPickerSheet's header X) — on the title row.
 *
 * TODO(kit): a `closeButton` prop on surfaces/Sheet, as Dialog has. Until then the kit title stays
 * the sheet's accessible name (visually hidden) and the visible title row — title + X — is the
 * first thing in the sheet's scroller, sticky at its top with whatever must stay with it (`pinned`:
 * the search input). Once the content scrolls under it, the row gets its hairline edge. No offsets
 * into the Sheet's internal padding: when the kit header changes, this row does not break.
 */
export function PhoneSheet({
  open,
  onClose,
  title,
  footer,
  initialSnap = 0.9,
  pinned,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  initialSnap?: SheetSnap;
  /** Stays on top with the title row while the rest scrolls (the search input). */
  pinned?: ReactNode;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!open) return;
    const scroller = rowRef.current?.closest<HTMLElement>('.overflow-y-auto');
    if (!scroller) return;
    const onScroll = () => setStuck(scroller.scrollTop > 0);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      initialSnap={initialSnap}
      // The kit title (h2 in the drag header) stays the dialog's name for screen readers; the row
      // below draws it. overflow-clip: showModal() focuses the handle while the panel slides up and
      // must not scroll the <dialog> (T2Panel).
      className="overflow-clip [&>div>div:first-child>h2]:sr-only"
    >
      <div
        ref={rowRef}
        className={cn(
          'sticky top-0 z-above -mx-5 -mt-2 flex flex-col gap-2 border-b bg-surface px-5 pb-2',
          stuck ? 'border-hairline' : 'border-transparent',
        )}
      >
        <div className="flex items-center gap-3">
          <p aria-hidden className="min-w-0 flex-1 truncate t-heading">
            {title}
          </p>
          <IconButton aria-label="Închide" size="size-11" onClick={onClose} className="-mr-2.5">
            <XMarkIcon aria-hidden />
          </IconButton>
        </div>
        {pinned}
      </div>
      {children}
    </Sheet>
  );
}

/**
 * The same «Închide» X for a phone sheet this page does not render itself — the lakes map's filter
 * sheet is the kit T2Panel's Sheet, whose title row it cannot reach — laid over that title row
 * (the host gives the sheet's panel `relative`), hidden from 768 where the surface has its own X.
 * It goes away with the same kit TODO above (Sheet `closeButton`).
 */
export function KitSheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <IconButton aria-label="Închide" size="size-10" onClick={onClose} className="absolute! top-6.5 right-3 z-above md:hidden">
      <XMarkIcon aria-hidden />
    </IconButton>
  );
}
