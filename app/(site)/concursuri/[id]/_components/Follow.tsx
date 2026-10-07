'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon as BellAlertSolidIcon } from '@heroicons/react/24/solid';
import { EyeIcon as EyeSolidIcon } from '@heroicons/react/20/solid';
import {
  competitionFollowersQuery,
  competitionKeys,
  followCompetitionMutation,
  prefetchCompetitionNotificationPreferences,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { isApiError } from '@/core/transport';
import { PRESENCE_ICON } from '@/components/templates/T3';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { PreferencesPanel } from '@/components/account/notification-preferences';
import { FollowersList, followersSubtitle } from '@/components/cards/FollowersList';
import { Button, type ButtonSize } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { anglerHref } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { useSiteToast } from '../../../_shell/Toast';
import { pageTransport } from './transport';

/*
 * The header's follow cluster — fish CompetitionHeader `handleOnFollowCompetition`, FollowButton,
 * FollowersPill + FollowersListSheet and FollowNotificationsSheet (parity competition-page.shell
 * c5–c14). Fundații §07: a pill (radius 999) is a STATE; «Urmărește» is an action, so it is the kit
 * Button — the tonal `secondary` to follow, the quiet neutral `ghost` on soft fill once following
 * (and aria-pressed: «Urmărește» → «Urmăresc», fish's eye → the solid ringing bell) — and the follower count (it opens the list) a text link with
 * the solid 20 eye (a presence mark).
 */

/** The viewer as the page knows it: signed in, signed out (null), or not known yet (undefined). */
export type PageViewer = Viewer | null | undefined;

// fish's copy word for word, without its 😭 (Fundații §05: no emoji in the product UI).
const SIGNED_OUT_MESSAGE = 'Ooops.. Intră în contul tău pentru a urmări competițiile live!';
const RECHECK_FAILED = 'Nu am putut verifica starea. Reîncearcă.';
const ALREADY_IN_MESSAGE = 'Faci deja parte din această competiție și vei fi la curent cu toate evenimentele!';
const FOLLOW_FAILED = 'Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu.';

/**
 * The toast for a failed follow: the CMS's own message only when it is one the app handles (a
 * `bluCode` error carries Romanian copy written for the angler); anything else (a timeout, a path,
 * a Strapi «Internal Server Error») is the screen's Romanian copy, never the raw text.
 */
function followErrorMessage(error: unknown): string {
  return isApiError(error) && error.bluCode && error.message ? error.message : FOLLOW_FAILED;
}

/* ------------------------------------------------------------------ */
/* Followers pill + list                                               */
/* ------------------------------------------------------------------ */

/**
 * fish FollowersPill: «{n} urmăritor / urmăritori» with an eye; opens the followers list. Shown at 0
 * too (parity shell.c5: n = viewers, 0 when absent; the list then says «Nu există urmăritori»), so the
 * badge row keeps its anatomy and the first follow only changes the number.
 */
export function FollowersPill({ competition }: { competition: CompetitionWithMyStatus }) {
  const [open, setOpen] = useState(false);
  const count = Math.max(0, competition.viewers ?? 0);
  return (
    <>
      {/*
        A text link with the eye — a presence mark beside text, so the solid 20 glyph (Fundații §05)
        — and no side padding, so it lines up with the title when it leads the row. Phone: a 44px
        target whose extra height hangs outside the row (-my), so the row is as tall as its pills.
      */}
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 t-label whitespace-nowrap text-ink-2 hover:text-ink hover:underline max-md:-my-2.5 md:min-h-9"
      >
        <EyeSolidIcon aria-hidden className={PRESENCE_ICON.strong} />
        {count} {count === 1 ? 'urmăritor' : 'urmăritori'}
      </button>
      <FollowersSurface open={open} onClose={() => setOpen(false)} competitionId={competition.documentId} />
    </>
  );
}

/** Phone: the bottom sheet (fish FollowersListSheet); from 768 a dialog. */
function FollowersSurface({ open, onClose, competitionId }: { open: boolean; onClose: () => void; competitionId: string }) {
  const breakpoint = useBreakpoint();
  const t = useMemo(() => pageTransport(), []);
  const { data: followers, isPending, isError, refetch, isFetching } = useQuery({ ...competitionFollowersQuery(t, competitionId), enabled: open });
  const subtitle = followersSubtitle(followers);
  // Rows link the angler profile once the web has it (lib/routes.ts anglerHref, M2).
  const body = (
    <FollowersList followers={followers} pending={isPending} error={isError} retrying={isFetching} onRetry={() => void refetch()} hrefFor={anglerHref} />
  );

  if (breakpoint === 'mobile') {
    return (
      <Sheet open={open} onClose={onClose} title="Urmăritori" subtitle={subtitle} initialSnap={0.9}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title="Urmăritori" subtitle={subtitle} closeButton>
      <div className="-mx-5 max-h-[60dvh] overflow-y-auto px-5">{body}</div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Follow toggle                                                       */
/* ------------------------------------------------------------------ */

/** The follow button's width in every state (Urmărește / Urmăresc / Reîncearcă), so it never shifts. */
export const FOLLOW_MIN_W = 'min-w-36';

/** fish FollowButton debounce: presses within 200 ms make one toggle. */
const FOLLOW_DEBOUNCE_MS = 200;

export function FollowToggle({
  competition,
  viewer,
  statute,
  statutePending,
  overlayFailed = false,
  onRecheckOverlay,
  size = 'default',
}: {
  /** `compact` (36px) in the phone's badge row, so the state line stays a light row under the meta. */
  size?: ButtonSize;
  competition: CompetitionWithMyStatus;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  /** Signed in and the viewer's statute is still loading: the button is a bone (fish header skeleton). */
  statutePending: boolean;
  /**
   * Signed in, but the viewer's overlay (isFollowing) or statute could not be read: what the page
   * holds is the signed-out overlay, so the button never follows / unfollows on it — it offers to
   * check again instead.
   */
  overlayFailed?: boolean;
  /** Re-reads the overlay; resolves true when it answered. */
  onRecheckOverlay?: () => Promise<boolean>;
}) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const follow = useMutation(followCompetitionMutation(t, qc));
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const isAuthor = !!viewer && competition.author?.documentId === viewer.documentId;
  const isFollowing = competition.isFollowing || isAuthor;

  // Session not known yet, or the statute still loading: a bone of the button's size (nothing moves).
  if (viewer === undefined || statutePending) {
    return <span aria-hidden className={cn('block w-36 shrink-0 animate-shimmer rounded-control', size === 'compact' ? 'h-9' : 'h-12 xl:h-10')} />;
  }

  if (viewer && overlayFailed) {
    const recheck = async () => {
      if (rechecking || !onRecheckOverlay) return;
      setRechecking(true);
      const ok = await onRecheckOverlay().catch(() => false);
      setRechecking(false);
      if (!ok) toast(RECHECK_FAILED, 'danger');
    };
    // An honest label: pressing it only re-reads the state (the viewer may already follow). The
    // icon turns while it does; the minimum width is the follow button's, so nothing moves after.
    return (
      <Button
        variant="secondary"
        size={size}
        icon={<ArrowPathIcon className={cn(rechecking && 'animate-spin')} />}
        aria-busy={rechecking || undefined}
        disabled={rechecking}
        onClick={() => void recheck()}
        className={FOLLOW_MIN_W}
      >
        {rechecking ? 'Se verifică…' : 'Reîncearcă'}
        <span className="sr-only">: starea urmăririi nu a putut fi verificată</span>
      </Button>
    );
  }

  const act = () => {
    if (!viewer) {
      toast(SIGNED_OUT_MESSAGE, 'danger');
      return;
    }
    if (statute?.userRole === 'author' || statute?.userRole === 'referee' || competition.userRegistrationStatus === 'registered') {
      toast(ALREADY_IN_MESSAGE, 'success');
      return;
    }
    const next = !competition.isFollowing;
    // fish: warm the preference groups so the sheet opens filled.
    if (next) void prefetchCompetitionNotificationPreferences(qc, t, competition.documentId);
    follow.mutate(
      { competitionId: competition.documentId, follow: next },
      {
        onSuccess: () => {
          if (next) setPrefsOpen(true);
        },
        onError: error => toast(followErrorMessage(error), 'danger'),
        onSettled: () => void qc.invalidateQueries({ queryKey: competitionKeys.followers(competition.documentId) }),
      },
    );
  };

  const onPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(act, FOLLOW_DEBOUNCE_MS);
  };

  return (
    <>
      <Button
        // The call to action is tonal (Fundații §07 button sheet; on an upcoming competition
        // «Înscrie-te» stays the one filled action); once following it steps back to the quiet,
        // selected look — neutral ground, ink-2 label, the solid bell — so the two states differ at
        // a glance, not only by their label. Same width in both (FOLLOW_MIN_W).
        variant={isFollowing ? 'ghost' : 'secondary'}
        size={size}
        // fish FollowButton: the eye to start following, the ringing bell once following (parity shell.c7).
        icon={isFollowing ? <BellAlertSolidIcon /> : <EyeIcon />}
        className={cn(FOLLOW_MIN_W, isFollowing && 'bg-soft-fill')}
        aria-pressed={viewer ? isFollowing : undefined}
        aria-busy={follow.isPending || undefined}
        onClick={onPress}
      >
        {isFollowing ? 'Urmăresc' : 'Urmărește'}
      </Button>
      {viewer ? (
        // fish FollowNotificationsSheet `celebrate` (account.b.follow-celebrate): the shared panel.
        <PreferencesPanel
          key={competition.documentId}
          mode="celebrate"
          open={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          competitionId={competition.documentId}
          competitionName={competition.name}
        />
      ) : null}
    </>
  );
}
