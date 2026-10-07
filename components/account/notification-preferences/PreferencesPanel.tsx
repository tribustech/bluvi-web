'use client';

import type { ReactNode } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { PreferenceGroupRow } from './PreferenceGroupRow';
import { usePreferencesDraft } from './usePreferencesDraft';

export type PreferencesPanelMode = 'celebrate' | 'edit';

const TITLE: Record<PreferencesPanelMode, string> = { celebrate: 'Te-ai abonat', edit: 'Ce notificări vrei?' };
const SAVE_FAILED = 'Nu am putut salva preferințele. Te rugăm să încerci din nou.';
const LOAD_FAILED = 'Nu am putut încărca notificările. Le poți seta mai târziu din Setări.';
const FOOTNOTE = 'Poți schimba oricând din clopoțelul din chat sau din Setări → Notificări.';
const SKELETON_ROWS = 4;

/**
 * Which notifications a followed competition sends — fish FollowNotificationsSheet, both modes
 * (parity account.notification-preferences c6–c16, account.b.follow-celebrate,
 * competition-page.shell c12):
 *  - `celebrate`, right after «Urmărește»: «Te-ai abonat» (fish's 🎉 dropped, Fundații §05: no
 *    emoji; its check animation is the success check), the competition's name, «Alege ce notificări
 *    vrei să primești.»;
 *  - `edit`, from Setări → Notificări → Concursuri urmărite: «Ce notificări vrei?» and the name.
 * Then the groups (four skeleton rows while they load, fish's copy when they cannot), the footnote,
 * and «Salvează» pinned at the bottom (busy while saving or while the groups have not loaded).
 *
 * Phone: a fixed 90% sheet (fish: one 88% snap); from 768 a centred dialog whose body scrolls under
 * the pinned button. Neither closes on a tap outside or a drag (fish renderNonDismissableBackdrop,
 * enablePanDownToClose false). Web a11y deviation from fish, where only «Salvează» closes: Escape
 * and a visible «Închide» X also close it, discarding the edits (a modal must have a keyboard way
 * out, WCAG 2.1.2). While a save is in flight neither does anything (fish has no close path then):
 * the panel stays open for the failure toast (c14), and a reopen cannot catch the optimistic value.
 * When the groups failed to load the button is «Închide».
 *
 * Mount one panel per competition (key it by the competition's id): its draft and its mutation are
 * that competition's.
 */
export function PreferencesPanel({
  mode,
  open,
  onClose,
  onSaved,
  competitionId,
  competitionName,
}: {
  mode: PreferencesPanelMode;
  open: boolean;
  onClose: () => void;
  /** After a successful save, before the panel closes (fish onSaved: the list refetches). */
  onSaved?: () => void;
  competitionId: string;
  competitionName?: string;
}) {
  const breakpoint = useBreakpoint();
  const toast = useSiteToast();
  const draft = usePreferencesDraft(competitionId, open);

  const save = async () => {
    try {
      await draft.save();
      onSaved?.();
      onClose();
    } catch {
      toast(SAVE_FAILED, 'danger');
    }
  };

  const busy = draft.saving || !draft.data;
  // Escape and the X do nothing while the PUT is in flight.
  const close = draft.saving ? noop : onClose;
  const action = draft.failed ? (
    <Button variant="secondary" block onClick={onClose}>
      Închide
    </Button>
  ) : (
    <Button
      block
      onClick={() => {
        if (!busy) void save();
      }}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      className={busy ? 'cursor-progress' : undefined}
      icon={busy ? <Spinner /> : undefined}
    >
      Salvează
    </Button>
  );

  const body = (
    <div className="flex flex-col gap-3" data-testid="preferences-panel" data-mode={mode}>
      {mode === 'celebrate' ? (
        <p className="flex items-center gap-2 t-body text-ink-2">
          <CheckCircleIcon aria-hidden className="size-6 shrink-0 text-success" />
          Alege ce notificări vrei să primești.
        </p>
      ) : null}
      {draft.loading ? (
        <div role="status" aria-label="Se încarcă notificările" className="flex flex-col gap-3 py-1">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <span key={i} aria-hidden className="block h-11.5 animate-shimmer rounded-control" />
          ))}
        </div>
      ) : draft.failed ? (
        <p role="alert" className="py-2 t-body text-muted">
          {LOAD_FAILED}
        </p>
      ) : draft.data ? (
        <ul aria-label="Grupuri de notificări" className="flex flex-col">
          {draft.data.groups.map(group => (
            <PreferenceGroupRow key={group.key} group={group} muted={draft.muted} onToggleGroup={draft.setGroup} onToggleType={draft.setType} />
          ))}
        </ul>
      ) : null}
      <p className="t-caption text-muted">{FOOTNOTE}</p>
    </div>
  );

  const subtitle: ReactNode = competitionName ? <span className="block truncate">{competitionName}</span> : undefined;

  if (breakpoint === 'mobile') {
    return (
      <Sheet
        open={open}
        onClose={close}
        title={TITLE[mode]}
        subtitle={subtitle}
        initialSnap={0.9}
        fixed
        backdropDismiss={false}
        closeButton
        footer={action}
      >
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={TITLE[mode]}
      subtitle={subtitle}
      closeButton
      backdropDismiss={false}
      scrollBody
      actions={action}
    >
      {body}
    </Dialog>
  );
}

function noop() {}

/** The button's busy mark (fish Button `loading`), in the label's colour. */
function Spinner() {
  return <span aria-hidden className="block size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
