'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { DetailProse } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import type { RichTextNode } from '@/core/shared';
import { useLake } from './LakeActions';

/*
 * fish ExpandableText (parity lakes.detail.c13): the description held to a few lines with a fade
 * over the last two, and «Vezi mai mult» opening the whole text titled «Descriere» (fish a full
 * page; the web the page's dialog, a sheet on the phone).
 *
 * `long` is decided on the server (LakeScreen, from the text's length), so the fade and the button
 * are in the first paint — nothing shifts after hydration, and the HTML alone has them. In the
 * browser a ResizeObserver only corrects the rare long text that still fits the box (a wide
 * card): the fade goes and the button turns `invisible`, keeping its line so nothing moves.
 * The box is a whole number of lines (5 × 20px phone, 4 × 22px from 768, 6 × 22px from 1280).
 */
export function DescriptionPreview({ blocks, long }: { blocks: RichTextNode[]; long: boolean }) {
  const { open } = useLake();
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !long) return;
    const check = () => setFits(el.scrollHeight <= el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [long]);

  const clipped = long && !fits;
  return (
    <div className="flex flex-col gap-1">
      <div
        ref={ref}
        className={cn(
          long && 'max-h-25 overflow-hidden md:max-h-22 xl:max-h-33',
          clipped && '[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5em),transparent)]',
        )}
      >
        <DetailProse blocks={blocks} stripLeadingLabel="Descriere" />
      </div>
      {long ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => open('description')}
          aria-hidden={fits || undefined}
          tabIndex={fits ? -1 : undefined}
          className={cn('self-start rounded-badge t-body-strong text-accent-ink underline-offset-2 hover:underline', fits && 'invisible')}
        >
          Vezi mai mult
        </button>
      ) : null}
    </div>
  );
}
