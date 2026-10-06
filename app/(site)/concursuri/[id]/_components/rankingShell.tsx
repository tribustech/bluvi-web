'use client';

import type { ReactNode } from 'react';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';

/*
 * The ranking card's chrome every ranking of the page uses (RankingView.tsx, FeederRanking.tsx,
 * NcRanking.tsx): one card, one band of controls at its top, the «Clasament complet» buttons. The
 * table parts themselves (header / cell / pin steps, the frame, the place cell, the seat label) are
 * the kit's: components/ranking/shell.tsx, shared with the kit RankingTable.
 */

/** The ranking card's band of controls (RankingView's toolbar): one row, on the card's surface. */
export const RANKING_TOOLBAR = 'flex min-w-0 items-center gap-3 px-3 py-2.5';

/**
 * A ranking card: the band of controls at its top, then the table (a RankingFrame `embedded`). What is
 * not a table (a state, the leg's sector cards from 1280) goes under the card, `after`.
 */
export function RankingCard({ toolbar, children, after }: { toolbar: ReactNode; children?: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-clip rounded-card bg-surface shadow-e0">
        <div className={RANKING_TOOLBAR}>{toolbar}</div>
        {children}
      </div>
      {after}
    </div>
  );
}

/**
 * «Clasament complet» in the band (RankingView's pattern): the labelled button from 1280, the
 * full-screen icon 768–1279; none on the phone (the action bar has it).
 */
export function FullViewButtons({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <>
      <Button variant="secondary" icon={<ArrowsPointingOutIcon />} onClick={onPress} disabled={disabled} className="shrink-0 max-xl:hidden">
        Clasament complet
      </Button>
      <IconButton
        aria-label="Clasament complet"
        title="Clasament complet"
        onClick={onPress}
        disabled={disabled}
        size="size-11"
        className="shrink-0 max-md:hidden xl:hidden"
      >
        <ArrowsPointingOutIcon aria-hidden />
      </IconButton>
    </>
  );
}
