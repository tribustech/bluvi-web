'use client';

import { useEffect, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon, ExclamationTriangleIcon, TicketIcon } from '@heroicons/react/24/outline';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { FlowActions, FlowConfirmation, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { FactTile } from '@/components/ui/BentoTile';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { isApiError } from '@/core/transport';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { routes } from '@/lib/routes';
import { raffleCopy } from '../../_shared/copy';
import { useRaffle } from '../../_shared/useRaffle';
import { chancesUnit, factLabel, receiptBreakdown, type ReceiptBreakdown } from './breakdown';

const C = raffleCopy.receiptSubmitted;
const TITLE_ID = 'bon-trimis-titlu';
const BREAKDOWN_ID = 'bon-trimis-detalii';

/**
 * The confirmation and its breakdown are one group, placed in the upper third of the task on a
 * phone (fish ScrollScreen: white from the header down to the action bar) by its own 1 : 2 spacers
 * — FlowConfirmation's spacers assume it is the whole step, so here it sits in a block (they
 * collapse) and the breakdown stays right under the message it explains. From 768 the task is a
 * card that hugs the group (no spacers). The skeleton uses the same frame, so nothing jumps.
 */
const GROUP_FRAME = 'flex flex-1 flex-col md:flex-none';
const SPACER_1 = 'flex-1 md:hidden';
const SPACER_2 = 'flex-2 md:hidden';
/** The breakdown as bento tiles: two to a row on a phone with the total across, three in a row from 768. */
const TILES = 'grid grid-cols-2 gap-3 md:grid-cols-3';
/** ≥1280 the bar docks as a card under the task (no aside here): same 720 frame as the task. */
const ACTIONS_FRAME = 'xl:mx-auto xl:w-full xl:max-w-180';

type Tone = 'lavender' | 'mint' | 'amber' | 'violet' | 'sky';

/**
 * fish goToDashboardSafely / BackButton: router.back() when the entry behind is a page of ours,
 * else home (replace — this page is not kept behind it). Used by both «back» controls, so the
 * header chevron and «Vezi șansele mele» mean the same thing.
 */
function useBackOrHome() {
  const router = useRouter();
  const href = routes.home();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (canGoBackInApp()) router.back();
    else router.replace(href);
  };
  return { href, onClick };
}

/** FlowHeader's back chip, with back-or-home behaviour; a real link to / without JS. */
function HeaderBack() {
  const { href, onClick } = useBackOrHome();
  return (
    <Link href={href} onClick={onClick} aria-label="Înapoi" className={headerChipClass()} data-testid="receipt-header-back">
      <ChevronLeftIcon aria-hidden />
    </Link>
  );
}

function Header() {
  return <FlowHeader title={C.title} id={TITLE_ID} backPlaceholder={<HeaderBack />} />;
}

/**
 * /tombola/bon-trimis «Bon încărcat» (fish app/(app)/raffle/receipt-submitted.tsx; parity
 * participant.raffle-receipt-submitted, T6). Reached only from /tombola/bon after a successful
 * upload (c1). The gate (proxy + requireViewer) already sent signed-out visitors to sign-in; the
 * participation is per viewer, read through /api/cms (useRaffle).
 *
 * Unknown → the neutral skeleton or the retry gate (owner rule 4), never a breakdown for «we could
 * not check». Not in the raffle (or no session): nothing to confirm — hand over to the intro
 * (/tombola), as the confirmation does; fish would render the page with 0 chances.
 */
export function ReceiptSubmittedScreen() {
  const raffle = useRaffle();
  const router = useRouter();
  const dead = isApiError(raffle.error) && raffle.error.code === 'SESSION_DEAD';
  const leave = raffle.hasData && !dead && !raffle.state.joined && !raffle.retrying;
  useEffect(() => {
    if (leave) router.replace(routes.raffle());
  }, [leave, router]);

  if (dead) return <ReceiptSubmittedSkeleton />;
  if (!raffle.hasData) {
    if (raffle.status === 'error') return <LoadError retrying={raffle.retrying} onRetry={raffle.retry} />;
    return <ReceiptSubmittedSkeleton />;
  }
  if (!raffle.state.joined) return <ReceiptSubmittedSkeleton />;
  return <Content b={receiptBreakdown(raffle.state)} />;
}

function Content({ b }: { b: ReceiptBreakdown }) {
  const bonusTone: Tone = b.bonusPending ? 'amber' : b.bonus > 0 ? 'mint' : 'violet';
  return (
    <FlowLayout
      header={<Header />}
      labelledBy={TITLE_ID}
      fill
      narrow
      actions={
        // c4 — back to where the viewer came from, else home; T6's thumb-zone bar.
        <div className={ACTIONS_FRAME}>
          <FlowActions primary={<BackOrHome>{C.goToStatus}</BackOrHome>} />
        </div>
      }
    >
      <div className={GROUP_FRAME} data-testid="receipt-submitted" data-state={b.approved ? 'approved' : 'verifying'}>
        <span aria-hidden className={SPACER_1} />
        <div className="flex flex-col gap-6">
          {/* c2 — the green check and the status line. In a block: its own spacers collapse. */}
          <div>
            <FlowConfirmation
              label={`${C.title}. ${b.message}`}
              value={
                <p className="t-title2 max-w-md text-balance text-ink" data-testid="receipt-message">
                  {b.message}
                </p>
              }
            />
          </div>

          {/* c3 — «Detalii șanse», right under the line it explains. */}
          <section aria-labelledby={BREAKDOWN_ID} className="flex flex-col gap-3">
            <h2 id={BREAKDOWN_ID} className="t-heading text-ink">
              {C.entryBreakdown}
            </h2>
            <ul className={TILES} data-testid="receipt-breakdown">
              <Fact label={C.previous} value={b.previous} tone="lavender" testId="receipt-previous" />
              <Fact label={b.bonusLabel} value={b.bonus} tone={bonusTone} testId="receipt-bonus" />
              <Fact label={C.total} value={b.total} tone="sky" testId="receipt-total" className="col-span-2 md:col-span-1" />
            </ul>
          </section>
        </div>
        <span aria-hidden className={SPACER_2} />
      </div>
    </FlowLayout>
  );
}

function Fact({ label, value, tone, testId, className }: { label: string; value: number; tone: Tone; testId: string; className?: string }) {
  return (
    <li className={cn('flex', className)} data-testid={testId}>
      {/* One phrase for a screen reader («Total: 3 șanse»); the tile is its visual form. */}
      <span className="sr-only">{factLabel(label, value)}</span>
      <div aria-hidden className="flex w-full">
        <FactTile
          label={label}
          value={
            <span className="tabular-nums" data-value>
              {value}
            </span>
          }
          unit={chancesUnit(value)}
          tone={tone}
          className="min-h-24 w-full"
        />
      </div>
    </li>
  );
}

/** «Vezi șansele mele»: back or home (useBackOrHome); a real link to home for modified clicks. */
function BackOrHome({ children }: { children: ReactNode }) {
  const { href, onClick } = useBackOrHome();
  return (
    <ButtonLink href={href} onClick={onClick} icon={<TicketIcon />} className="w-full" data-testid="receipt-go-status">
      {children}
    </ButtonLink>
  );
}

function LoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <FlowLayout header={<Header />} variant="bare" narrow>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Nu am putut încărca tombola"
        description="Verifică conexiunea și încearcă din nou."
        actions={
          <Button onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </FlowLayout>
  );
}

/**
 * Loading (rule 4): the real header, then the same frame as the loaded page — the group between
 * the 1 : 2 spacers (FlowConfirmation's py-8 / md:py-12 around the disc and line), the tiles, and
 * the action bar — in neutral grey, so the disc, line, tiles and CTA appear where they will be.
 */
export function ReceiptSubmittedSkeleton() {
  const shimmer = 'block bg-soft-fill animate-shimmer';
  return (
    <FlowLayout
      header={<Header />}
      labelledBy={TITLE_ID}
      fill
      narrow
      busy
      actions={
        <div aria-hidden className={ACTIONS_FRAME}>
          <FlowActions primary={<span className={cn(shimmer, 'h-12 w-full rounded-control md:min-w-52')} />} />
        </div>
      }
    >
      <FlowLoadingStatus />
      <div aria-hidden className={GROUP_FRAME} data-testid="receipt-submitted-skeleton">
        <span className={SPACER_1} />
        <div className="flex flex-col gap-6">
          {/* FlowConfirmation's box: px-2 py-8 (md:py-12), disc 56, gap 24, the title2 line (22). */}
          <div className="flex flex-col items-center gap-6 px-2 py-8 md:py-12">
            <span className={cn(shimmer, 'size-14 rounded-full')} />
            <span className="flex h-5.5 w-full items-center justify-center">
              <span className={cn(shimmer, 'h-5 w-64 max-w-full rounded-full')} />
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="flex h-5.5 items-center">
              <span className={cn(shimmer, 'h-5 w-32 rounded-full')} />
            </span>
            <div className={TILES}>
              <span className={cn(shimmer, 'h-24 rounded-bento')} />
              <span className={cn(shimmer, 'h-24 rounded-bento')} />
              <span className={cn(shimmer, 'col-span-2 h-24 rounded-bento md:col-span-1')} />
            </div>
          </div>
        </div>
        <span className={SPACER_2} />
      </div>
    </FlowLayout>
  );
}
