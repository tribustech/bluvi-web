'use client';

import type { ReactNode } from 'react';
import { ShareIcon } from '@heroicons/react/24/outline';
import { DetailBackButton, headerChipClass } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * The member view's compact header (parity partide.partida.c1–c3; fish PartidaCompactHeader.tsx),
 * Revolut-clean: the back chip («Înapoi»), the venue as the <h1> on one line, the subtitle under
 * it, then the actions — a quiet red «Termină» chip (fish: the always-visible finish entry; only
 * the owner of a live, synced partidă) and the share chip («Distribuie partida»; only a public
 * partidă with a known documentId). From 1280 the actions move to the sticky summary column
 * (`actionsUntilXl`), so they are never shown twice. Part of the white band at the top; it never
 * floats (rule 3): it scrolls with the page, and only the tab strip under it sticks (from 768).
 */
export function PartidaHeader({
  name,
  subtitle,
  status,
  onShare,
  onFinish,
  actionsUntilXl = true,
}: {
  name: string;
  subtitle?: string;
  /** The live / ended pill, beside the subtitle from 768. */
  status?: ReactNode;
  onShare?: () => void;
  onFinish?: () => void;
  /** The actions sit in the summary column from 1280. */
  actionsUntilXl?: boolean;
}) {
  return (
    <div data-testid="partida-header" className="flex items-center gap-3 px-4 pt-3 pb-3.5 md:gap-4 md:px-6 md:pt-5 md:pb-5 xl:px-8">
      <DetailBackButton fallbackHref={routes.partide()} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate t-title2 md:t-title1" data-testid="partida-title">
          {name}
        </h1>
        {subtitle || status ? (
          <div className="flex min-w-0 items-center gap-2">
            {status ? <span className="shrink-0 max-md:hidden">{status}</span> : null}
            {subtitle ? (
              <p className="truncate t-body text-muted" data-testid="partida-subtitle">
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {onFinish || onShare ? (
        <div className={cn('flex shrink-0 items-center gap-2', actionsUntilXl && 'xl:hidden')}>
          {onFinish ? (
            <button
              type="button"
              onClick={onFinish}
              aria-label="Termină partida"
              data-testid="partida-finish"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-status-danger-bg px-4 t-label text-status-danger-fg hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Termină
            </button>
          ) : null}
          {onShare ? (
            <button type="button" onClick={onShare} aria-label="Distribuie partida" data-testid="partida-share" className={headerChipClass()}>
              <ShareIcon aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
