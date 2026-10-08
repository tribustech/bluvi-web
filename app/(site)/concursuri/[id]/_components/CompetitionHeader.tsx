'use client';

import { useId, type ReactNode } from 'react';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus, RegistrationAction } from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { DetailBackButton, DetailHeader, DetailShareButton } from '@/components/templates/T3';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { useSiteToast } from '../../../_shell/Toast';
import { ChatHeaderPlaceholder } from './ChatPanel';
import { CompetitionThumb, competitionMeta } from './headerMeta';
import { FollowersPill, FollowToggle, type PageViewer } from './Follow';
import { DisabledRegisterButton, registerState, ViewerSlot, type RegisterState } from './viewerSlot';
import { SHARE_MARK } from './analytics';

/*
 * fish components/competition/CompetitionHeader.tsx (+ BackButton, ShareButton, LivePlusViewers,
 * FollowersPill, FollowButton) on the T3 header (components/templates/T3/DetailHeader):
 *  - phone: the app's centred header — back chip, title, «Organizat de …», the lake, the pills,
 *    share chip;
 *  - from 768: the banner thumbnail, the title, one dotted meta line (organiser · lake · dates —
 *    DetailHeader's own list), the pills, and the actions (Urmărește, Înscrie-te before the start,
 *    Distribuie). «Clasament complet» belongs to the table: it is in the ranking toolbar.
 * Parity competition-page.shell c1–c8, c14, c21, c22.
 */

export type HeaderProps = {
  competition: CompetitionWithMyStatus;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  statutePending: boolean;
  /** «6–8 octombrie 2026» (sentence case, server-formatted). */
  datesProse: string;
  signIn: string;
  /**
   * From 768, signed in: the chat action (ChatHeaderButton), first in the cluster. While the
   * session is pending its place is a placeholder of its size; signed out (or unknown) 768–1279
   * keeps an empty box of that size, so the title column's measure never depends on how the
   * session resolves (a meta line wrapping one way and then the other moved the body by 20px, CLS).
   */
  chat?: (viewer: Viewer) => ReactNode;
  /** Signed in, the viewer's overlay could not be read: the follow button only re-checks (Follow.tsx). */
  overlayFailed?: boolean;
  onRecheckOverlay?: () => Promise<boolean>;
  /** fish's «Înscrie-te» rules (core registrationAction) for this viewer — a guest's too. */
  registration?: RegistrationAction | null;
  /** Where an offered registration goes: the form, or the team disclaimer (core registrationAction.target). */
  registrationHref?: string;
  /** From 768, a registered participant of a running competition: Extra-cântar (the phone has it in the bar). */
  extraAction?: ReactNode;
  /** From 768, the author while not completed: «Organizare» (the phone has it in the bar). */
  organizerAction?: ReactNode;
};

export const TITLE_ID = 'concurs-titlu';

/** A share control's wrapper: no box of its own, marked for share_competition (analytics.ts). */
export const SHARE_PROPS = { [SHARE_MARK]: '', className: 'contents' };

/** fish shareCompetition text (with the diacritics fish's copy leaves out, without its emoji: Fundații §05). */
export function shareText(c: Pick<CompetitionWithMyStatus, 'name' | 'lake'>): string {
  return `Intră în Bluvi să vezi competiția de pescuit ${c.name}${c.lake?.name ? ` de pe balta ${c.lake.name}` : ''}`;
}

export function CompetitionHeader({
  competition: c,
  viewer,
  statute,
  statutePending,
  datesProse,
  signIn,
  chat,
  overlayFailed,
  onRecheckOverlay,
  registration,
  registrationHref,
  extraAction,
  organizerAction,
}: HeaderProps) {
  const toast = useSiteToast();
  const status = c.competitionStatus;
  const copied = () => toast('Linkul competiției a fost copiat.', 'success');
  const share = shareText(c);

  // fish CompetitionHeader:125-139 (parity shell.c3 / c4): started → Live + urmăritori + Urmărește ·
  // notStarted → urmăritori + Urmărește · completed → urmăritori · draft / cancelled → no badge row.
  // Only the live state has a pill, as fish (the web's Viitor / Încheiat / Anulat pills were dropped:
  // fish wins, ROADMAP §1.3). «Urmărește» is an action (a Button): compact (36px) in the badge row on
  // the phone, with the header's actions from 768.
  const followable = status === 'started' || status === 'notStarted';
  // The per-viewer actions resolve on the server when they can (ViewerSlot): a request without a
  // session cookie streams the signed-out Urmărește with the page — no bone waiting for hydration.
  const follow = (size?: 'compact') => (
    <ViewerSlot viewer={viewer} fallback={<FollowBone size={size} />}>
      {(v) =>
        // Unknown session: the bone, as while pending (owner rule 4) — the shell re-reads it quietly.
        v === 'unknown' ? (
          <FollowBone size={size} />
        ) : (
          <FollowToggle
            size={size}
            competition={c}
            viewer={v}
            statute={statute}
            statutePending={statutePending}
            overlayFailed={overlayFailed}
            onRecheckOverlay={onRecheckOverlay}
          />
        )
      }
    </ViewerSlot>
  );
  const badges =
    status === 'started' || status === 'notStarted' || status === 'completed' ? (
      // One row, as fish: on the phone it may run under the back / share chips (it sits below them).
      // Phone: always the compact button's height (36), with or without it, so a completed page (no
      // Urmărește) is as tall as the skeleton and as a live one.
      <span className="flex flex-nowrap items-center gap-2.5 max-md:min-h-9">
        {status === 'started' ? <StatusPill tone="live">LIVE</StatusPill> : null}
        <FollowersPill competition={c} />
        {followable ? <span className="md:hidden">{follow('compact')}</span> : null}
      </span>
    ) : null;

  // DetailHeader's meta list: one dotted line from 768, stacked and centred on the phone. Before the
  // start the phone has the dates in the preview, so it shows them here once it has started. The
  // same list as the streaming fallback's (headerMeta.tsx).
  const meta = competitionMeta(c, datesProse);
  const reasonId = useId();
  const fallbackLabel = ['pending', 'registered'].includes(c.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';

  return (
    <DetailHeader
      phoneAlign="center"
      title={c.name}
      titleId={TITLE_ID}
      media={<CompetitionThumb competition={c} />}
      meta={meta}
      badges={badges}
      // Chat (signed in), Urmărește, Înscrie-te before the start, and the kit share button (icon-only below 1280, as
      // the kit draws it): the cluster fits beside the title from 768.
      actions={
        // The buttons in one row. Why «Înscrie-te» is closed sits centred under that button (its own
        // slot; the phone bar says it under its own button) — a disabled control's tooltip never
        // reaches touch or keyboard, and under the whole cluster it read as the share button's caption.
        <div className="flex items-start gap-2">
          {chat ? (
            <ViewerSlot viewer={viewer} fallback={<ChatHeaderPlaceholder />}>
              {(v) => (v === undefined ? <ChatHeaderPlaceholder /> : v && v !== 'unknown' ? chat(v) : <ChatSpacer />)}
            </ViewerSlot>
          ) : null}
          {followable ? follow() : null}
          {status === 'notStarted' ? (
            <ViewerSlot viewer={viewer} fallback={<RegisterBone />}>
              {(v) => {
                const st = registerState(v, registration, fallbackLabel);
                const reason = st.kind === 'disabled' || st.kind === 'unknown' ? st.reason : null;
                return (
                  <div className="flex flex-col items-center gap-1">
                    <RegisterAction state={st} signIn={signIn} href={registrationHref} reasonId={reasonId} />
                    {reason ? (
                      // The button's width (w-0 min-w-full): the reason wraps under it, never widens the slot.
                      <p id={reasonId} className="w-0 min-w-full text-center t-caption text-muted">
                        {reason}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            </ViewerSlot>
          ) : null}
          {organizerAction}
          {extraAction}
          <span {...SHARE_PROPS}>
            <DetailShareButton look="button" title={c.name} text={share} label="Distribuie" onCopied={copied} />
          </span>
        </div>
      }
      // No list page yet (/concursuri): a direct visit goes back home.
      phoneStart={<DetailBackButton fallbackHref={routes.home()} />}
      phoneEnd={
        <span {...SHARE_PROPS}>
          <DetailShareButton title={c.name} text={share} label="Distribuie competiția" onCopied={copied} />
        </span>
      }
    />
  );
}

/**
 * The action bar's «Înscrie-te» / «Modifică înscrierea» as a header button (fish RankingActionBar,
 * notStarted), on core registrationAction for every viewer: a guest is sent to sign in while it is
 * open; signed in and offered, it opens the registration form (or the team disclaimer); closed,
 * it is the focusable disabled button described by the visible reason under the header's actions.
 * While the session is pending: a bone of its size (never the guest's link).
 */
function RegisterAction({ state, signIn, href, reasonId }: { state: RegisterState; signIn: string; href?: string; reasonId: string }) {
  const icon = <ClipboardDocumentListIcon />;
  if (state.kind === 'pending') return <RegisterBone />;
  if (state.kind === 'signIn') {
    return (
      <ButtonLink href={signIn} icon={icon}>
        {state.label}
      </ButtonLink>
    );
  }
  if (state.kind === 'offered' && href) {
    return (
      <ButtonLink href={href} icon={icon}>
        {state.label}
      </ButtonLink>
    );
  }
  const reason = state.kind === 'disabled' || state.kind === 'unknown' ? state.reason : null;
  return <DisabledRegisterButton label={state.label} describedBy={reason ? reasonId : undefined} />;
}

/** «Înscrie-te» while the session is pending: its size, nothing readable. */
function RegisterBone() {
  return <span aria-hidden className="block h-12 w-36 shrink-0 animate-shimmer rounded-control xl:h-10" />;
}

/** The follow button's bone while the session is pending: its size, nothing readable. */
function FollowBone({ size }: { size?: 'compact' }) {
  return <span aria-hidden className={cn('block w-36 shrink-0 animate-shimmer rounded-control', size === 'compact' ? 'h-9' : 'h-12 xl:h-10')} />;
}

/** 768–1279, no chat: an empty box of the chat button's size (ChatHeaderPlaceholder), see `chat`. */
function ChatSpacer() {
  return <span aria-hidden className="block size-12 shrink-0 xl:hidden" />;
}
