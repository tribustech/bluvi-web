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
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useViewer } from '../_shell/viewer-context';
import { TextArea } from './TextArea';
import { homeLinks } from './links';
import lakePhoto from './assets/lake-request.jpeg';

/**
 * fish components/LakeRequestBanner.tsx — «Nu găsești balta preferată?» over the lake photo.
 * Signed in: «Sugerează baltă» opens the suggestion form; signed out: an extra line and
 * «Intră în cont». The session streams in, so until it is known the button is the signed-in label
 * without an action. fish's shark Lottie is not ported. Desktop (design): shorter copy, pill button.
 */
export function LakeRequestBanner({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  const desktop = layout === 'desktop';
  return (
    <section
      aria-labelledby={`acasa-sugereaza-${layout}`}
      className={cn('relative isolate overflow-hidden shadow-glow', desktop ? 'rounded-[18px]' : 'rounded-card', className)}
    >
      <Image src={lakePhoto} alt="" fill sizes="(min-width: 1280px) 400px, 100vw" className="-z-20 object-cover" placeholder="blur" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-photo-scrim" />
      <div className={cn('flex h-full flex-col text-on-photo-scrim', desktop ? 'justify-between gap-[15px] p-[18px]' : 'gap-3 p-4')}>
        <div className={cn('flex flex-col', desktop ? 'gap-[5px]' : 'gap-3')}>
          <h2 id={`acasa-sugereaza-${layout}`} className="t-title1 xl:t-title2 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
            Nu găsești balta preferată?
          </h2>
          {desktop ? (
            <p className="max-w-[300px] t-caption opacity-90">Sugerează-ne o baltă care lipsește și o vom adăuga în aplicație.</p>
          ) : (
            <>
              <p className="t-body opacity-90">
                Sugerează-ne o baltă care lipseste și o vom adăuga în aplicație! Vom lua legatura cu administratorul bălții pentru a
                prealua detaliile actualizate.
              </p>
              <p className="t-body opacity-90">Îți vom trimite un mesaj după ce o adaugam.</p>
            </>
          )}
        </div>
        <Suspense fallback={<BannerButton desktop={desktop}>Sugerează baltă</BannerButton>}>
          <BannerAction desktop={desktop} />
        </Suspense>
      </div>
    </section>
  );
}

function BannerAction({ desktop }: { desktop: boolean }) {
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  if (!viewer) {
    return (
      <>
        {desktop ? null : <p className="t-body opacity-90">Pentru a putea sugera o baltă intră în contul tau.</p>}
        <BannerButton desktop={desktop} href={homeLinks.signIn}>
          Intră în cont
        </BannerButton>
      </>
    );
  }
  return (
    <>
      <BannerButton desktop={desktop} onClick={() => setOpen(true)}>
        Sugerează baltă
      </BannerButton>
      {open ? <LakeRequestDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BannerButton({ desktop, href, onClick, children }: { desktop: boolean; href?: string; onClick?: () => void; children: string }) {
  const cls = cn(
    'inline-flex items-center justify-center border-2 border-on-photo-scrim bg-photo-chip/90 t-body-strong text-ink',
    desktop ? 'self-start rounded-full px-[18px] py-2.5' : 'mt-2 self-end rounded-control px-5 py-2'
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={cls}>
      {children}
    </button>
  );
}

const DEBOUNCE_MS = 400;
const MAX_SEARCH_RESULTS = 4;

/** fish components/LakeRequestSheet.tsx — name (with «is this the lake?» matches), details, admin. */
function LakeRequestDialog({ onClose }: { onClose: () => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const send = useMutation(sendLakeSuggestionMutation(t));
  const [lakeName, setLakeName] = useState('');
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);

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
    setResult(null);
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
      { onSuccess: () => setResult('ok'), onError: () => setResult('fail') }
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="decision"
      title="Sugerează o baltă nouă"
      actions={
        result === 'ok' ? (
          <Button block onClick={close}>
            Închide
          </Button>
        ) : (
          <>
            <Button variant="danger" onClick={close}>
              Închide
            </Button>
            <Button type="submit" form="acasa-sugereaza-form" disabled={send.isPending}>
              {send.isPending ? 'Se trimite…' : 'Trimite cerere'}
            </Button>
          </>
        )
      }
    >
      {result === 'ok' ? (
        <p role="status" className="t-body text-ink-2">
          Cererea ta a fost trimisă cu succes!
        </p>
      ) : (
        <form id="acasa-sugereaza-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="t-body text-muted">
            Spune-ne despre balta pe care ai vrea să o vezi în aplicație. Dacă balta există deja, o vei putea găsi mai jos.
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
              <p className="t-body-strong text-accent">Aceasta este balta pe care o cauți?</p>
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
          <TextArea
            label="Detalii despre baltă"
            helper="Poți include detalii despre locație, facilități și orice altceva consideri important."
            placeholder="Detalii adiționale (opțional)..."
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <label className="flex items-center gap-3 t-body">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="size-5 accent-accent" />
            Ești administratorul bălții?
          </label>
          {result === 'fail' ? (
            <p role="alert" className="t-caption text-status-danger-fg">
              A apărut o problemă la trimiterea cererii. Te rugăm să încerci mai târziu.
            </p>
          ) : null}
        </form>
      )}
    </ResponsiveSurface>
  );
}
