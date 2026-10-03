'use client';

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { PhoneArrowUpRightIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useMutation } from '@tanstack/react-query';
import { sendFeedbackMutation, type FeedbackCategory } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useViewer } from '../_shell/viewer-context';
import { TextArea } from './TextArea';
import { homeLinks } from './links';

const CARD = 'flex w-full flex-col gap-1 rounded-control bg-surface p-2.5 text-left shadow-e1 transition-opacity hover:opacity-80';

/**
 * fish components/FeedbackSection.tsx — «Sugestii sau întrebări?» opens the feedback form
 * (FeedbackSheet). The emoji of the app copy and rating scale are dropped (Fundații: no emoji).
 * Desktop (design): the short copy in the right column.
 */
export function FeedbackSection({ layout }: { layout: 'mobile' | 'desktop' }) {
  const [open, setOpen] = useState(false);
  const desktop = layout === 'desktop';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(CARD, desktop && 'gap-0.5 rounded-[14px] px-3.5 py-3 shadow-none')}
        aria-haspopup="dialog"
      >
        <span className={desktop ? 't-body-strong' : 't-heading'}>Sugestii sau întrebări?</span>
        <span className={cn('text-muted', desktop ? 't-caption' : 't-body')}>
          {desktop
            ? 'Ai întâmpinat o problemă sau ai o idee? Scrie-ne aici.'
            : 'În caz că ai întâmpinat probleme, ai o idee nouă sau doar vrei sa lași un mesaj echipei, te rugăm să apeși aici.'}
        </span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <FeedbackDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}

// fish helpers/getEmojiByRatingScore.ts#getRatingText
const RATING_TEXT = ['', 'Nesatisfăcătoare', 'Slabă', 'Acceptabilă', 'Bună', 'Excelentă'];
const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'feature', label: 'Funcționalitate nouă' },
  { value: 'technical', label: 'Problemă tehnică' },
  { value: 'content', label: 'Conținut' },
  { value: 'account', label: 'Cont' },
  { value: 'ui', label: 'Interfață' },
  { value: 'other', label: 'Altele' },
];

/** fish components/FeedbackSheet.tsx — rating 1–5, category, details; the CMS needs a session. */
function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const viewer = useViewer();
  const t = useMemo(() => createBrowserTransport(), []);
  const send = useMutation(sendFeedbackMutation(t));
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<{ rating?: string; category?: string; text?: string }>({});
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      rating: rating ? undefined : 'Te rugăm să acorzi o notă',
      category: category ? undefined : 'Te rugăm să alegi o categorie',
      text: text.trim() ? undefined : 'Te rugăm să ne spui mai multe detalii',
    };
    setErrors(next);
    if (next.rating || next.category || next.text || !rating || !category) return;
    send.mutate(
      {
        rating,
        category,
        feedback: text,
        // fish helpers/feedbackMetadata.ts: the build + device envelope.
        metadata: {
          version: `v${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}`,
          environment: process.env.NODE_ENV,
          device: { os: 'web', userAgent: navigator.userAgent },
        },
      },
      { onSuccess: () => setResult('ok'), onError: () => setResult('fail') }
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="decision"
      title="Lasă-ne feedback"
      actions={
        !viewer ? (
          <ButtonLink href={homeLinks.signIn} block>
            Intră în cont
          </ButtonLink>
        ) : result === 'ok' ? (
          <Button block onClick={onClose}>
            Închide
          </Button>
        ) : (
          <>
            <Button variant="danger" onClick={onClose}>
              Închide
            </Button>
            <Button type="submit" form="acasa-feedback-form" disabled={send.isPending}>
              {send.isPending ? 'Se trimite…' : 'Trimite feedback'}
            </Button>
          </>
        )
      }
    >
      {!viewer ? (
        <p className="t-body text-ink-2">Intră în contul tău ca să ne poți trimite feedback.</p>
      ) : result === 'ok' ? (
        <p role="status" className="t-body text-ink-2">
          Feedback-ul tău a fost trimis cu succes!
        </p>
      ) : (
        <form id="acasa-feedback-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 t-heading">Acordă o notă experienței tale (1-5):</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className={cn(
                    'flex size-11 cursor-pointer items-center justify-center rounded-control t-heading has-focus-visible:outline-2 has-focus-visible:outline-accent',
                    rating === n ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink hover:bg-accent-tint'
                  )}
                >
                  <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
                  {n}
                </label>
              ))}
            </div>
            <p className="min-h-5 t-body text-muted">Experiență: {rating ? RATING_TEXT[rating] : ''}</p>
            {errors.rating ? (
              <p role="alert" className="t-caption text-status-danger-fg">
                {errors.rating}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 t-heading">Categorie:</legend>
            {CATEGORIES.map((c) => (
              <label key={c.value} className="flex items-center gap-3 t-body">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  className="size-5 accent-accent"
                />
                {c.label}
              </label>
            ))}
            {errors.category ? (
              <p role="alert" className="t-caption text-status-danger-fg">
                {errors.category}
              </p>
            ) : null}
          </fieldset>
          <TextArea
            label="Detalii"
            placeholder="Te rugăm să ne oferi mai multe detalii în legătură cu feedback-ul tău..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.text}
          />
          {result === 'fail' ? (
            <p role="alert" className="t-caption text-status-danger-fg">
              A apărut o problemă la trimiterea feedback-ului. Te rugăm să încerci mai târziu.
            </p>
          ) : null}
        </form>
      )}
    </ResponsiveSurface>
  );
}

// fish common/utils/constants.ts
const SUPPORT_PHONE = '+40 733 017 091';
const SUPPORT_MAIL = 'toni.radulescu@wearetribus.com';

/** fish components/Contact.tsx (variant «dashboard», signed out only) + ContactSheet.tsx. */
export function ContactCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(CARD, 'flex-row items-center gap-2')} aria-haspopup="dialog">
        <PhoneArrowUpRightIcon aria-hidden className="size-5 stroke-2" />
        <span className="t-body">Contactează-ne</span>
      </button>
      <ResponsiveSurface open={open} onClose={() => setOpen(false)} intent="decision" title="Contact">
        <p className="t-body text-muted">Ai nevoie de ajutor sau ai întrebări? Suntem aici pentru tine!</p>
        <ul className="mt-2 flex flex-col">
          <li>
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent hover:bg-soft-fill">
              <PhoneIcon aria-hidden className="size-5 text-ink" />
              {SUPPORT_PHONE}
            </a>
          </li>
          <li>
            <a href={`mailto:${SUPPORT_MAIL}`} className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent hover:bg-soft-fill">
              <EnvelopeIcon aria-hidden className="size-5 text-ink" />
              {SUPPORT_MAIL}
            </a>
          </li>
        </ul>
      </ResponsiveSurface>
    </>
  );
}
