'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import type { Confirm } from './model';

/**
 * fish's Alert before a status change (CollapsableActions create…Alert): the title, the question,
 * «Închide» and the action. An alert dialog: it must be answered (Escape = «Închide»).
 */
export function StatusConfirmDialog({ confirm, subject, onCancel, onConfirm }: { confirm: Confirm | null; subject: string | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open={!!confirm}
      onClose={onCancel}
      alert
      title={confirm?.title ?? ''}
      subtitle={subject ?? undefined}
      description={confirm?.question}
      actions={
        confirm ? (
          <>
            <Button variant="ghost" onClick={onCancel}>
              Închide
            </Button>
            <Button variant={confirm.tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirm.confirm}
            </Button>
          </>
        ) : null
      }
    />
  );
}
