'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { DashboardSection, LINK_ACTION } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';
import { CardSkeleton, RailArrows, RailRegistry, railListClass, type RailHandle, type RailWidth } from './HorizontalRail';

/**
 * A titled block of Acasă's main column — fish components/SeeAllTitle.tsx (title2 + «Vezi toate»)
 * on the T5 section (variant plain: t-title2 heading, the page's one text-link action, 12px to
 * the content). One heading step for every main-column section, at every width. The rail inside
 * registers with it (RailRegistry), and its mouse arrows sit in this header, before «Vezi toate».
 */
export function RailSection({
  title,
  href,
  linkLabel = 'Vezi toate',
  leading,
  children,
  className,
}: {
  title: string;
  /** «Vezi toate» target; no link when omitted (Sponsori). */
  href?: string;
  linkLabel?: string;
  /** Before the title (the live dot). Decorative. */
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [rail, setRail] = useState<RailHandle | null>(null);
  const link = href ? (
    // The T5 link action (44px target; -my-3 keeps the heading row at its text height).
    <Link href={href} aria-label={`${linkLabel}: ${title}`} className={cn(LINK_ACTION, '-my-3')}>
      {linkLabel}
    </Link>
  ) : null;
  return (
    <RailRegistry.Provider value={setRail}>
      <DashboardSection
        variant="plain"
        className={className}
        title={
          leading ? (
            <span className="flex items-center gap-2.5">
              {leading}
              {title}
            </span>
          ) : (
            title
          )
        }
        action={
          rail || link ? (
            <span className="flex items-center gap-3">
              {rail ? <RailArrows rail={rail} /> : null}
              {link}
            </span>
          ) : undefined
        }
      >
        {children}
      </DashboardSection>
    </RailRegistry.Provider>
  );
}

/** fish rails' loading state: three grey cards (moti Skeleton), at the cards' own height. */
export function RailSkeleton({ label, width, heightClass }: { label: string; width: RailWidth; heightClass: string }) {
  return (
    // The rail's own list layout (railListClass): the bones sit on the tracks the cards will take.
    <div role="status" aria-label={label} className={cn('-mb-3 overflow-hidden', railListClass(width))}>
      {[0, 1, 2].map((i) => (
        <CardSkeleton key={i} width={width} heightClass={heightClass} />
      ))}
    </div>
  );
}

/**
 * fish CompetitionCardsRail error: the message and a retry that refetches this rail only. One retry
 * at a time (the control stays focusable while it runs, clicks are ignored). When the retry works
 * this block unmounts with focus on its button: focus moves to the section's heading and the
 * recovery is announced, instead of dropping the reader at the top of the document.
 */
export function RailError({ onRetry, retrying = false }: { onRetry?: () => void; retrying?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    prepareAnnouncer();
    const heading = ref.current?.closest('section')?.querySelector<HTMLElement>('h2, h3');
    return () => {
      if (!asked.current) return;
      announce('Datele au fost reîncărcate.');
      restoreFocusTo(heading);
    };
  }, []);

  return (
    <div ref={ref} role="alert" className="flex flex-col items-start gap-3 rounded-card bg-surface p-4.5 shadow-e0">
      <p className="t-body text-ink-2">A apărut o eroare la încărcarea datelor.</p>
      {onRetry ? (
        <Button
          variant="secondary"
          onClick={() => {
            if (retrying) return;
            asked.current = true;
            onRetry();
          }}
          aria-disabled={retrying || undefined}
        >
          {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
        </Button>
      ) : null}
    </div>
  );
}

/** An empty rail's one line (fish ListEmptyComponent). */
export function RailEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-surface p-4.5 t-body text-ink-2 shadow-e0">{children}</p>;
}
