'use client';

import { TrashIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import type { BlockRow } from '@/core/booking';
import { deleteConfirmCopy } from './model';

/**
 * c9 — fish BlockRow's Alert.alert: «Șterge blocajul?» / «Această acțiune nu poate fi anulată.» for
 * one block, «Șterge {n} blocaje?» / «{scope} — se deblochează toate.» for a multi-stand row.
 * «Înapoi» (safe, first) closes; «Șterge» (destructive) hands the row to the caller, which closes
 * this and runs the DELETEs (the row carries the wait). An alert dialog: it must be answered.
 */
export function DeleteBlockDialog({ row, onClose, onConfirm }: { row: BlockRow | null; onClose: () => void; onConfirm: (row: BlockRow) => void }) {
  const copy = row ? deleteConfirmCopy(row) : null;
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      alert
      title={copy?.title ?? ''}
      description={copy?.description}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose} data-testid="block-delete-cancel">
            Înapoi
          </Button>
          <Button
            type="button"
            variant="danger"
            icon={<TrashIcon strokeWidth={2} />}
            onClick={() => {
              if (row) onConfirm(row);
            }}
            data-testid="block-delete-confirm"
          >
            Șterge
          </Button>
        </>
      }
    />
  );
}
