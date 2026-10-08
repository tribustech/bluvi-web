'use client';

import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useBack } from '@/components/nav/useBack';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

export const TITLE = 'Alătură-te unei partide';
export const TITLE_ID = 'partida-intra-cod-title';

/**
 * The two answers. Below 768: T6's action bar (FlowActions' surface, hairline, tab-bar shadow and
 * safe-area inset), stuck to the bottom of the screen, CTA on top. From 768 the question is a
 * centred card — a dialog — so the answers sit in it, under the copy, side by side with the CTA on
 * the right (FlowLayout docks its bar under an aside, and a one-question step has none: a
 * full-width bar under a 720 card reads as a second card). -mb-8: the section's and the page's 16px
 * bottom paddings, so the bar meets the screen's bottom edge.
 */
export const JOIN_ACTIONS = cn(
  'sticky bottom-0 z-sticky -mx-4 -mb-8 mt-auto flex flex-col gap-2.5 border-t border-hairline bg-surface px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] shadow-tabbar',
  'md:static md:mx-0 md:mb-0 md:mt-0 md:flex-row-reverse md:justify-center md:gap-3 md:border-t-0 md:p-0 md:pb-6 md:shadow-none md:[&>*]:min-w-44',
);

/**
 * fish's join screen header (ChevronLeft + «Alătură-te unei partide»): T6's header band, its back
 * chip a button — fish goBack: back in history when the page before is ours, else the Partide tab
 * (components/nav/useBack). Shared by the loading shell, the screen and the route's error.
 */
export function JoinBackButton() {
  const back = useBack(routes.partide());
  return (
    <button type="button" onClick={back} aria-label="Înapoi" className={headerChipClass()}>
      <ChevronLeftIcon aria-hidden />
    </button>
  );
}

/**
 * The T6 frame: one task, centred in the 720 column from 768 (`narrow`); below 768 the step fills
 * the screen down to the answers' bar (`fill`, JOIN_ACTIONS). A gate (error) is `bare`.
 */
export function JoinFrame({ children, variant = 'card', busy }: { children: ReactNode; variant?: 'card' | 'bare'; busy?: boolean }) {
  return (
    // No crumb band (SiteHeader OWN_BAND_ROUTES): the header's back chip owns the way back, as on
    // /partide/intra and in fish (chevron + title). Never indexed, so no BreadcrumbList either.
    <FlowLayout
      header={<FlowHeader title={TITLE} id={TITLE_ID} backPlaceholder={<JoinBackButton />} />}
      labelledBy={TITLE_ID}
      variant={variant}
      narrow
      fill={variant === 'card'}
      busy={busy}
    >
      {children}
    </FlowLayout>
  );
}
