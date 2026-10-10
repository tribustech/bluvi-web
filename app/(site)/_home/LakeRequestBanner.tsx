'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { lakesInfiniteQuery, sendLakeSuggestionMutation } from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { TextInput } from '@/components/forms/TextInput';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { FilterSwitch } from '@/components/templates/T1/Filters';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../_shell/Toast';
import { useViewerState } from '../_shell/viewer-context';
import { homeLinks } from './links';
import { BANNER, BANNER_ACTIONS, BANNER_COPY, BANNER_ROW, BANNER_TEXT, ON_DARK_FOCUS } from './PartidaCta';
import lakePhoto from './assets/lake-request.jpeg';

/**
 * fish components/LakeRequestBanner.tsx — «Nu găsești balta preferată?» over the lake photo.
 * Signed in: «Sugerează baltă» opens the suggestion form; signed out: an extra line and «Intră ca
 * să sugerezi» (what the sign-in unlocks, not a fourth bare «Intră în cont» on the page). The
 * session streams in, so until it is known the action is drawn without being one. fish's shark
 * Lottie is not ported. The banner spec is PartidaCta's (BANNER), at e1 — the glow is the hero's.
 * The photo's scrim carries the white text (no text shadow).
 *
 * One row of its own at every width, after the lakes rail (fish order, home.acasa.c58), with
 * fish's full copy; it lays out by the room of Acasă's main column (PartidaCta BANNER_ROW).
 * `layout="desktop"` (a narrow slot beside another card) keeps one paragraph: «Îți vom trimite un
 * mesaj…» moves into the form's intro, and signed out the button's label says what the sign-in
 * line said.
 */
export function LakeRequestBanner({ layout = 'mobile', className }: { layout?: 'mobile' | 'desktop'; className?: string }) {
  return (
    <section aria-labelledby={`acasa-sugereaza-${layout}`} className={cn(BANNER, BANNER_ROW, 'text-on-photo-scrim shadow-e1', className)}>
      <Image src={lakePhoto} alt="" fill sizes="(min-width: 1280px) 60vw, 100vw" className="z-backdrop object-cover" placeholder="blur" />
      <span aria-hidden className="absolute inset-0 z-behind bg-photo-scrim" />
      <div className={BANNER_TEXT}>
        <h2 id={`acasa-sugereaza-${layout}`} className="t-heading max-md:t-title1">
          Nu găsești balta preferată?
        </h2>
        <p className={BANNER_COPY}>
          Sugerează-ne o baltă care lipsește și o vom adăuga în aplicație! Vom lua legătura cu administratorul bălții pentru a
          prelua detaliile actualizate.
        </p>
        {layout === 'mobile' ? <p className={BANNER_COPY}>{WILL_MESSAGE}</p> : null}
        {layout === 'mobile' ? (
          <Suspense fallback={null}>
            <SignInLine />
          </Suspense>
        ) : null}
      </div>
      <Suspense
        fallback={
          <div className={cn(BANNER_ACTIONS, PHONE_ACTIONS)}>
            <span aria-hidden className={cn(buttonClass({ variant: 'outline' }), PHONE_BUTTON)}>
              Sugerează baltă
            </span>
          </div>
        }
      >
        <BannerAction />
      </Suspense>
    </section>
  );
}

/** Below 768 fish's action: at the right, a white (0.9) outlined button with black text, no accent. */
const PHONE_ACTIONS = 'max-md:flex max-md:justify-end';
const PHONE_BUTTON = 'max-md:border-surface max-md:bg-surface/90 max-md:px-5 max-md:text-ink';

const WILL_MESSAGE = 'Îți vom trimite un mesaj după ce o adăugăm.';

/** Signed out, the phone's extra line (fish): what the sign-in unlocks. */
function SignInLine() {
  return useViewerState() === null ? <p className={BANNER_COPY}>Pentru a putea sugera o baltă intră în contul tău.</p> : null;
}

function BannerAction() {
  // Only a known signed-out visitor gets the sign-in action; an unknown session (a cookie whose read
  // failed) keeps the real one — the request carries the cookie.
  const signedOut = useViewerState() === null;
  const [open, setOpen] = useState(false);
  if (signedOut) {
    return (
      <div className={cn(BANNER_ACTIONS, PHONE_ACTIONS)}>
        <ButtonLink href={homeLinks.signIn} variant="outline" className={cn(ON_DARK_FOCUS, PHONE_BUTTON)}>
          Intră ca să sugerezi
        </ButtonLink>
      </div>
    );
  }
  return (
    <>
      <div className={cn(BANNER_ACTIONS, PHONE_ACTIONS)}>
        <Button variant="outline" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(ON_DARK_FOCUS, PHONE_BUTTON)}>
          Sugerează baltă
        </Button>
      </div>
      {open ? <LakeRequestDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const DEBOUNCE_MS = 400;
const MAX_SEARCH_RESULTS = 4;
const MESSAGE_MAX = 1000;

/** fish components/LakeRequestSheet.tsx — name (with «is this the lake?» matches), details, admin. */
function LakeRequestDialog({ onClose }: { onClose: () => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const send = useMutation(sendLakeSuggestionMutation(t));
  const [lakeName, setLakeName] = useState('');
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const toast = useSiteToast();

  useEffect(() => {
    const trimmed = lakeName.trim();
    const id = setTimeout(() => setTerm(trimmed.length >= 2 ? trimmed : ''), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [lakeName]);

  const search = useInfiniteQuery({ ...lakesInfiniteQuery(t, { pageSize: MAX_SEARCH_RESULTS, search: term }), enabled: term.length >= 2 });
  const matches = term ? (search.data?.pages[0]?.data ?? []) : [];

  const close = () => {
    setLakeName('');
    setMessage('');
    setIsAdmin(false);
    setError(null);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!lakeName.trim()) {
      setError('Te rugăm să introduci numele bălții');
      return;
    }
    send.mutate(
      { lakeName, message: message || undefined, isAdmin, matchedLake: matches.length > 0 ? matches[0].documentId : null },
      {
        onSuccess: () => {
          toast('Cererea ta a fost trimisă cu succes!', 'success');
          close();
        },
        onError: () => toast('A apărut o problemă la trimiterea cererii. Te rugăm să încerci mai târziu.', 'danger'),
      }
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="decision"
      title="Sugerează o baltă nouă"
      actions={
        <>
          <Button variant="danger" onClick={close}>
            Închide
          </Button>
          <Button type="submit" form="acasa-sugereaza-form" aria-disabled={send.isPending || undefined}>
            {send.isPending ? 'Se trimite…' : 'Trimite cerere'}
          </Button>
        </>
      }
    >
      {
        <form id="acasa-sugereaza-form" onSubmit={(e) => (send.isPending ? e.preventDefault() : submit(e))} className="flex flex-col gap-4" noValidate>
          <p className="t-body text-muted">
            Spune-ne despre balta pe care ai vrea să o vezi în aplicație. Dacă balta există deja, o vei putea găsi mai jos.{' '}
            {WILL_MESSAGE}
          </p>
          <TextInput
            label="Numele bălții"
            placeholder="ex: Balta Mică, Lacul Verde..."
            maxLength={255}
            autoCapitalize="words"
            value={lakeName}
            onChange={(e) => {
              setLakeName(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
          />
          {matches.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="t-body-strong text-accent-ink">Aceasta este balta pe care o cauți?</p>
              <ul className="flex flex-wrap gap-2">
                {matches.map((l) => (
                  <li key={l.documentId}>
                    <Link href={routes.lake(l.documentId)} onClick={close} className="block rounded-control bg-soft-fill px-3 py-2 t-body-strong text-ink hover:bg-accent-tint">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <T4TextArea
            label="Detalii despre baltă"
            helper="Poți include detalii despre locație, facilități și orice altceva consideri important."
            placeholder="Detalii adiționale (opțional)..."
            maxLength={MESSAGE_MAX}
            value={message}
            // T4TextArea does not forward `maxLength` to the <textarea>: the cap (fish max 1000) is here.
            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          />
          {/* The kit switch (T1 FilterSwitch; TODO(kit): components/forms/Switch.tsx). */}
          <FilterSwitch label="Ești administratorul bălții?" checked={isAdmin} onChange={setIsAdmin} />
        </form>
      }
    </ResponsiveSurface>
  );
}
