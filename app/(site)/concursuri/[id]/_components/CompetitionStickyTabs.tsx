'use client';

import type { ReactNode } from 'react';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { DetailPinnedBand, DetailShareButton } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSiteToast } from '../../../_shell/Toast';
import { SHARE_PROPS, shareText } from './CompetitionHeader';

/**
 * The competition's route tabs as T3's pinned band (the lake's anatomy, components/templates/T3/
 * DetailPinned): on the phone, once the header has scrolled away, a mini row — the name with the
 * LIVE pill on its line while live (as the header), the 44px share chip as
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
  // Only the live state has a pill, as the header (parity shell.c4: fish badges no other status).
  const state = c.competitionStatus === 'started' ? <StatusPill tone="live">LIVE</StatusPill> : null;
  return (
    <DetailPinnedBand
      title={c.name}
      badge={state}
      end={
        <span {...SHARE_PROPS}>
          <DetailShareButton
            title={c.name}
            text={shareText(c)}
            label="Distribuie competiția"
            size="size-11"
            onCopied={() => toast('Linkul competiției a fost copiat.', 'success')}
          />
        </span>
      }
    >
      {children}
    </DetailPinnedBand>
  );
}
