'use client';

import Link from 'next/link';
import { PlayIcon } from '@heroicons/react/20/solid';
import { CardHeader, PartidaCardShell, PhotoStrip, StatStrip } from '@/components/partide/community/card';
import { CardFooter, FOCUS } from '@/components/partide/community/parts';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fmtKg, fmtSpan, sessionVenueName, venueSubtitle, type Aggregate, type LocalSession } from '@/core/partide';
import { catchesNoun, partidaRange } from '@/lib/partide-community';
import { partideHrefs } from '@/lib/partide-pages';

/**
 * fish features/partide/components/card/OwnPartidaCard.tsx — cards E and F (mock 11a), YOUR partidă
 * (parity partide.ale-mele.c16): the venue is the title and the angler's name never appears (the
 * surface already says whose partidă it is). The venue's picture (a fish glyph without one), the
 * venue, «{localitate} · {stand}», capturi · kg total («—» while nothing is weighed: recordKg is
 * null exactly then) · durată («de pescuit» while it runs), the photo strip (a summary row has
 * none — fish aggForSession), the date range or «Începută acum …», a «Live» ribbon and a glow while
 * it runs, and the action: «Continuă partida» (a live card with `continuable`, fish onContinue),
 * «Vezi partida» (live) or «Vezi rezumatul». The whole card opens /partide/[documentId] — fish's
 * onOpen and onContinue go to the same screen — once the partidă page is on the web
 * (lib/partide-pages); until then it is plain, with no action.
 *
 * `now` is the shared clock (useNowTick): null on the server and while hydrating, when a running
 * card's duration and footer show nothing rather than a guess.
 */
export function OwnPartidaCard({
  session,
  agg,
  now,
  continuable = false,
}: {
  session: LocalSession;
  agg: Aggregate;
  now: number | null;
  /** fish `onContinue`: omitted on a profile — you cannot continue someone else's partidă. */
  continuable?: boolean;
}) {
  const href = session.serverId ? partideHrefs.partida(session.serverId) : null;
  const isLive = session.endedAt == null;
  const endedAt = session.endedAt ?? now;
  const span = endedAt == null ? '—' : fmtSpan(endedAt - session.startedAt);
  const stats = [
    { value: String(agg.captures), label: catchesNoun(agg.captures) },
    { value: agg.recordKg == null ? '—' : fmtKg(agg.totalKg), label: 'kg total', accent: true },
    { value: span, label: isLive ? 'de pescuit' : 'durată' },
  ];
  const footerLeft = isLive ? (
    now == null ? null : (
      <span data-visual-mask>Începută acum {fmtSpan(now - session.startedAt)}</span>
    )
  ) : (
    <time dateTime={new Date(session.startedAt).toISOString()}>
      {partidaRange(new Date(session.startedAt).toISOString(), new Date(session.endedAt as number).toISOString())}
    </time>
  );
  const venue = sessionVenueName(session);
  const continueHref = href && isLive && continuable ? href : null;
  const action = !href || continueHref ? null : isLive ? 'Vezi partida' : 'Vezi rezumatul';

  return (
    <div className={cn('flex rounded-card', isLive && 'shadow-glow')} data-testid={isLive ? 'own-card-live' : 'own-card'}>
      <div className="flex w-full [&>div]:w-full">
        <PartidaCardShell ribbon={isLive ? { variant: 'live', label: 'Live' } : undefined} interactive={!!href}>
          <CardHeader
            thumb={{ kind: 'image', url: session.lakeImageUrl ?? null }}
            title={venue}
            href={href}
            meta={{ text: venueSubtitle(session.locality, session.standName) || null }}
            ribbonClear={isLive}
          />
          <StatStrip stats={stats} />
          <PhotoStrip photos={agg.photos.map(p => ({ url: p.uri, thumbUrl: p.uri, weightKg: p.kg }))} total={agg.photos.length} />
          {continueHref ? (
            // fish CardFooter `kind: 'button'` (mock 11a): the filled indigo «Continuă partida» on the
            // right of the footer — its own target above the card's stretched link (same page).
            <footer className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
              <span className="min-w-0 flex-1 truncate t-caption text-muted">{footerLeft}</span>
              <Link
                href={continueHref}
                aria-label={`Continuă partida: ${venue}`}
                className={buttonClass({ size: 'compact', className: cn('relative z-above min-h-11 px-3.75 shadow-none', FOCUS) })}
                data-testid="continue-partida"
              >
                <PlayIcon aria-hidden className="size-3.5" />
                Continuă partida
              </Link>
            </footer>
          ) : (
            <CardFooter left={footerLeft} action={action} />
          )}
        </PartidaCardShell>
      </div>
    </div>
  );
}
