'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { competitionKeys } from '@/core/competitions';
import { competitionManagementKeys, startCantarMutation, weighingKeys } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * «Start cântar nou» (fish components/StartCantarSheet.tsx; parity organizer.scale-history c9/c10).
 * A centred dialog (the phone's detached sheet on the web):
 *  - confirm: «Ești sigur că vrei să începi un nou cântar?», «Sector: X, standul: Y», the checkbox
 *    «Marchează ca extra cântar», «Anulează» / «Începe cântarul»;
 *  - pending: a spinner in place of the buttons (one write, never two: the CTA is gone);
 *  - success: the dialog closes, then the new weighing opens (organizer.scale-weighing) — fish
 *    StartCantarSheet onDismiss() before router.push. With cacheComponents the history page is only
 *    hidden by <Activity> (state kept), so a dialog left open would greet Back with a stuck spinner;
 *  - error: the CMS's message with «Închide».
 * Settled either way: the stand's weighings, live competitions, the extra-scale lists and the active
 * weighing are refetched (fish onSettled).
 */

const FALLBACK_ERROR = 'Cântarul nu a putut fi pornit. Încearcă din nou.';

export function StartWeighingDialog({
  open,
  onClose,
  t,
  competitionId,
  standId,
  sectorName,
  standName,
}: {
  open: boolean;
  onClose: () => void;
  t: Transport;
  competitionId: string;
  standId: string;
  sectorName: string;
  standName: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const checkboxId = useId();
  const [extra, setExtra] = useState(false);
  const start = useMutation({
    ...startCantarMutation(t),
    onSuccess: (weighing) => {
      onClose();
      start.reset();
      router.push(routes.competitionScaleWeighing(competitionId, standId, weighing.documentId));
    },
    onSettled: () => {
      void qc.invalidateQueries({
        queryKey: weighingKeys.byCompetitionId(competitionId),
      });
      void qc.invalidateQueries({
        queryKey: ['competitions', 'live', 'extra-scale-new'],
      });
      void qc.invalidateQueries({ queryKey: competitionKeys.live });
      void qc.invalidateQueries({
        queryKey: competitionManagementKeys.extraScalesList(competitionId),
      });
      void qc.invalidateQueries({
        queryKey: competitionManagementKeys.activeWeighingById(competitionId),
      });
    },
  });

  // Reopening starts over: unchecked, no old error (fish mounts a new sheet each time).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setExtra(false);
      start.reset();
    }
  }

  // Pending, or already on its way to the new weighing: the dialog cannot be dismissed into a second start.
  const busy = start.isPending || start.isSuccess;
  const close = () => {
    if (!busy) onClose();
  };

  const submit = () => {
    if (busy) return;
    start.mutate({
      standId,
      competitionId,
      weighingType: extra ? 'extra' : 'normal',
    });
  };

  if (start.isError) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title="Cântarul nu a pornit"
        titleHidden
        actions={
          <Button onClick={close} data-testid="start-weighing-close">
            Închide
          </Button>
        }
      >
        <div role="alert" className="flex flex-col items-center gap-3 py-2 text-center">
          <ExclamationTriangleIcon aria-hidden className="size-8 text-status-danger-fg" />
          <p className="t-body-strong text-ink-2">{start.error?.message || FALLBACK_ERROR}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Ești sigur că vrei să începi un nou cântar?"
      description={
        <span className="t-body-strong text-muted">
          Sector: {sectorName}, standul: {standName}
        </span>
      }
      backdropDismiss={!busy}
      actions={
        busy ? null : (
          <>
            <Button variant="secondary" onClick={close}>
              Anulează
            </Button>
            <Button onClick={submit} data-testid="start-weighing-confirm">
              Începe cântarul
            </Button>
          </>
        )
      }
    >
      {busy ? (
        <div className="flex flex-col items-center gap-2 py-6" aria-busy="true">
          <ArrowPathIcon aria-hidden className="size-8 text-accent motion-safe:animate-spin" />
          <p role="status" className="t-caption text-muted">
            Se pornește cântarul…
          </p>
        </div>
      ) : (
        <label
          htmlFor={checkboxId}
          className={cn(
            't-body-strong mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-control border p-3 text-accent-ink transition-colors duration-(--duration-fast)',
            extra ? 'border-accent bg-accent-tint' : 'border-hairline hover:bg-soft-fill',
          )}
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={extra}
            onChange={(e) => setExtra(e.target.checked)}
            className="size-5 shrink-0 cursor-pointer accent-accent"
          />
          <span>Marchează ca extra cântar</span>
        </label>
      )}
    </Dialog>
  );
}
