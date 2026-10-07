'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatBubbleLeftEllipsisIcon, ExclamationTriangleIcon, StarIcon } from '@heroicons/react/24/outline';
import { T4ActionBar, T4Frame, T4Gate, T4Header, T4Section, T4Spinner, T4TextArea, T4ChoiceCard, type T4Back } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { editReviewMutation, myLakeReviewQuery, postReviewMutation } from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { useBack } from '../../_sub/useBack';
import { refreshLakeAfterReview } from './actions';
import { LakeSummaryAside, type LakeSummary } from './LakeSummaryAside';
import { ReviewFormSkeleton } from './ReviewFormSkeleton';
import { COMMENT_MAX_LENGTH, commentError, DEFAULT_REVIEW_VALUES, reviewBody, valuesFromReview, type ReviewFormValues } from './schema';
import { StarRatingInput } from './StarRatingInput';
import { useKeyboardInset } from './useKeyboardInset';

/*
 * The review form — fish app/(app)/lakes/review/[lakeId].tsx + LakeReviewForms (AddReviewForm /
 * EditReviewForm / ReviewForm), parity lakes.review-form, on T4 (one step):
 *  - c1 «Adaugă o recenzie» / «Editează recenzia», the back control (fish goBackOrHome: back when the
 *    page before is the site's, else the lake's reviews);
 *  - c2 «Cum evaluezi această baltă?» and the three whole-star groups, 1–5, default 5;
 *  - c3 the comment and fish's three messages (shown after the first submit, then live, as
 *    react-hook-form's onSubmit / reValidate onChange); c4 «Recomand această baltă», on by default;
 *  - c5 the CTA: the title's words, a spinner and disabled while sending;
 *  - c6 add: POST with `booking` when opened from a completed booking (?rezervare=) — verified;
 *  - c7 edit (?editare=1): my review (spinner; «A apărut o eroare, te rugăm să încerci mai târziu»
 *    + a retry on failure), every field prefilled; c8 core editReviewMutation (optimistic my review,
 *    review pages, lake meta and lake lists; rollback on error) + the error toast;
 *  - c9 core invalidateReviewQueries on every write (reviews, the lake, my review, lakes lists,
 *    bookings to review) — React Query only; the lake page itself is static (cached reads tagged
 *    `lake-<id>`), so the write also runs refreshLakeAfterReview (updateTag, read-your-own-writes)
 *    and router.refresh() before leaving: the lake shows the new rating / count / latest reviews.
 * Web divergences (parity web_note): add while an own review exists → replaced by the edit mode
 * (fish's entry points never offer it, a typed / old link could, and the CMS refuses a second one);
 * edit with no review → replaced by the add mode, keeping ?rezervare= so the review stays verified
 * (fish would show an empty edit form whose PUT fails).
 * Success: the toast, then back to the page the visitor came from on this site, else the lake's
 * reviews (replace: the finished form is not left in history).
 * Layout: below 1280 one column, the header sticky under the top bar, the CTA pinned to the bottom
 * edge and lifted above the on-screen keyboard; from 1280 the lake card on the right, the CTA docked
 * under it.
 */

const FORM_ID = 'recenzie-form';
const TITLE_ID = 'recenzie-titlu';

const SCORES = [
  { key: 'quality', label: 'Pescuit' },
  { key: 'facilities', label: 'Facilități' },
  { key: 'atmosphere', label: 'Atmosferă' },
] as const;

type Props = {
  lakeId: string;
  editing: boolean;
  booking?: string;
  viewerId: string;
  /** null: the lake read failed — no summary, no eyebrow (owner rule 4). */
  lake: LakeSummary | null;
};

export function ReviewFormScreen({ lakeId, editing, booking, viewerId, lake }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const router = useRouter();
  const mine = useQuery(myLakeReviewQuery(t, lakeId, viewerId));
  // Set on a successful write: the refetch that follows must not re-route the form it is leaving.
  const [leaving, setLeaving] = useState(false);
  const goBack = useBack(routes.lakeReviews(lakeId));

  const title = editing ? 'Editează recenzia' : 'Adaugă o recenzie';
  const eyebrow = lake?.name;
  const back: T4Back = { label: 'Înapoi', onClick: goBack };
  const aside = lake ? <LakeSummaryAside lake={lake} /> : null;

  // Web divergences: the mode follows what exists (see the header).
  const wrongMode = mine.isSuccess && (editing ? !mine.data : Boolean(mine.data));
  useEffect(() => {
    if (!wrongMode || leaving) return;
    router.replace(routes.lakeReview(lakeId, editing ? { rezervare: booking } : { editare: true, rezervare: booking }));
  }, [wrongMode, leaving, editing, lakeId, booking, router]);

  if (mine.isPending || (wrongMode && !leaving)) {
    return <ReviewFormSkeleton title={title} eyebrow={eyebrow} back={back} aside={aside} primaryLabel={title} spinner={editing} />;
  }

  if (editing && mine.isError) {
    return (
      <T4Frame pageState label={title} header={<T4Header title={title} eyebrow={eyebrow} back={back} />}>
        <T4Gate
          tone="danger"
          role="alert"
          icon={<ExclamationTriangleIcon />}
          title="A apărut o eroare, te rugăm să încerci mai târziu"
          actions={
            <Button onClick={() => void mine.refetch()} disabled={mine.isFetching} aria-busy={mine.isFetching || undefined}>
              Încearcă din nou
            </Button>
          }
        />
      </T4Frame>
    );
  }

  // Add: the own-review read failed — fish shows the form regardless (the CMS refuses a duplicate).
  const review = editing ? (mine.data ?? null) : null;
  return (
    <ReviewForm
      key={review?.documentId ?? 'new'}
      lakeId={lakeId}
      editing={editing}
      booking={booking}
      initial={review ? valuesFromReview(review) : DEFAULT_REVIEW_VALUES}
      title={title}
      eyebrow={eyebrow}
      back={back}
      aside={aside}
      onDone={() => setLeaving(true)}
    />
  );
}

function ReviewForm({
  lakeId,
  editing,
  booking,
  initial,
  title,
  eyebrow,
  back,
  aside,
  onDone,
}: {
  lakeId: string;
  editing: boolean;
  booking?: string;
  initial: ReviewFormValues;
  title: string;
  eyebrow?: string;
  back: T4Back;
  aside: ReactNode;
  onDone: () => void;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const commentId = useId();
  const comment = useRef<HTMLTextAreaElement>(null);
  const [values, setValues] = useState<ReviewFormValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  const add = useMutation(postReviewMutation(t, qc, lakeId));
  const edit = useMutation(editReviewMutation(t, qc, lakeId));
  // Saved, the lake page being refreshed before leaving: still busy, never a second submit.
  const [finishing, setFinishing] = useState(false);
  const sending = add.isPending || edit.isPending || finishing;
  useKeyboardInset();

  const error = submitted ? commentError(values) : undefined;
  const set = <K extends keyof ReviewFormValues>(key: K, value: ReviewFormValues[K]) => setValues(v => ({ ...v, [key]: value }));

  const leave = () => {
    const prev = previousSitePath();
    if (prev) router.back();
    else router.replace(routes.lakeReviews(lakeId));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSubmitted(true);
    if (commentError(values)) {
      comment.current?.focus();
      return;
    }
    const callbacks = {
      onSuccess: async () => {
        setFinishing(true);
        onDone();
        toast(editing ? 'Recenzia a fost editată cu succes!' : 'Recenzia a fost adăugată cu succes!', 'success');
        // The lake page's static data (rating, count, latest reviews) — before leaving, so the page
        // the visitor lands on (or opens next) is rendered from fresh reads. A failure here only
        // leaves the CMS purge to catch up; the review itself is saved.
        try {
          await refreshLakeAfterReview(lakeId);
        } catch {
          /* the CMS tag purge follows anyway */
        }
        router.refresh();
        leave();
      },
      onError: (err: Error) => toast(err.message, 'danger'),
    };
    if (editing) edit.mutate({ body: reviewBody(values), lakeId }, callbacks);
    else add.mutate({ body: reviewBody(values, booking), lakeId }, callbacks);
  };

  return (
    <T4Frame
      label={title}
      header={<T4Header title={title} titleId={TITLE_ID} eyebrow={eyebrow} back={back} busy={sending} />}
      aside={aside ?? undefined}
      actions={
        <T4ActionBar
          className="bottom-[var(--review-kb-inset,0px)]"
          primary={
            <Button
              type="submit"
              form={FORM_ID}
              disabled={sending}
              aria-busy={sending || undefined}
              icon={sending ? <T4Spinner /> : undefined}
              data-testid="review-submit"
            >
              {title}
            </Button>
          }
        />
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} aria-labelledby={TITLE_ID} className="flex flex-col gap-4 md:gap-5">
        <T4Section title="Cum evaluezi această baltă?" icon={<StarIcon />}>
          <div className="flex flex-col divide-y divide-hairline md:grid md:grid-cols-3 md:gap-4 md:divide-y-0">
            {SCORES.map(s => (
              <div key={s.key} className="py-1.5 first:pt-0 last:pb-0 md:rounded-card md:bg-page md:px-2 md:py-4 md:first:pt-4 md:last:pb-4">
                <StarRatingInput name={s.key} label={s.label} value={values[s.key]} onChange={n => set(s.key, n)} disabled={sending} />
              </div>
            ))}
          </div>
        </T4Section>
        <T4Section title="Experiența ta" icon={<ChatBubbleLeftEllipsisIcon />}>
          <T4TextArea
            ref={comment}
            id={commentId}
            label="Comentariu"
            placeholder="Împărtășiți cu noi experiența dvs."
            value={values.comment}
            onChange={e => set('comment', e.currentTarget.value)}
            maxLength={COMMENT_MAX_LENGTH}
            error={error}
            disabled={sending}
            className="[&_textarea]:min-h-25"
            data-testid="review-comment"
          />
          <T4ChoiceCard
            type="checkbox"
            name="recommendToOthers"
            value="1"
            checked={values.recommendToOthers}
            onChange={on => set('recommendToOthers', on)}
            title="Recomand această baltă"
            disabled={sending}
          />
        </T4Section>
      </form>
    </T4Frame>
  );
}

/**
 * The page before this one, when it is the site's own and worth returning to (Navigation API: this
 * tab's same-origin entries only). Not /intra (signing in brought the visitor here) nor this form
 * itself (a mode switch). Without the API: none — the caller replaces with the reviews.
 */
function previousSitePath(): string | null {
  type Entry = { url: string | null; index: number };
  const nav = (window as unknown as { navigation?: { currentEntry?: Entry | null; entries?: () => Entry[] } }).navigation;
  const current = nav?.currentEntry;
  if (!nav?.entries || !current || current.index <= 0) return null;
  const prev = nav.entries()[current.index - 1];
  if (!prev?.url) return null;
  try {
    const url = new URL(prev.url);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname.startsWith('/intra') || url.pathname === window.location.pathname) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

