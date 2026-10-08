'use client';

import { createElement, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import {
  acceptBookingMutation,
  friendlyActionError,
  markNoShowMutation,
  operatorCancelBookingMutation,
  rejectBookingMutation,
  type BookingDTO,
} from '@/core/booking';
import { createBrowserTransport } from '@/lib/client/transport';
import { AcceptBookingDialog } from './AcceptBookingDialog';
import { ACTION_TOAST, cancelWrite } from './model';
import { OperatorCancelDialog } from './OperatorCancelDialog';
import { RejectBookingDialog } from './RejectBookingDialog';

/** The focused control (the one opening a dialog), or null. */
function activeControl(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

export type OperatorBookingActions = {
  /** The booking a write is running for: its action buttons must be disabled (operator.b.double-submit). */
  actingId: string | null;
  /** Opens the accept confirmation (never acts directly). */
  accept: (b: BookingDTO) => void;
  /** Opens the reject reason dialog. */
  reject: (b: BookingDTO) => void;
  /** Opens the operator's cancel dialog (six reasons; «Pescarul nu s-a prezentat» marks a no-show). */
  cancel: (b: BookingDTO) => void;
  /** Render once, anywhere under the (site) shell (it needs the toast host). */
  dialogs: ReactNode;
};

/**
 * fish features/operator/useOperatorBookingActions.tsx — accept / reject / cancel / no-show for one
 * lake's bookings with the dialogs they need. Shared by the reservations inbox, the «Azi la baltă»
 * panel and the booking detail, so all three act through the very same dialogs and copy.
 *
 *  - accept(b) opens «Accepți rezervarea?»; «Confirmă» closes it and PATCHes /accept.
 *  - reject(b) opens «Respinge rezervarea» (mandatory free-text reason) → PATCH /reject.
 *  - cancel(b) opens «Anulează rezervarea» (mandatory pick + text): «Pescarul nu s-a prezentat»
 *    POSTs /no-show, every other reason PATCHes /operator-cancel.
 *  - Success: toast, the dialog closes; the core mutations invalidate ['bookings'] and
 *    ['operator-stats'] (no-show also ['reputation']). Failure (friendlyActionError by bluCode):
 *    accept toasts (its dialog is already closed); reject / cancel keep the dialog open with its
 *    text and show the refusal inline, as a role=alert line in the dialog — a site toast would paint
 *    under the modal's ::backdrop, dimmed and inert.
 *  - `actingId` is the booking a write is running for; one write at a time, as fish. While any
 *    write runs every dialog's confirm is busy (fish `isPending: !!actingId`), so a confirm on
 *    another booking is never a dead button.
 *
 * `lakeId` / `lakeName` scope the actions to one lake (fish analytics carry them, M8); the writes
 * themselves are keyed by the booking.
 */
export function useOperatorBookingActions(scope: { lakeId: string; lakeName?: string | null }): OperatorBookingActions {
  void scope;
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const acceptM = useMutation(acceptBookingMutation(t, qc));
  const rejectM = useMutation(rejectBookingMutation(t, qc));
  const cancelM = useMutation(operatorCancelBookingMutation(t, qc));
  const noShowM = useMutation(markNoShowMutation(t, qc));

  const [actingId, setActingId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<BookingDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BookingDTO | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingDTO | null>(null);

  const fail = useCallback((e: unknown) => toast(friendlyActionError(e as { bluCode?: string; message?: string }), 'danger'), [toast]);
  // The open reason dialog's refusal (c11), until the next edit, submit or close.
  const [refusal, setRefusal] = useState<string | null>(null);
  const failInline = useCallback((e: unknown) => setRefusal(friendlyActionError(e as { bluCode?: string; message?: string })), []);

  // Focus goes back to the control that opened a dialog once it is gone (the surfaces unmount on
  // close, so the native <dialog> focus return has nothing to return to). After «Confirmă» that
  // control is disabled while the write runs: the return waits for it.
  const returnFocus = useRef<HTMLElement | null>(null);
  const anyOpen = !!(acceptTarget || rejectTarget || cancelTarget);
  useEffect(() => {
    const el = returnFocus.current;
    if (anyOpen || !el) return;
    if (!el.isConnected) {
      returnFocus.current = null;
      return;
    }
    if ((el as HTMLButtonElement).disabled) return; // re-run when actingId clears
    returnFocus.current = null;
    el.focus();
  }, [anyOpen, actingId]);

  const accept = useCallback((b: BookingDTO) => {
    returnFocus.current = activeControl();
    setAcceptTarget(b);
  }, []);
  const reject = useCallback((b: BookingDTO) => {
    returnFocus.current = activeControl();
    setRefusal(null);
    setRejectTarget(b);
  }, []);
  const cancel = useCallback((b: BookingDTO) => {
    returnFocus.current = activeControl();
    setRefusal(null);
    setCancelTarget(b);
  }, []);

  const confirmAccept = useCallback(() => {
    const b = acceptTarget;
    if (!b || actingId) return;
    // fish: the sheet is dismissed first, the row's buttons carry the wait (actingId).
    setAcceptTarget(null);
    setActingId(b.documentId);
    acceptM.mutate(b.documentId, {
      onSuccess: () => toast(ACTION_TOAST.accepted, 'success'),
      onError: fail,
      onSettled: () => setActingId(null),
    });
  }, [acceptTarget, actingId, acceptM, toast, fail]);

  const confirmReject = useCallback(
    (reason: string) => {
      const b = rejectTarget;
      if (!b || actingId) return;
      setActingId(b.documentId);
      setRefusal(null);
      rejectM.mutate(
        { id: b.documentId, reason },
        {
          onSuccess: () => {
            toast(ACTION_TOAST.rejected, 'success');
            setRejectTarget(null);
          },
          onError: failInline,
          onSettled: () => setActingId(null),
        }
      );
    },
    [rejectTarget, actingId, rejectM, toast, failInline]
  );

  const confirmCancel = useCallback(
    (reason: string, optionKey?: string) => {
      const b = cancelTarget;
      if (!b || actingId) return;
      setActingId(b.documentId);
      setRefusal(null);
      const done = (text: string) => () => {
        toast(text, 'success');
        setCancelTarget(null);
      };
      const settle = { onError: failInline, onSettled: () => setActingId(null) };
      // No review afterwards, deliberately (fish): the star review scores a stay that never happened;
      // the mandatory text typed here IS the feedback, and the no-show already counts against them.
      if (cancelWrite(optionKey) === 'noShow') {
        noShowM.mutate({ bookingId: b.documentId, comment: reason }, { onSuccess: done(ACTION_TOAST.noShow), ...settle });
      } else {
        cancelM.mutate({ id: b.documentId, reason }, { onSuccess: done(ACTION_TOAST.cancelled), ...settle });
      }
    },
    [cancelTarget, actingId, noShowM, cancelM, toast, failInline]
  );

  // Any running write keeps every confirm busy (fish passes `!!actingId`); the writes run one at a time.
  const busy = !!actingId;
  const clearRefusal = () => setRefusal(null);
  const closeReason = (close: () => void) => () => {
    setRefusal(null);
    close();
  };

  const dialogs = createElement(
    Fragment,
    null,
    createElement(AcceptBookingDialog, {
      booking: acceptTarget,
      submitting: busy,
      onClose: () => setAcceptTarget(null),
      onConfirm: confirmAccept,
    }),
    createElement(RejectBookingDialog, {
      booking: rejectTarget,
      pending: busy,
      locked: !!rejectTarget && actingId === rejectTarget.documentId,
      refusal,
      onEdit: clearRefusal,
      onClose: closeReason(() => setRejectTarget(null)),
      onConfirm: confirmReject,
    }),
    createElement(OperatorCancelDialog, {
      booking: cancelTarget,
      pending: busy,
      locked: !!cancelTarget && actingId === cancelTarget.documentId,
      refusal,
      onEdit: clearRefusal,
      onClose: closeReason(() => setCancelTarget(null)),
      onConfirm: confirmCancel,
    })
  );

  return { actingId, accept, reject, cancel, dialogs };
}
