'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { DetailBackButton, DetailHeader, DetailShareButton, PRESENCE_ICON } from '@/components/templates/T3';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { FollowersPill, FollowToggle, type PageViewer } from './Follow';

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
  /** From 768, signed in: the chat action (ChatHeaderButton), between Urmărește and Distribuie. */
  chat?: ReactNode;
  /** Signed in, the viewer's overlay could not be read: the follow button only re-checks (Follow.tsx). */
  overlayFailed?: boolean;
  onRecheckOverlay?: () => Promise<boolean>;
};

export const TITLE_ID = 'concurs-titlu';

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
}: HeaderProps) {
  const toast = useSiteToast();
  const status = c.competitionStatus;
  const thumb = c.banner?.formats.small?.url ?? c.banner?.formats.medium?.url ?? c.banner?.url ?? '/images/competition-placeholder.jpg';
  const copied = () => toast('Linkul competiției a fost copiat.', 'success');
  const share = shareText(c);

  // fish: started → Live + urmăritori + Urmărește · notStarted → urmăritori + Urmărește ·
  // completed → urmăritori · draft → no badge row (parity shell.c3 / c4). The web also names the
  // other states (Viitor / Încheiat / Anulat, Fundații's StatusPill set, as CompetitionCard), so
  // every status row has the same anatomy as the live one: a state pill first. «Urmărește» is an
  // action (a Button): compact (36px) in the badge row on the phone, with the header's actions from 768.
  const followable = status === 'started' || status === 'notStarted';
  const follow = (size?: 'compact') => (
    <FollowToggle
      size={size}
      competition={c}
      viewer={viewer}
      statute={statute}
      statutePending={statutePending}
      overlayFailed={overlayFailed}
      onRecheckOverlay={onRecheckOverlay}
    />
  );
  const state =
    status === 'started' ? (
      <StatusPill tone="live">LIVE</StatusPill>
    ) : status === 'notStarted' ? (
      <StatusPill tone="info">Viitor</StatusPill>
    ) : status === 'completed' ? (
      <StatusPill tone="neutral">Încheiat</StatusPill>
    ) : status === 'cancelled' ? (
      <StatusPill tone="cancelled">Anulat</StatusPill>
    ) : null;
  const badges =
    status === 'started' || status === 'notStarted' || status === 'completed' || status === 'cancelled' ? (
      // One row, as fish: on the phone it may run under the back / share chips (it sits below them).
      // Phone: always the compact button's height (36), with or without it, so a completed page (no
      // Urmărește) is as tall as the skeleton and as a live one.
      <span className="flex flex-nowrap items-center gap-2.5 max-md:min-h-9">
        {state}
        {status !== 'cancelled' ? <FollowersPill competition={c} /> : null}
        {followable ? <span className="md:hidden">{follow('compact')}</span> : null}
      </span>
    ) : null;

  // DetailHeader's meta list: one dotted line from 768, stacked and centred on the phone. Before the
  // start the phone has the dates in the preview, so it shows them here once it has started.
  const meta = [
    <span key="author">Organizat de {c.author?.username || 'Necunoscut'}</span>,
    <LakeLink key="lake" competition={c} />,
    datesProse ? <span key="dates" className={cn(status === 'notStarted' && 'max-md:hidden')}>{datesProse}</span> : null,
  ];

  return (
    <DetailHeader
      phoneAlign="center"
      title={c.name}
      titleId={TITLE_ID}
      media={
        // Remote CMS banner at thumbnail size: the image optimizer buys nothing here. 768–1279 it is
        // 64px, so the title keeps its measure beside it and the labelled actions.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="size-16 rounded-card bg-soft-fill object-cover xl:size-24" decoding="async" />
      }
      meta={meta}
      badges={badges}
      // Urmărește, Înscrie-te before the start, and the kit share button (icon-only below 1280, as
      // the kit draws it): the cluster fits beside the title from 768.
      actions={
        <>
          {followable ? follow() : null}
          {status === 'notStarted' ? <RegisterAction competition={c} viewer={viewer} signIn={signIn} /> : null}
          {chat}
          <DetailShareButton look="button" title={c.name} text={share} label="Distribuie" onCopied={copied} />
        </>
      }
      // No list page yet (/concursuri): a direct visit goes back home.
      phoneStart={<DetailBackButton fallbackHref={routes.home()} />}
      phoneEnd={<DetailShareButton title={c.name} text={share} label="Distribuie competiția" onCopied={copied} />}
    />
  );
}

/**
 * fish: map-marker + lake name, opens the lake; «Nedefinit» when there is no lake (parity shell.c1 /
 * c2). The meta line's own type step (t-caption): only the ink says it is a link.
 */
function LakeLink({ competition }: { competition: CompetitionWithMyStatus }) {
  const pin = <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />;
  const cls = 'inline-flex min-w-0 items-center gap-1';
  if (!competition.lake?.documentId) {
    return (
      <span className={cls}>
        {pin}
        {competition.lake?.name || 'Nedefinit'}
      </span>
    );
  }
  return (
    <Link
      href={routes.lake(competition.lake.documentId)}
      className={cn(cls, 'text-accent-ink hover:underline')}
    >
      {pin}
      {competition.lake.name}
    </Link>
  );
}

/**
 * The action bar's «Înscrie-te» / «Modifică înscrierea» as a header button (fish RankingActionBar,
 * notStarted). Signed out it leads to sign-in; signed in it is disabled, as the phone tile:
 * registration is an app flow the web does not have yet (M5).
 */
function RegisterAction({ competition, viewer, signIn }: { competition: CompetitionWithMyStatus; viewer: PageViewer; signIn: string }) {
  const label = ['pending', 'registered'].includes(competition.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';
  const icon = <ClipboardDocumentListIcon />;
  if (viewer === null) {
    return (
      <ButtonLink href={signIn} icon={icon}>
        {label}
      </ButtonLink>
    );
  }
  return (
    <Button disabled icon={icon} title="Înscrierea se face din aplicația Bluvi.">
      {label}
    </Button>
  );
}
