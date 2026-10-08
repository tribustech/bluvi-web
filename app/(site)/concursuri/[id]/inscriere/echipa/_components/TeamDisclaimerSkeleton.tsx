'use client';

import { useParams } from 'next/navigation';
import { T4ActionBar, T4Frame, T4Header, T4LineBar, type T4Back } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { FishermanArt } from '../../_form/FishermanArt';
import { cn } from '@/components/ui/cn';
import { ART, CARDS, COLUMN, RULE_CARD_FRAME } from './layout';

/**
 * The disclaimer while the session gate or the competition loads, and while a viewer who is sent
 * on to the registration form is being replaced (c6): the real header (title, back; a grey bar for
 * the competition's name), the illustration (static), grey intro lines, the two cards' shape and
 * the facts card from 1280 and the CTA disabled — the screen's own geometry (./layout), so nothing
 * moves when the data lands.
 * One sr-only status line announces it; the column is aria-busy.
 */
export function TeamDisclaimerSkeleton({ back, eyebrow }: { back?: T4Back; eyebrow?: string }) {
  const params = useParams<{ id?: string }>();
  const fallback: T4Back = {
    label: 'Înapoi',
    href: params?.id ? routes.competition(params.id) : routes.competitions(),
  };
  const cta = <Button disabled>Am înțeles</Button>;
  return (
    <>
      <p role="status" className="sr-only">
        Se încarcă…
      </p>
      <T4Frame
        busy
        label="Câteva lucruri de menționat"
        header={
          <T4Header
            title="Câteva lucruri de menționat"
            eyebrow={eyebrow ?? <T4LineBar type="t-eyebrow" className="w-40" />}
            back={back ?? fallback}
          />
        }
        aside={<FactsSkeleton />}
        actions={<T4ActionBar primary={cta} />}
      >
        <div className={COLUMN}>
          <FishermanArt className={ART} />
          <span aria-hidden className="flex w-full max-w-120 flex-col items-center md:items-start">
            <T4LineBar type="t-body" className="w-72 max-w-full" />
            <T4LineBar type="t-body" className="w-56 max-w-full" />
          </span>
          <div aria-hidden className={CARDS}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </T4Frame>
    </>
  );
}

/** One card (T4Section): the 40px disc and the h2, then the paragraph's lines. */
function CardSkeleton() {
  return (
    <div className={cn(RULE_CARD_FRAME, 'border-hairline')}>
      <span className="flex items-start gap-3">
        <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
        <span className="flex flex-1 flex-col pt-0.5">
          <T4LineBar type="t-heading" className="w-44" />
        </span>
      </span>
      <span className="flex flex-col">
        <T4LineBar type="t-body" className="w-full" />
        <T4LineBar type="t-body" className="w-full" />
        <T4LineBar type="t-body" className="w-3/4" />
      </span>
    </div>
  );
}

/** The facts card (T4Summary): the caps label and three label / value rows. */
function FactsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <T4LineBar type="t-eyebrow" className="w-28" />
      <span className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex justify-between gap-3">
            <T4LineBar type="t-body" className="w-16" />
            <T4LineBar type="t-body" className="w-32" />
          </span>
        ))}
      </span>
    </div>
  );
}
