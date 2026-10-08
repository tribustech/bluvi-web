'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowPathIcon, ExclamationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useBack } from '@/components/nav/useBack';
import { T4Gate } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { joinPartidaMutation, PARTIDA_JOIN_FALLBACK, PARTIDA_JOIN_MESSAGES, partidaJoinErrorMessage } from '@/core/partide';
import { routes } from '@/lib/routes';
import { useLivePartide } from '../../../_live';
import { JOIN_ACTIONS, JoinFrame } from './JoinFrame';

/** fish: an empty code never reaches the CMS. */
const EMPTY_CODE_MESSAGE = 'Cod invalid';

/**
 * The refusals a second press can change: a network / unknown failure (the fallback) and «Ai deja o
 * partidă în desfășurare» once the other one has ended. CODE_INVALID, ENDED and FULL are final for
 * this code — fish offers only «Înapoi» there, and so does the web.
 */
const RETRYABLE: ReadonlySet<string> = new Set([PARTIDA_JOIN_FALLBACK, PARTIDA_JOIN_MESSAGES['PARTIDA:ALREADY_ACTIVE']]);

type Phase = { kind: 'confirm' } | { kind: 'joining' } | { kind: 'error'; message: string; afterPress: boolean };

/*
 * /partide/intra/[cod] — fish app/(app)/partide/join/[code].tsx (parity partide.intra-cod).
 *
 * fish used to join on mount; it now asks first, so a code pasted into a group never enrolls
 * whoever opens the link (c2). «Alătură-te» → POST /feed/sessions/join (core joinPartidaMutation:
 * trimmed + uppercased) with one request in flight however fast it is pressed (c3); on success the
 * live pointer (fish activeSessionAtom ← { firestoreId, documentId }) is set through the Partide
 * live layer and the page REPLACES itself with /partide/[documentId] (Back skips the join). A
 * refusal shows fish's mapped message (core partidaJoinErrorMessage: CODE_INVALID, ENDED, FULL,
 * ALREADY_ACTIVE, else «Ceva n-a mers…») with «Verifică codul și încearcă din nou.» and «Înapoi»; only
 * the fallback and ALREADY_ACTIVE add «Reîncearcă» — the web's way to fish's reset single-flight
 * guard (c4); a final refusal (invalid / ended / full) does not invite the same press again. If the
 * angler leaves while the request is in flight, the join stands (the server accepted it) but the
 * page no longer navigates: the router is global and would pull them off wherever they went. An
 * empty code is «Cod invalid» at once, without a request. «Înapoi» / «Nu acum» go back, else to /partide (c5).
 * Writes: only the CMS (the projection mirrors the membership); Firestore is never written.
 */
export function JoinScreen({ cod }: { cod: string }) {
  const router = useRouter();
  const live = useLivePartide();
  const back = useBack(routes.partide());
  const code = cod.trim();
  const display = code.toUpperCase();
  const join = useMutation(joinPartidaMutation(live.transport));
  const [phase, setPhase] = useState<Phase>(() => (code ? { kind: 'confirm' } : { kind: 'error', message: EMPTY_CODE_MESSAGE, afterPress: false }));
  // One join in flight, however fast the button is pressed (fish's `attempted` ref).
  const inFlight = useRef(false);
  const { setActive } = live;
  const { mutateAsync } = join;
  // Still on screen when the answer lands? (Back while joining unmounts the page.)
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const confirm = useCallback(async () => {
    if (inFlight.current || !code) return;
    inFlight.current = true;
    setPhase({ kind: 'joining' });
    let documentId: string;
    try {
      const dto = await mutateAsync(code);
      documentId = dto.documentId;
      try {
        await setActive({ sessionId: dto.firestoreId, documentId });
      } catch {
        // The pointer is device state: the partidă page finds the session through the probe anyway.
      }
    } catch (error) {
      setPhase({
        kind: 'error',
        message: partidaJoinErrorMessage(error),
        afterPress: true,
      });
      // A refused or failed attempt may be retried.
      inFlight.current = false;
      return;
    }
    if (mounted.current) router.replace(routes.partida(documentId));
  }, [code, mutateAsync, setActive, router]);

  if (phase.kind === 'error') {
    const retry = code && RETRYABLE.has(phase.message) ? () => void confirm() : undefined;
    return <JoinErrorStep message={phase.message} afterPress={phase.afterPress} onBack={back} onRetry={retry} />;
  }

  if (phase.kind === 'joining') {
    return (
      <JoinFrame busy>
        {/* The confirm step's geometry (upper third below 768, the disc's slot for the spinner), so
            nothing jumps; white down to the screen's edge as the confirm step's bar is. */}
        <div
          className="flex flex-1 flex-col items-center px-2 py-8 text-center max-md:-mx-4 max-md:-mb-8 max-md:bg-surface max-md:pb-16 md:py-16"
          data-testid="partida-join-joining"
        >
          <span aria-hidden className="flex-1 md:hidden" />
          <div className="flex flex-col items-center gap-5">
            <span aria-hidden className="flex size-14 items-center justify-center">
              <ArrowPathIcon className="size-8 animate-spin text-accent motion-reduce:animate-none" />
            </span>
            <p role="status" className="t-body text-ink-2">
              Te conectăm la partidă…
            </p>
          </div>
          <span aria-hidden className="flex-2 md:hidden" />
        </div>
      </JoinFrame>
    );
  }

  return (
    <JoinFrame>
      <ConfirmBody code={display} />
      <div className={JOIN_ACTIONS}>
        <Button onClick={() => void confirm()} data-testid="partida-join-confirm">
          Alătură-te
        </Button>
        <Button variant="ghost" onClick={back}>
          Nu acum
        </Button>
      </div>
    </JoinFrame>
  );
}

/** The question, the code as a chip in it, and fish's consequence line. */
function ConfirmBody({ code }: { code: string }) {
  return (
    <div className="flex flex-1 flex-col items-center px-2 py-8 text-center md:pt-12 md:pb-4" data-testid="partida-join-confirm-step">
      <span aria-hidden className="flex-1 md:hidden" />
      <div className="flex max-w-md min-w-0 flex-col items-center gap-5">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          <UserGroupIcon className="size-6" />
        </span>
        <div className="flex max-w-full min-w-0 flex-col items-center gap-3">
          <h2 className="t-title2 text-balance text-ink">
            Intri în partida cu codul{' '}
            {/* The segment is user-controlled (a mistyped or forged link): a real 6-char code stays
                on one line, a long one wraps inside the chip instead of widening the page. */}
            <span className="inline-block max-w-full rounded-control bg-soft-fill px-2 font-mono tracking-[0.12em] break-all text-ink">{code}</span>?
          </h2>
          <p className="t-body text-pretty text-ink-2">Vei apărea ca participant, iar capturile pe care le adaugi intră în această partidă.</p>
        </div>
      </div>
      <span aria-hidden className="flex-2 md:hidden" />
    </div>
  );
}

function JoinErrorStep({ message, afterPress, onBack, onRetry }: { message: string; afterPress: boolean; onBack: () => void; onRetry?: () => void }) {
  // After a press the title takes focus (the pressed button is gone). The empty code is a direct
  // open: nothing moves.
  return (
    <JoinFrame variant="bare">
      <div data-testid="partida-join-error">
        <T4Gate
          tone="danger"
          icon={<ExclamationCircleIcon aria-hidden />}
          title={message}
          focusOnMount={afterPress}
          description={
            <span role="alert">
              <span className="sr-only">{message}. </span>
              Verifică codul și încearcă din nou.
            </span>
          }
          actions={
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row-reverse">
              <Button onClick={onBack}>Înapoi</Button>
              {onRetry ? (
                <Button variant="secondary" onClick={onRetry}>
                  Reîncearcă
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    </JoinFrame>
  );
}
