'use client';

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/**
 * fish components/PollSuggestionSentSheet.tsx (c11): a sheet on a phone, a dialog from 768.
 * «Sugestie trimisă!», the review promise, «Am înțeles».
 */
export function SuggestionSentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="decision"
      title="Sugestie trimisă!"
      sheetSnap="fit"
      actions={
        <Button block onClick={onClose}>
          Am înțeles
        </Button>
      }
    >
      <p className="flex items-start gap-2.5 t-body text-ink-2">
        <CheckCircleIcon aria-hidden className="size-6 shrink-0 text-success" />
        Sugestia ta a fost trimisă spre verificare. Dacă este aprobată, va fi adăugată ca opțiune în sondaj și vei primi o notificare.
      </p>
    </ResponsiveSurface>
  );
}
