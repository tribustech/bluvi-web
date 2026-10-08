'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { iconButtonClass } from '@/components/nav/IconButton';
import { useBack } from '@/components/nav/useBack';
import { FOCUS_RING } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

export const CLOSE_LABEL = 'Închide galeria';

/*
 * fish GalleryScreenHeader: a round ✕ on the RIGHT of the header, on purpose in the same place as
 * the Lightbox's ✕, so the dismiss control does not jump sides when a tile opens. The kit icon
 * button (48 / 40 from 1280), round, on surface + hairline (the page ground erases a soft-fill —
 * ListHeader's back square). useBack: the page before this one in the tab, else the partidă (fish
 * router.back()). Shared by the screen and loading.tsx, so the header never shifts as the page lands.
 */
export function GalleryClose({ documentId }: { documentId: string | null }) {
  const back = useBack(documentId ? routes.partida(documentId) : routes.partide());
  return (
    <button
      type="button"
      onClick={back}
      aria-label={CLOSE_LABEL}
      data-testid="gallery-close"
      className={iconButtonClass({ className: cn('rounded-full bg-surface shadow-e0 hover:bg-soft-fill', FOCUS_RING) })}
    >
      <XMarkIcon aria-hidden />
    </button>
  );
}
