'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, BellAlertIcon, ChevronDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { EyeIcon as EyeSolidIcon } from '@heroicons/react/20/solid';
import {
  competitionFollowersQuery,
  competitionKeys,
  competitionNotificationPreferencesQuery,
  followCompetitionMutation,
  groupState,
  mutedTypesOf,
  prefetchCompetitionNotificationPreferences,
  toggleGroup,
  toggleType,
  updateCompetitionNotificationPreferencesMutation,
  type CompetitionWithMyStatus,
  type NotificationPreferenceGroup,
} from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { isApiError } from '@/core/transport';
import { FilterSwitch } from '@/components/templates/T1';
import { PRESENCE_ICON } from '@/components/templates/T3';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Avatar } from '@/components/ui/Avatar';
import { Button, type ButtonSize } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { useSiteToast } from '../../../_shell/Toast';
import { pageTransport } from './transport';

/*
 * The header's follow cluster — fish CompetitionHeader `handleOnFollowCompetition`, FollowButton,
 * FollowersPill + FollowersListSheet and FollowNotificationsSheet (parity competition-page.shell
 * c5–c14). Fundații §07: a pill (radius 999) is a STATE; «Urmărește» is an action, so it is the kit
 * Button — the tonal `secondary` of the button sheet, in both states (the pressed state is said by
 * its label and aria-pressed: «Urmărește» → «Urmăresc», fish's eye → the ringing bell, outline 24
 * as every action, Fundații §05) — and the follower count (it opens the list) a text link with
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
  const { data: followers, isPending, isError, refetch } = useQuery({ ...competitionFollowersQuery(t, competitionId), enabled: open });
  const subtitle = followers ? `${followers.length} urmăresc` : undefined;

  const body = (
    <div className="flex flex-col">
      {isPending && !followers ? (
        // Fundații «se încarcă»: grey rows shaped like the list (avatar + name), not a spinner.
        <ul role="status" aria-label="Se încarcă urmăritorii" className="-mx-2 flex flex-col gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} aria-hidden className="flex min-h-12 items-center gap-3 px-2 py-1.5">
              <span className="size-10 shrink-0 animate-shimmer rounded-full" />
              <span className="h-3 w-2/5 animate-shimmer rounded-full" />
            </li>
          ))}
        </ul>
      ) : isError && !followers ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="t-body text-ink-2">Urmăritorii nu au putut fi încărcați.</p>
          <Button size="compact" variant="secondary" onClick={() => void refetch()}>
            Încearcă din nou
          </Button>
        </div>
      ) : followers && followers.length > 0 ? (
        <ul className="-mx-2 flex flex-col gap-1">
          {followers.map(f => (
            <li key={f.documentId}>
              <Link
                href={routes.angler(f.documentId)}
                className="flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                <SolidAvatar name={f.username} src={f.avatar?.url} />
                <span className="min-w-0 flex-1 truncate t-body text-ink">{f.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center t-body text-muted">Nu există urmăritori</p>
      )}
    </div>
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

/**
 * fish FollowersListSheet: the photo, or fish's indigo placeholder — the kit Avatar for both, so
 * shape and type come from one place (its indigo tone with the initials, so a list of people
 * without photos still tells them apart). 40px.
 * TODO(kit): a `solid` tone for components/ui/Avatar (ROADMAP §8 kit gaps) for fish's solid disc.
 */
function SolidAvatar({ name, src }: { name: string; src?: string | null }) {
  return <Avatar name={name} src={src} size={40} tone="indigo" />;
}

/* ------------------------------------------------------------------ */
/* Follow toggle                                                       */
/* ------------------------------------------------------------------ */

/** The follow button's width in every state (Urmărește / Urmăresc / Reîncearcă), so it never shifts. */
const FOLLOW_MIN_W = 'min-w-36';

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
        // Tonal in both states (Fundații §07 button sheet); on an upcoming competition «Înscrie-te»
        // stays the one filled action.
        variant="secondary"
        size={size}
        // fish FollowButton: the eye to start following, the ringing bell once following (parity shell.c7).
        icon={isFollowing ? <BellAlertIcon /> : <EyeIcon />}
        className={FOLLOW_MIN_W}
        aria-pressed={viewer ? isFollowing : undefined}
        aria-busy={follow.isPending || undefined}
        onClick={onPress}
      >
        {isFollowing ? 'Urmăresc' : 'Urmărește'}
      </Button>
      {viewer ? (
        <FollowPreferencesDialog
          open={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          competitionId={competition.documentId}
          competitionName={competition.name}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Post-follow notification preferences                                */
/* ------------------------------------------------------------------ */

/**
 * fish FollowNotificationsSheet (`celebrate`): «Te-ai abonat» (fish's emoji dropped, Fundații §05), the groups with switches, and
 * «Salvează». Not dismissable by a tap outside (fish renderNonDismissableBackdrop); only when the
 * groups could not be read does Escape / «Închide» let the angler go (fish: «… mai târziu din Setări»).
 */
function FollowPreferencesDialog({
  open,
  onClose,
  competitionId,
  competitionName,
}: {
  open: boolean;
  onClose: () => void;
  competitionId: string;
  competitionName: string;
}) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const { data, isPending, isError } = useQuery(competitionNotificationPreferencesQuery(t, competitionId, open));
  const update = useMutation(updateCompetitionNotificationPreferencesMutation(t, qc, competitionId));
  const [muted, setMuted] = useState<string[]>([]);
  // Re-sync on every open, so a closed-without-saving edit never shows the next time.
  const [synced, setSynced] = useState<object | null>(null);
  if (open && data && synced !== data) {
    setSynced(data);
    setMuted(mutedTypesOf(data));
  }
  if (!open && synced) setSynced(null);

  const save = async () => {
    try {
      await update.mutateAsync(muted);
      onClose();
    } catch {
      toast('Nu am putut salva preferințele. Te rugăm să încerci din nou.', 'danger');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (isError) onClose();
      }}
      title="Te-ai abonat"
      subtitle={competitionName}
      actions={
        isError ? (
          <Button variant="secondary" onClick={onClose}>
            Închide
          </Button>
        ) : (
          <Button onClick={() => void save()} disabled={!data || update.isPending} aria-busy={update.isPending || undefined}>
            {update.isPending ? 'Se salvează…' : 'Salvează'}
          </Button>
        )
      }
    >
      <p className="t-body text-ink-2">Alege ce notificări vrei să primești.</p>
      <div className="-mx-5 mt-2 max-h-[50dvh] overflow-y-auto px-5">
        {isPending && open ? (
          <div role="status" aria-label="Se încarcă notificările" className="flex flex-col gap-3 py-1">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} aria-hidden className="block h-11.5 animate-shimmer rounded-control" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-2 t-body text-muted">Nu am putut încărca notificările. Le poți seta mai târziu din Setări.</p>
        ) : (
          <ul className="flex flex-col">
            {data?.groups.map(group => (
              <PreferenceGroupRow
                key={group.key}
                group={group}
                muted={muted}
                onToggleGroup={(g, on) => setMuted(m => toggleGroup(m, g, on))}
                onToggleType={(key, on) => setMuted(m => toggleType(m, key, on))}
              />
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1 t-caption text-muted">Poți schimba oricând din clopoțelul din chat sau din Setări → Notificări.</p>
    </Dialog>
  );
}

/** fish PreferenceGroupRow: the group's switch (on / off / «parțial»), its types behind a disclosure. */
function PreferenceGroupRow({
  group,
  muted,
  onToggleGroup,
  onToggleType,
}: {
  group: NotificationPreferenceGroup;
  muted: string[];
  onToggleGroup: (group: NotificationPreferenceGroup, on: boolean) => void;
  onToggleType: (key: string, on: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const state = groupState(muted, group);
  return (
    <li className="flex flex-col border-b border-hairline py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        {group.types.length > 1 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Restrânge ${group.label}` : `Desfășoară ${group.label}`}
            onClick={() => setExpanded(v => !v)}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill"
          >
            <ChevronDownIcon aria-hidden className={cn('size-6 transition-transform duration-(--duration-fast)', expanded && 'rotate-180')} />
          </button>
        ) : (
          // Keeps every group's label on one line of alignment.
          <span aria-hidden className="size-10 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <FilterSwitch
            label={group.label}
            description={state === 'partial' ? 'parțial' : undefined}
            checked={state !== 'off'}
            onChange={on => onToggleGroup(group, on)}
          />
        </div>
      </div>
      {expanded ? (
        <ul className="flex flex-col gap-2 pt-2 pl-12">
          {group.types.map(type => (
            <li key={type.key}>
              <FilterSwitch label={type.label} checked={!muted.includes(type.key)} onChange={on => onToggleType(type.key, on)} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
