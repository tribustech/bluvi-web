'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CalendarDaysIcon, CheckCircleIcon, CheckIcon, MapPinIcon, ShareIcon } from '@heroicons/react/24/outline';
import { controlShell, Field } from '@/components/forms/Field';
import { TextInput } from '@/components/forms/TextInput';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { DetailProse } from '@/components/templates/T3';
import { T4Spinner } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildMapUrls,
  createLakeBookingInterestMutation,
  createLakeClaimMutation,
  LAKE_SHARE_DEFAULT_MESSAGE,
  lakeShareMessage,
  lakeShareText,
  type LakeBookingInterestSource,
  type LakeBookingState,
} from '@/core/lakes';
import type { RichTextNode } from '@/core/shared';
import { profileQuery } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import type { ViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import { track } from './analytics';

/*
 * The lake page's dialogs — fish's bottom sheets on [lakeId].tsx, on the surface Fundații §07 names
 * per width: a bottom sheet on the phone (as fish), a centred dialog with its «Închide» X from 768
 * (Surface below — the kit ResponsiveSurface has no non-alert modal intent yet). Each mounts on its
 * first opening and stays mounted, so an edited share message survives closing and reopening (fish
 * keeps the sheet mounted too).
 */

export type LakeDialog = 'share' | 'directions' | 'reviews-info' | 'description' | 'interest' | 'claim';

type DialogLake = {
  documentId: string;
  name: string;
  coordinates: { lat: string; long: string } | null;
  bookingState: LakeBookingState;
  description?: RichTextNode[] | null;
};

export function LakeDialogs({
  lake,
  session,
  whenSession,
  dialog,
  source,
  onOpen,
  onClose,
}: {
  lake: DialogLake;
  session: ViewerState | undefined;
  /** The session once the probe answers (LakeActions): a submit while it is out waits for it. */
  whenSession: () => Promise<ViewerState | undefined>;
  dialog: LakeDialog | null;
  source: LakeBookingInterestSource;
  onOpen: (d: LakeDialog, s?: LakeBookingInterestSource) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState<Set<LakeDialog>>(() => new Set());
  if (dialog && !mounted.has(dialog)) setMounted(new Set([...mounted, dialog]));
  const is = (d: LakeDialog) => dialog === d;
  return (
    <>
      {mounted.has('share') ? <ShareDialog lake={lake} open={is('share')} onClose={onClose} /> : null}
      {mounted.has('directions') ? <DirectionsDialog lake={lake} open={is('directions')} onClose={onClose} /> : null}
      {mounted.has('reviews-info') ? <ReviewsInfoDialog open={is('reviews-info')} onClose={onClose} /> : null}
      {mounted.has('description') && lake.description?.length ? (
        <Surface open={is('description')} onClose={onClose} title="Descriere" tall>
          <DetailProse blocks={lake.description} stripLeadingLabel="Descriere" className="pb-2" />
        </Surface>
      ) : null}
      {mounted.has('interest') ? (
        <InterestDialog
          lake={lake}
          session={session}
          whenSession={whenSession}
          source={source}
          open={is('interest')}
          onClose={onClose}
          onOwner={async () => {
            // The claim needs an account (lakes.claim.c7): signed in → the claim; otherwise sign in
            // first and come back to this lake with the claim open, exactly as the page's own
            // «Ești administratorul acestei bălți?» link (ClaimTrigger). A session not answered yet
            // is waited for — a signed-in angler never meets sign-in.
            const s = session !== undefined ? session : await whenSession();
            if (signedIn(s)) onOpen('claim');
            else router.push(routes.signIn(claimReturnPath(lake.documentId)));
          }}
        />
      ) : null}
      {mounted.has('claim') ? <ClaimDialog lake={lake} session={session} open={is('claim')} onClose={onClose} /> : null}
    </>
  );
}

/** Known to be signed in (callers wait for a pending session first; unknown is not signed in — rule 4). */
const signedIn = (s: ViewerState | undefined) => !!userOf(s);

/** `?dialog=revendica`: back from sign-in, the lake page opens the claim dialog (LakeActions ClaimAfterSignIn). */
export const CLAIM_PARAM = 'dialog';
export const CLAIM_VALUE = 'revendica';
export const claimReturnPath = (lakeId: string) => `${routes.lake(lakeId)}?${CLAIM_PARAM}=${CLAIM_VALUE}`;

/**
 * Fundații §07: a bottom sheet on the phone (fish's sheets), a centred dialog with its «Închide» X
 * from 768. The kit ResponsiveSurface maps its only modal intent («decision») to an alert dialog
 * without the X — right for a cancellation, wrong for these. TODO(kit): a non-alert modal intent
 * on ResponsiveSurface (closeButton, a `tall` snap, a scrollable body inside Dialog); then this
 * picker and its className reach into Dialog go.
 */
function Surface({
  open,
  onClose,
  title,
  subtitle,
  actions,
  tall = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Phone: open the sheet at 90% (a form, a long text) instead of 50%. */
  tall?: boolean;
  children: ReactNode;
}) {
  const phone = useBreakpoint() === 'mobile';
  return phone ? (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} footer={actions} initialSnap={tall ? 0.9 : 0.5}>
      {children}
    </Sheet>
  ) : (
    <Dialog open={open} onClose={onClose} title={title} subtitle={subtitle} actions={actions} closeButton className="max-h-[90dvh] [&>div:first-child]:overflow-y-auto">
      {children}
    </Dialog>
  );
}
const noSubscribe = () => () => {};

/* ------------------------------------------------------------------------------------------------
 * Distribuie balta — fish ShareLakeSheet (parity lakes.share)
 * ---------------------------------------------------------------------------------------------- */

function ShareDialog({ lake, open, onClose }: { lake: DialogLake; open: boolean; onClose: () => void }) {
  const toast = useSiteToast();
  const inputId = useId();
  // fish keeps the typed text in a ref (what Copiază / Distribuie send) and follows every keystroke
  // in the preview, committing again on blur (ShareLakeSheet handleChangeMessage, lakes.share.c2).
  const typed = useRef(LAKE_SHARE_DEFAULT_MESSAGE);
  const [preview, setPreview] = useState(LAKE_SHARE_DEFAULT_MESSAGE);
  // The link this page is served from (fish WEB_DOMAIN/lakes/:id; the web: absolute /balti/:id).
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => '');
  const url = `${origin}${routes.lake(lake.documentId)}`;
  const params = { lake_id: lake.documentId, lake_name: lake.name };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lakeShareText(typed.current, lake.name, url));
      toast('Mesaj copiat în clipboard', 'success');
      track('copy_lake_share_text', params);
    } catch {
      toast('Nu am putut copia mesajul.', 'danger');
    }
  };

  const share = async () => {
    const text = lakeShareText(typed.current, lake.name, url);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: lake.name, text });
        track('share_lake', params);
      } catch {
        // Dismissed: nothing was shared (fish only logs a completed share).
      }
    } else {
      // No system share (most desktop browsers): copy instead, and say so.
      await copy();
    }
    onClose();
  };

  return (
    <Surface
      open={open}
      onClose={onClose}
      title="Distribuie balta"
      tall
      actions={
        <div className="flex w-full gap-2 md:w-auto">
          <Button variant="outline" onClick={copy} className="flex-1 md:flex-none">
            Copiază
          </Button>
          <Button iconRight={<ShareIcon />} onClick={share} className="flex-1 md:flex-none">
            Distribuie
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {/* fish WhatsAppPreview: a chat with «Prieten», his question, the outgoing message. */}
        <figure aria-label="Previzualizare mesaj" className="overflow-hidden rounded-card bg-page shadow-e0">
          <figcaption className="flex items-center gap-2.5 bg-navy px-3.5 py-2.5 text-lavender">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-lavender-3 t-body-strong text-navy">
              P
            </span>
            <span className="t-body-strong">Prieten</span>
          </figcaption>
          <div className="flex flex-col gap-1.5 p-2.5">
            <p className="max-w-[75%] self-start rounded-control rounded-tl-none bg-surface px-2.5 py-1.5 shadow-e1">
              <span className="block t-caption text-ink">Salut! Ce faci sâmbătă? 🎣</span>
              <span className="block text-right t-micro text-ink-2">10:30</span>
            </p>
            <p className="max-w-[80%] self-end rounded-control rounded-tr-none bg-accent-tint px-2.5 py-1.5 shadow-e1" data-testid="share-preview">
              <span className="block t-caption whitespace-pre-line text-ink">{lakeShareMessage(preview, lake.name)}</span>
              <span className="mt-0.5 block t-caption break-all text-accent-ink">{url}</span>
              <span className="mt-0.5 flex items-center justify-end gap-1 t-micro text-ink-2">
                10:31
                <CheckIcon aria-hidden className="size-3" />
              </span>
            </p>
          </div>
        </figure>
        <TextInput
          id={inputId}
          label="Mesajul tău"
          defaultValue={LAKE_SHARE_DEFAULT_MESSAGE}
          onChange={e => {
            typed.current = e.target.value;
            setPreview(e.target.value);
          }}
          onBlur={() => setPreview(typed.current)}
        />
      </div>
    </Surface>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Direcții — fish NavigationSheet (parity lakes.detail.c31)
 * ---------------------------------------------------------------------------------------------- */

export function DirectionsDialog({ lake, open, onClose }: { lake: Pick<DialogLake, 'name' | 'coordinates'>; open: boolean; onClose: () => void }) {
  const urls = buildMapUrls(lake.coordinates);
  if (!urls) return null;
  // fish shows Apple Maps on iOS only; its https form opens the Maps app on Apple devices and the
  // web map elsewhere, so the web offers all three.
  const apps = [
    { key: 'google', label: 'Google Maps', href: urls.google },
    { key: 'waze', label: 'Waze', href: urls.waze },
    { key: 'apple', label: 'Apple Maps', href: urls.apple },
  ];
  return (
    <Surface open={open} onClose={onClose} title="Direcții" subtitle={`Navighează până la ${lake.name}`}>
      <ul className="grid grid-cols-3 gap-3 pt-2 pb-2">
        {apps.map(a => (
          <li key={a.key}>
            <a
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-col items-center gap-2 rounded-card p-3 text-center shadow-e0 transition-colors hover:bg-soft-fill"
            >
              <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent-tint-2 text-accent-ink [&>svg]:size-6">
                <MapPinIcon />
              </span>
              <span className="t-label text-ink">{a.label}</span>
              <span className="sr-only">(se deschide într-o filă nouă)</span>
            </a>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Cum funcționează recenziile — fish ReveiwsInfoSheet (parity lakes.detail.c26)
 * ---------------------------------------------------------------------------------------------- */

const REVIEW_CRITERIA: { title: string; points: string[] }[] = [
  { title: 'Pescuit', points: ['Cantitatea și diversitatea peștilor', 'Dimensiunea capturilor', 'Șansele reale de a prinde pește'] },
  {
    title: 'Facilități',
    points: ['Curățenie', 'Accesibilitate (drum, parcare, pontoane)', 'Dotări (toaletă, umbrire, locuri de campare, magazin cu momeală etc.)'],
  },
  {
    title: 'Atmosferă',
    points: [
      'Comportamentul personalului / administratorului',
      'Respectarea regulilor',
      'Calitatea mâncării',
      'Ambianța generală (liniște, siguranță, confort)',
    ],
  },
];

export function ReviewsInfoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Surface open={open} onClose={onClose} title="Cum funcționează recenziile">
      <div className="flex flex-col gap-4 pt-1 pb-2">
        {REVIEW_CRITERIA.map(c => (
          <section key={c.title} className="flex flex-col gap-1.5">
            <h3 className="t-heading">{c.title}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 t-body text-ink-2 marker:text-accent">
              {c.points.map(p => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Surface>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Rezervări prin Bluvi — fish LakeBookingInterestSheet (parity lakes.booking-interest)
 * ---------------------------------------------------------------------------------------------- */

function InterestDialog({
  lake,
  session,
  whenSession,
  source,
  open,
  onClose,
  onOwner,
}: {
  lake: DialogLake;
  session: ViewerState | undefined;
  whenSession: () => Promise<ViewerState | undefined>;
  source: LakeBookingInterestSource;
  open: boolean;
  onClose: () => void;
  onOwner: () => void;
}) {
  const toast = useSiteToast();
  const router = useRouter();
  const t = useMemo(() => createBrowserTransport(), []);
  const mutation = useMutation(createLakeBookingInterestMutation(t));
  const [registered, setRegistered] = useState(false);
  /** The session probe is still out: the submit waits for it (shown as sending). */
  const [waiting, setWaiting] = useState(false);
  const busy = mutation.isPending || waiting;

  // The registered state belongs to one lake (fish resets it when the lake changes).
  const [forLake, setForLake] = useState(lake.documentId);
  if (forLake !== lake.documentId) {
    setForLake(lake.documentId);
    setRegistered(false);
  }

  useEffect(() => {
    if (open) track('lake_booking_interest_sheet_viewed', { lake_id: lake.documentId, source });
  }, [open, lake.documentId, source]);

  const submit = async () => {
    if (busy || registered) return;
    // A session not answered yet is waited for (a signed-in angler never meets sign-in). A guest or
    // an unknown session (rule 4) signs in first: an anonymous signal 401s and cannot be told when
    // the lake opens up. Back to this lake afterwards (fish's plain push lands back here too).
    let s = session;
    if (s === undefined) {
      setWaiting(true);
      s = await whenSession();
      setWaiting(false);
    }
    if (!signedIn(s)) {
      onClose();
      router.push(routes.signIn(routes.lake(lake.documentId)));
      return;
    }
    mutation.mutate(
      { lakeId: lake.documentId, source },
      {
        onSuccess: result => {
          setRegistered(true);
          track('lake_booking_interest_submitted', { lake_id: lake.documentId, source, already_registered: result.alreadyRegistered });
          toast(
            result.alreadyRegistered
              ? 'Ne-ai spus deja — te anunțăm când balta acceptă rezervări.'
              : 'Am notat. Te anunțăm când balta acceptă rezervări.',
            'success',
          );
        },
        onError: () => toast('Nu am putut trimite. Încearcă din nou.', 'danger'),
      },
    );
  };

  return (
    <Surface
      open={open}
      onClose={onClose}
      title="Rezervări prin Bluvi"
      actions={
        <Button variant="ghost" onClick={onClose} className="max-md:w-full">
          Închide
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1 pb-2">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-tint-2 text-accent-ink [&>svg]:size-6">
            <CalendarDaysIcon />
          </span>
          <p className="t-body text-ink-2">{lake.name} nu acceptă încă rezervări prin Bluvi.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-card bg-page p-3.5">
          <p className="t-body-strong">Ești administratorul bălții?</p>
          <p className="t-caption text-muted">Ia legătura cu noi — îți putem crește numărul de rezervări.</p>
          <button
            type="button"
            onClick={() => {
              track('lake_booking_interest_owner_pressed', { lake_id: lake.documentId, source });
              onClose();
              onOwner();
            }}
            className="mt-1 self-start rounded-badge t-body-strong text-accent-ink underline-offset-2 hover:underline"
          >
            Contactează-ne
          </button>
        </div>
        {registered ? (
          <p role="status" className="flex items-start gap-2 rounded-card bg-status-success-bg p-3.5 t-body text-status-success-fg">
            <CheckCircleIcon aria-hidden className="size-6 shrink-0" />
            Am notat că ai vrea să rezervi aici. Te anunțăm când balta acceptă rezervări.
          </p>
        ) : (
          <Button
            block
            onClick={submit}
            icon={busy ? <T4Spinner /> : undefined}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            className={cn(busy && 'cursor-progress')}
          >
            {busy ? 'Se trimite…' : 'Aș vrea să pot rezerva aici'}
          </Button>
        )}
      </div>
    </Surface>
  );
}

// The stores (app/(site)/balti/[id]/partide reads them from here). TODO(routes): the same links as
// app/(site)/_home/AppPromo.tsx — lift both into lib/ once the shell owner agrees.
export const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

/* ------------------------------------------------------------------------------------------------
 * Ești administratorul acestei bălți? — fish LakeClaimSheet (parity lakes.claim)
 * ---------------------------------------------------------------------------------------------- */

const CLAIM_ERRORS: Record<string, string> = {
  CLAIM_EXISTS: 'Ai deja o cerere în așteptare pentru această baltă.',
  LAKE_HAS_OWNER: 'Balta are deja un administrator în Bluvi.',
};

function ClaimDialog({ lake, session, open, onClose }: { lake: DialogLake; session: ViewerState | undefined; open: boolean; onClose: () => void }) {
  const toast = useSiteToast();
  const t = useMemo(() => createBrowserTransport(), []);
  const signed = signedIn(session);
  const profile = useQuery(profileQuery(t, { isAuthenticated: signed }));
  const mutation = useMutation(createLakeClaimMutation(t));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const messageId = useId();
  const errorId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // fish prefills on present, only the fields still empty (the profile may load later).
  const p = profile.data;
  const [prefilled, setPrefilled] = useState(false);
  // Every presentation prefills again (fish onChange index >= 0), still only the empty fields.
  if (!open && prefilled) setPrefilled(false);
  if (open && p && !prefilled) {
    setPrefilled(true);
    setName(prev => prev || p.username || '');
    setPhone(prev => prev || p.phone || '');
  }

  const nameOk = name.trim().length >= 3;
  const phoneOk = phone.trim().length >= 9;
  const valid = nameOk && phoneOk;
  const busy = mutation.isPending;
  /** After a failed attempt: the field is marked invalid and points at the one message (c3). */
  const invalid = (ok: boolean) => (touched && !ok ? { 'aria-invalid': true as const, 'aria-describedby': errorId, className: INVALID_SHELL } : {});

  const submit = () => {
    if (busy) return;
    setTouched(true);
    if (!valid) {
      // Keyboard and screen reader users land on the first field to fix.
      (nameOk ? phoneRef : nameRef).current?.focus();
      return;
    }
    mutation.mutate(
      { lakeId: lake.documentId, name: name.trim(), phone: phone.trim(), message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast('Cerere trimisă — te contactăm noi.', 'success');
          onClose();
        },
        onError: e => {
          // The CMS names the case in `details.bluCode` (fish reads the message, which newer CMS
          // builds replaced with copy — the code is the stable part).
          const code = isApiError(e) ? e.bluCode : undefined;
          toast((code && CLAIM_ERRORS[code]) || 'Cererea nu a putut fi trimisă. Încearcă din nou.', 'danger');
        },
      },
    );
  };

  return (
    <Surface
      open={open}
      onClose={() => !busy && onClose()}
      title="Ești administratorul acestei bălți?"
      tall
      actions={
        <div className="flex w-full gap-2 md:w-auto">
          <Button variant="ghost" onClick={onClose} disabled={busy} className="max-md:flex-1">
            Înapoi
          </Button>
          <Button
            onClick={submit}
            icon={busy ? <T4Spinner /> : undefined}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            className={cn('max-md:flex-1', busy && 'cursor-progress')}
          >
            {busy ? 'Se trimite…' : 'Trimite cererea'}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4 pt-1 pb-2"
      >
        <p className="t-body text-ink-2">
          Spune-ne cine ești și te contactăm ca să preiei administrarea pentru {lake.name} în Bluvi.
        </p>
        <TextInput
          ref={nameRef}
          label="Nume și prenume"
          autoComplete="name"
          value={name}
          onChange={e => setName(e.target.value)}
          readOnly={busy}
          {...invalid(nameOk)}
        />
        <TextInput
          ref={phoneRef}
          label="Număr de telefon"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          readOnly={busy}
          {...invalid(phoneOk)}
        />
        <TextArea id={messageId} label="Mesaj (opțional)" value={message} onChange={setMessage} readOnly={busy} />
        {touched && !valid ? (
          <p id={errorId} role="alert" className="t-caption text-status-danger-fg">
            Numele și un număr de telefon valid sunt obligatorii.
          </p>
        ) : null}
        {/* Enter in a field submits (the dialog's own button is outside the form). */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Surface>
  );
}

/** The kit's error shell (controlShell(true)) on a field marked aria-invalid, without a second message under it. */
const INVALID_SHELL = '[&_div:has(>input[aria-invalid=true])]:border-live [&_div:has(>input[aria-invalid=true])]:bg-status-danger-bg/50';

/** A multi-line field on the kit's field shell. TODO(kit): a TextArea in components/forms. */
function TextArea({ id, label, value, onChange, readOnly }: { id: string; label: string; value: string; onChange: (v: string) => void; readOnly?: boolean }): ReactNode {
  return (
    <Field label={label} htmlFor={id} helperId={`${id}-help`}>
      <div className={cn(controlShell(false, false), 'h-auto py-2.5')}>
        <textarea
          id={id}
          rows={3}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
          className="t-body min-h-18 w-full resize-y bg-transparent text-ink outline-none placeholder:text-muted"
        />
      </div>
    </Field>
  );
}
