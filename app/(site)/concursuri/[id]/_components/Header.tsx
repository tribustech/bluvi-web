'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon, ClipboardDocumentListIcon, PhotoIcon, ShareIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon, EyeIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { competitionKeys, followCompetitionMutation, type CompetitionWithMyStatus } from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { pageTransport } from './transport';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import type { CompetitionDates } from './CompetitionScreen';

/*
 * fish components/competition/CompetitionHeader.tsx (+ BackButton, ShareButton, LivePlusViewers,
 * FollowersPill, FollowButton). Mobile is the app's centred header; desktop (design) puts the
 * banner on the left, the meta on one line and the bar's actions as header buttons.
 */

type HeaderProps = {
  competition: CompetitionWithMyStatus;
  viewer: Viewer | null;
  statute: UserStatuteForCompetition | undefined;
  signIn: string;
  onShare: () => void;
  toast: (message: string) => void;
};

/** fish headerIconSurface 'white': 36px, radius 12, soft chip, dark icon. */
const ICON_BUTTON =
  'flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-soft-fill text-ink transition-opacity duration-(--duration-fast) hover:opacity-80 active:opacity-60';

export function MobileHeader({ competition, viewer, statute, signIn, onShare, toast }: HeaderProps) {
  const router = useRouter();
  return (
    <header className="flex items-start gap-2 bg-surface p-2 md:hidden">
      <button
        type="button"
        aria-label="Înapoi"
        onClick={() => (window.history.length > 1 ? router.back() : router.push(routes.home()))}
        className={ICON_BUTTON}
      >
        <ChevronLeftIcon aria-hidden className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
        <h1 className="max-w-[95%] t-title1">{competition.name}</h1>
        <p className="t-caption text-muted">Organizat de {competition.author?.username || 'Necunoscut'}</p>
        <LakeLink competition={competition} />
        <Pills
          competition={competition}
          viewer={viewer}
          statute={statute}
          signIn={signIn}
          toast={toast}
          className="-mx-11 mt-2 justify-center"
        />
      </div>
      <button type="button" aria-label="Distribuie competiția" onClick={onShare} className={ICON_BUTTON}>
        <ShareIcon aria-hidden className="size-[19px]" />
      </button>
    </header>
  );
}

export function DesktopHeader({
  competition,
  viewer,
  statute,
  dates,
  signIn,
  onShare,
  onFullView,
  toast,
}: HeaderProps & { dates: CompetitionDates; onFullView?: () => void }) {
  const photo = competition.banner?.formats.small?.url ?? competition.banner?.formats.medium?.url ?? competition.banner?.url;
  return (
    <header className="hidden bg-surface px-6 pt-5.5 md:block xl:px-8">
      <div className="flex items-center gap-5">
        {/* Remote CMS banner at thumbnail size: the image optimizer buys nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo ?? '/images/competition-placeholder.jpg'}
          alt=""
          className="size-24 shrink-0 rounded-card bg-soft-fill object-cover"
          decoding="async"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="t-page-title">{competition.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 t-caption text-muted">
            <span>Organizat de {competition.author?.username || 'Necunoscut'}</span>
            <Dot />
            <LakeLink competition={competition} strong />
            {dates.label ? (
              <>
                <Dot />
                <span>{dates.label}</span>
              </>
            ) : null}
          </p>
          <Pills competition={competition} viewer={viewer} statute={statute} signIn={signIn} toast={toast} className="mt-1.5" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onFullView ? (
            <button type="button" onClick={onFullView} className={buttonClass({ variant: 'ghost', className: 'bg-soft-fill text-ink' })}>
              <PhotoIcon aria-hidden className="size-5" />
              Imagine clasament
            </button>
          ) : null}
          {competition.competitionStatus === 'notStarted' ? <RegisterAction competition={competition} viewer={viewer} signIn={signIn} /> : null}
          <button
            type="button"
            aria-label="Distribuie competiția"
            title="Distribuie competiția"
            onClick={onShare}
            className="flex size-12 items-center justify-center rounded-[12px] bg-soft-fill text-ink hover:opacity-80 xl:size-11"
          >
            <ShareIcon aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * The action bar's «Înscrie-te» / «Modifică înscrierea» as a header button (fish RankingActionBar,
 * notStarted). Signed out it leads to sign-in; signed in it is disabled, as the mobile tile:
 * registration is an app flow the web does not have yet.
 */
function RegisterAction({ competition, viewer, signIn }: Pick<HeaderProps, 'competition' | 'viewer' | 'signIn'>) {
  const label = ['pending', 'registered'].includes(competition.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';
  const icon = <ClipboardDocumentListIcon />;
  if (!viewer) {
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

function Dot() {
  return <span aria-hidden className="size-[3px] rounded-full bg-faint" />;
}

/** fish: map-marker + lake name, opens the lake. «Nedefinit» when there is no lake. */
function LakeLink({ competition, strong = false }: { competition: CompetitionWithMyStatus; strong?: boolean }) {
  const content = (
    <>
      <MapPinIcon aria-hidden className="size-3.5" />
      {competition.lake?.name || 'Nedefinit'}
    </>
  );
  const cls = cn('inline-flex items-center gap-1 t-caption text-accent', strong && 'font-bold');
  return competition.lake ? (
    <Link href={routes.lake(competition.lake.documentId)} className={cn(cls, 'hover:underline')}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}

/** fish header badges: started → Live + urmăritori + Urmărește · notStarted → urmăritori + Urmărește · completed → urmăritori. */
function Pills({
  competition,
  viewer,
  statute,
  signIn,
  toast,
  className,
}: Omit<HeaderProps, 'onShare'> & { className?: string }) {
  const status = competition.competitionStatus;
  if (status !== 'started' && status !== 'notStarted' && status !== 'completed') return null;
  return (
    <div className={cn('flex flex-nowrap items-center gap-1 whitespace-nowrap', className)}>
      {status === 'started' ? <StatusPill tone="live">Live</StatusPill> : null}
      {/* fish LivePlusViewers: dark pill, white eye + text (the kit StatusPill has no inverse tone). */}
      <span className="inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-full bg-ink-2 px-2.5 t-label whitespace-nowrap text-surface">
        <EyeIcon aria-hidden className="size-4" />
        {competition.viewers} {competition.viewers === 1 ? 'urmăritor' : 'urmăritori'}
      </span>
      {status !== 'completed' ? (
        <FollowToggle competition={competition} viewer={viewer} statute={statute} signIn={signIn} toast={toast} />
      ) : null}
    </div>
  );
}

/** fish CompetitionHeader `handleOnFollowCompetition` + FollowButton («Urmărește» / «Urmăresc»). */
function FollowToggle({
  competition,
  viewer,
  statute,
  signIn,
  toast,
}: Omit<HeaderProps, 'onShare'>) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const follow = useMutation(followCompetitionMutation(t, qc));
  const isFollowing = competition.isFollowing || (!!viewer && competition.author?.documentId === viewer.documentId);
  const look = cn(
    'inline-flex h-6.5 shrink-0 items-center gap-1 rounded-full px-2.5 t-label transition-colors duration-(--duration-fast)',
    isFollowing ? 'bg-accent-tint-2 text-accent-ink' : 'bg-accent text-on-accent hover:brightness-95',
  );
  const content = (
    <>
      {isFollowing ? <BellAlertIcon aria-hidden className="size-4" /> : <EyeIcon aria-hidden className="size-4" />}
      {isFollowing ? 'Urmăresc' : 'Urmărește'}
    </>
  );

  // fish shows «Intră în contul tău pentru a urmări competițiile live!»; the web sends you to sign in.
  if (!viewer) {
    return (
      <Link href={signIn} className={look}>
        {content}
      </Link>
    );
  }

  const onPress = () => {
    if (statute?.userRole === 'author' || statute?.userRole === 'referee' || competition.userRegistrationStatus === 'registered') {
      toast('Faci deja parte din această competiție și vei fi la curent cu toate evenimentele!');
      return;
    }
    follow.mutate(
      { competitionId: competition.documentId, follow: !competition.isFollowing },
      {
        // fish opens the notification-preferences sheet after a follow; not on the web yet.
        onError: error => toast(error.message),
        onSettled: () => void qc.invalidateQueries({ queryKey: competitionKeys.followers(competition.documentId) }),
      },
    );
  };

  return (
    <button type="button" aria-pressed={isFollowing} disabled={follow.isPending} onClick={onPress} className={cn(look, 'disabled:opacity-70')}>
      {content}
    </button>
  );
}

/** fish ROUTES_LIST. Only Clasament is on the web so far; the other tabs are shown, not linked. */
const DETAIL_TABS = ['Clasament', 'Informații', 'Participanți', 'Extra Cântare', 'Regulament'];

export function DetailTabs() {
  return (
    <nav aria-label="Secțiunile concursului" className="border-b border-hairline bg-surface md:px-6 xl:px-8">
      <ul className="flex overflow-x-auto [scrollbar-width:none]">
        {DETAIL_TABS.map((label, i) => (
          <li key={label} className="shrink-0">
            {i === 0 ? (
              <span
                aria-current="page"
                className="relative block px-3.5 py-3.5 t-body-strong text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent md:px-4.5"
              >
                {label}
              </span>
            ) : (
              <span aria-disabled="true" className="block px-3.5 py-3.5 t-body text-muted md:px-4.5 md:font-bold">
                {label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
