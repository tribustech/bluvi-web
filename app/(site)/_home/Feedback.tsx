'use client';

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { PhoneArrowUpRightIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useMutation } from '@tanstack/react-query';
import { sendFeedbackMutation, type FeedbackCategory } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { DashboardSection } from '@/components/templates/T5';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../_shell/Toast';
import { useViewerState } from '../_shell/viewer-context';
import { homeLinks } from './links';

/**
 * fish components/FeedbackSection.tsx — «Sugestii sau întrebări?» opens the feedback form
 * (FeedbackSheet). The emoji of the app copy and rating scale are dropped (Fundații: no emoji).
 * The T5 card at every width (fish's whole-card press becomes the card's one button), fish's copy,
 * one instance on Acasă — it lays itself out by its own width (a size container): the button
 * fills a phone-narrow card, sits beside the copy from a 576px card, under it in between.
 */
export function FeedbackSection({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Fills the height its row gives it (beside the app promo from 1280): the button sits on
          the card's bottom edge, on the promo's store buttons' line. */}
      <DashboardSection variant="card" title="Sugestii sau întrebări?" className={cn('h-full flex flex-col [&>:last-child]:flex [&>:last-child]:flex-1 [&>:last-child]:flex-col', className)}>
        <div className="@container flex flex-1 flex-col">
          {/* Never a field-wide bar beside the copy: its own width once the card has room. */}
          <div className="flex flex-1 flex-col gap-3 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-6">
            <p className="t-body text-muted">
              În caz că ai întâmpinat probleme, ai o idee nouă sau doar vrei să lași un mesaj echipei, scrie-ne aici.
            </p>
            <Button variant="secondary" className="mt-auto w-full shrink-0 @sm:w-auto @sm:self-start @xl:mt-0 @xl:self-auto" onClick={() => setOpen(true)} aria-haspopup="dialog">
              Scrie-ne
            </Button>
          </div>
        </div>
      </DashboardSection>
      {open ? (
        <Suspense fallback={null}>
          <FeedbackDialog onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}

const FEEDBACK_MAX = 500;

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

/**
 * fish components/FeedbackSheet.tsx — required rating 1–5 and category, optional details (500);
 * the CMS needs a session (guests are asked to sign in). Success closes the form with fish's
 * success toast; a failure keeps it open with fish's error toast.
 */
function FeedbackDialog({ onClose }: { onClose: () => void }) {
  // Only a known signed-out visitor is asked to sign in. An unknown session (a cookie whose read
  // failed) gets the form: the POST carries the cookie, and a dead one answers with the error toast.
  const signedOut = useViewerState() === null;
  const toast = useSiteToast();
  const t = useMemo(() => createBrowserTransport(), []);
  const send = useMutation(sendFeedbackMutation(t));
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<{ rating?: string; category?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      rating: rating ? undefined : 'Nota este obligatorie',
      category: category ? undefined : 'Te rugăm să selectezi o categorie',
    };
    setErrors(next);
    if (!rating || !category) return;
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
      {
        onSuccess: () => {
          toast('Feedback-ul tău a fost trimis cu succes!', 'success');
          onClose();
        },
        onError: () => toast('A apărut o problemă la trimiterea feedback-ului. Te rugăm să încerci mai târziu.', 'danger'),
      }
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="decision"
      title="Lasă-ne feedback"
      actions={
        signedOut ? (
          <ButtonLink href={homeLinks.signIn} block>
            Intră în cont
          </ButtonLink>
        ) : (
          <>
            <Button variant="danger" onClick={onClose}>
              Închide
            </Button>
            <Button type="submit" form="acasa-feedback-form" aria-disabled={send.isPending || undefined}>
              {send.isPending ? 'Se trimite…' : 'Trimite feedback'}
            </Button>
          </>
        )
      }
    >
      {signedOut ? (
        <p className="t-body text-ink-2">Intră în contul tău ca să ne poți trimite feedback.</p>
      ) : (
        <form
          id="acasa-feedback-form"
          onSubmit={(e) => (send.isPending ? e.preventDefault() : submit(e))}
          noValidate
          className="flex flex-col gap-5"
        >
          <fieldset className="flex flex-col gap-2" aria-describedby={errors.rating ? 'acasa-feedback-rating-error' : undefined}>
            <legend className="mb-2 t-heading">Acordă o notă experienței tale (1-5):</legend>
            {errors.rating ? (
              <p id="acasa-feedback-rating-error" role="alert" className="t-body-strong text-status-danger-fg">
                {errors.rating}
              </p>
            ) : null}
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className={cn(
                    'flex size-11 cursor-pointer items-center justify-center rounded-control t-heading has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                    rating === n ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink hover:bg-accent-tint'
                  )}
                >
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => {
                      setRating(n);
                      setErrors((x) => ({ ...x, rating: undefined }));
                    }}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
            <p className="min-h-5 t-body-strong text-muted">Experiență: {rating ? RATING_TEXT[rating] : ''}</p>
          </fieldset>
          <fieldset className="flex flex-col gap-2" aria-describedby={errors.category ? 'acasa-feedback-category-error' : undefined}>
            <legend className="mb-2 t-heading">Categorie:</legend>
            {errors.category ? (
              <p id="acasa-feedback-category-error" role="alert" className="t-body-strong text-status-danger-fg">
                {errors.category}
              </p>
            ) : null}
            {CATEGORIES.map((c) => (
              <label key={c.value} className="flex min-h-11 items-center gap-3 t-body">
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => {
                    setCategory(c.value);
                    setErrors((x) => ({ ...x, category: undefined }));
                  }}
                  className="size-5 accent-accent"
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <T4TextArea
            label="Detalii:"
            placeholder="Te rugăm să ne oferi mai multe detalii în legătură cu feedback-ul tău..."
            maxLength={FEEDBACK_MAX}
            value={text}
            // T4TextArea shows the counter but does not forward `maxLength` to the <textarea>: the cap
            // is enforced here (fish max 500).
            onChange={(e) => setText(e.target.value.slice(0, FEEDBACK_MAX))}
          />
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center gap-3 rounded-card bg-surface px-4.5 py-3 text-left text-ink shadow-e0 transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70"
      >
        <PhoneArrowUpRightIcon aria-hidden className="size-6 shrink-0" />
        <span className="t-body-strong">Contactează-ne</span>
      </button>
      <ResponsiveSurface open={open} onClose={() => setOpen(false)} intent="decision" title="Contact">
        <p className="t-body text-muted">Ai nevoie de ajutor sau ai întrebări? Suntem aici pentru tine!</p>
        <ul className="mt-2 flex flex-col">
          <li>
            <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent-ink hover:bg-soft-fill">
              <PhoneIcon aria-hidden className="size-6 shrink-0 text-ink" />
              {SUPPORT_PHONE}
            </a>
          </li>
          <li>
            <a href={`mailto:${SUPPORT_MAIL}`} className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent-ink hover:bg-soft-fill">
              <EnvelopeIcon aria-hidden className="size-6 shrink-0 text-ink" />
              {SUPPORT_MAIL}
            </a>
          </li>
        </ul>
      </ResponsiveSurface>
    </>
  );
}
