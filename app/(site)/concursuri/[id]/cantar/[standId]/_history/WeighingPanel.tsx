'use client';

import { useQuery } from '@tanstack/react-query';
import { TrashIcon } from '@heroicons/react/24/outline';
import { weighingByIdQuery } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { formatCount } from '@/core/realtime/chat/format';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { FlowAsideCard } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { QueryRetry } from '../../../_components/QueryRetry';
import { formatWeighingKg, type WeighingRow } from './model';
import { Interval, StatusBadge } from './WeighingCard';

/*
 * The detail side panel from 1280 (owner rule 14): the selected weighing — its state, the total as
 * the signature number (unit spaced, rule 10), the interval, its catches (species and kg, read from
 * /feed/weighings/:id; the first PANEL_CATCHES, then «+N capturi», so the docked «Start cântar nou»
 * stays above the fold on 1280×800), «Deschide cântarul» (c5) and, when allowed, «Șterge cântarul» (c7).
 * The catches are only listed once known (rule 4): bones while they load, a retry if the read fails.
 */

/** At most this many catches in the panel, then «+N capturi» (the full list is «Deschide cântarul»). */
export const PANEL_CATCHES = 5;

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function WeighingPanel({
  t,
  row,
  href,
  deletable,
  deleting,
  onDelete,
  onNavigate,
}: {
  t: Transport;
  row: WeighingRow;
  href: string;
  deletable: boolean;
  deleting: boolean;
  onDelete: () => void;
  onNavigate: (event: { preventDefault: () => void }) => void;
}) {
  // The panel is only on screen from 1280 (FlowLayout hides the aside below): read the catches there
  // only, and never for a weighing without any.
  const desktop = useBreakpoint() === 'desktop';
  const detail = useQuery({
    ...weighingByIdQuery(t, row.id),
    enabled: desktop && row.catches > 0,
  });
  return (
    <FlowAsideCard title={row.title} id="cantar-detaliu" meta={<StatusBadge finished={row.finished} />} className="xl:shrink-0">
      <div data-testid="weighing-panel" className="flex flex-col gap-3">
        <SignatureNumber
          size="stat"
          value={formatWeighingKg(row.totalKg)}
          unit="kg"
          caption={row.catches === 0 ? 'Nicio captură' : formatCount(row.catches, 'captură', 'capturi')}
        />
        <Interval row={row} />
        <section aria-labelledby="cantar-detaliu-capturi" className="flex flex-col gap-1 border-t border-hairline pt-3">
          <h3 id="cantar-detaliu-capturi" className="t-label text-muted">
            Capturi
          </h3>
          {row.catches === 0 ? (
            <p className="t-body text-muted">Nicio captură încă.</p>
          ) : detail.data ? (
            <>
              <ul className="flex flex-col">
                {detail.data.catches.slice(0, PANEL_CATCHES).map((c, i) => (
                  <li key={c.documentId} className="flex items-baseline gap-2 border-b border-hairline py-1.5 last:border-b-0">
                    <span className="t-caption w-5 text-muted tabular-nums">{i + 1}.</span>
                    <span className="t-body min-w-0 flex-1 truncate text-ink">{c.fishType?.Name || 'Specie nespecificată'}</span>
                    <span className="t-body-strong whitespace-nowrap text-ink tabular-nums">
                      {formatWeighingKg(c.weight)}
                      <span className="t-caption ml-1 text-muted">kg</span>
                    </span>
                  </li>
                ))}
              </ul>
              {detail.data.catches.length > PANEL_CATCHES ? (
                <p className="t-caption pt-1 text-muted" data-testid="weighing-panel-more">
                  +{formatCount(detail.data.catches.length - PANEL_CATCHES, 'captură', 'capturi')}
                </p>
              ) : null}
            </>
          ) : detail.isError ? (
            <div className="flex flex-col items-start gap-2">
              <p className="t-caption text-muted">Capturile nu au putut fi încărcate.</p>
              <QueryRetry size="compact" fetching={detail.isFetching} failed onRetry={() => void detail.refetch()} />
            </div>
          ) : (
            <ul aria-hidden className="flex flex-col">
              {Array.from({ length: Math.min(row.catches, PANEL_CATCHES) }, (_, i) => (
                <li key={i} className="t-body py-1.5">
                  <span className={`${BAR} h-3 w-full`} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex flex-col gap-2 border-t border-hairline pt-3">
          <ButtonLink href={href} onClick={onNavigate} variant="secondary" block>
            Deschide cântarul
          </ButtonLink>
          {deletable ? (
            <Button variant="danger" block onClick={onDelete} disabled={deleting} aria-busy={deleting || undefined} icon={<TrashIcon />}>
              Șterge cântarul
            </Button>
          ) : null}
        </div>
      </div>
    </FlowAsideCard>
  );
}
