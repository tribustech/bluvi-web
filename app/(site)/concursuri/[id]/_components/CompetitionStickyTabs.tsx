'use client';

import type { ReactNode } from 'react';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { DetailPinnedBand, DetailShareButton } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSiteToast } from '../../../_shell/Toast';
import { shareText } from './CompetitionHeader';

/**
 * The competition's route tabs as T3's pinned band (the lake's anatomy, components/templates/T3/
 * DetailPinned): on the phone, once the header has scrolled away, a mini row — the name with the
 * state pill on its line (LIVE / Viitor / Încheiat / Anulat, as the header), the 44px share chip as
 * on the lake — pins above the tabs and
 * follows the bar to the top edge; from 768 the tabs alone, under the 64px bar.
 */
export function CompetitionStickyTabs({
  competition: c,
  children,
}: {
  competition: Pick<CompetitionWithMyStatus, 'name' | 'lake' | 'competitionStatus'>;
  /** The route tabs (DetailTabs). */
  children: ReactNode;
}) {
  const toast = useSiteToast();
  const status = c.competitionStatus;
  const state =
    status === 'started' ? (
      <StatusPill tone="live">LIVE</StatusPill>
    ) : status === 'notStarted' ? (
      <StatusPill tone="info">Viitor</StatusPill>
    ) : status === 'completed' ? (
      <StatusPill tone="neutral">Încheiat</StatusPill>
    ) : status === 'cancelled' ? (
      <StatusPill tone="cancelled">Anulat</StatusPill>
    ) : null;
  return (
    <DetailPinnedBand
      title={c.name}
      badge={state}
      end={
        <DetailShareButton
          title={c.name}
          text={shareText(c)}
          label="Distribuie competiția"
          size="size-11"
          onCopied={() => toast('Linkul competiției a fost copiat.', 'success')}
        />
      }
    >
      {children}
    </DetailPinnedBand>
  );
}
