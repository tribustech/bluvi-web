'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsAsReadMutation } from '@/core/social';
import { isApiError, type Transport } from '@/core/transport';
import { pageToolClass } from '@/components/templates/T1';
import { useSiteToast } from '../../_shell/Toast';

const FALLBACK_ERROR = 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.';

/**
 * «Citește tot» (account.notifications.c3–c4; fish useMarkAllNotificationsAsRead): every loaded
 * row turns read at once (core markAllReadInPages), POST /notification-users/mark-all-as-read, an
 * error toast with the server's message on failure, and every notification query — the list and
 * the top bar's unread count — is refetched when it settles (so a failure shows the truth again).
 * The page shows it while a loaded row is unread or the unread count is above 0; when it goes, focus moves to the title
 * (`onDone`), never to <body>. `className` restyles it (the summary column's labelled button).
 */
export function MarkAllRead({ t, onDone, className }: { t: Transport; onDone?: () => void; className?: string }) {
  const qc = useQueryClient();
  const toast = useSiteToast();
  const { mutate, isPending } = useMutation({
    ...markAllNotificationsAsReadMutation(t, qc),
    onError: (error) => toast(isApiError(error) && error.message ? error.message : FALLBACK_ERROR, 'danger'),
  });
  return (
    <button
      type="button"
      data-testid="notifications-mark-all-read"
      aria-disabled={isPending || undefined}
      onClick={() => {
        if (isPending) return;
        mutate();
        onDone?.();
      }}
      className={className ?? pageToolClass({ iconOnly: false })}
    >
      Citește tot
    </button>
  );
}
