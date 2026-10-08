import { LockClosedIcon, LockOpenIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { revisionDateTime, type RevisionCatchLine, type RevisionEntry, type RevisionSession } from './model';

/*
 * One reopen/close round of a weighing (fish components/scale/RevisionCard.tsx): fish's dashed indigo
 * card (accent tint, 1px dashed accent edge), «Modificarea {sesiune} [de {utilizator}]» in accent,
 * then the round as a small timeline — a lock-open disc for the reopen («Motiv: …», «Redeschis la
 * …»), a lock disc for the close («Închis la …») with the catches added (green) and removed (red)
 * as «• specie X kg». From 768 the two lists sit side by side (fish XStack space-between).
 */

export function RevisionCard({ session, index }: { session: RevisionSession; index: number }) {
  const id = `modificare-${index}`;
  return (
    <article
      aria-labelledby={id}
      data-testid="revision-card"
      className="flex flex-col gap-3 rounded-card border border-dashed border-accent bg-accent-tint px-4 py-3 md:gap-4 md:px-5 md:py-4"
    >
      <h2 id={id} className="t-heading text-accent-ink">
        {session.title}
      </h2>
      <ol className="flex flex-col">
        {session.entries.map((entry, i) => (
          <Entry key={entry.key} entry={entry} last={i === session.entries.length - 1} />
        ))}
      </ol>
    </article>
  );
}

function Entry({ entry, last }: { entry: RevisionEntry; last: boolean }) {
  const reopen = entry.kind === 'reopen';
  const Icon = reopen ? LockOpenIcon : LockClosedIcon;
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0" data-testid={`revision-${entry.kind}`}>
      {/* The rail: a 32px disc, and a line down to the next entry's disc. */}
      {!last ? <span aria-hidden className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-accent/40" /> : null}
      <span
        aria-hidden
        className={cn(
          'relative flex size-8 shrink-0 items-center justify-center rounded-full',
          reopen ? 'bg-surface text-accent-ink ring-1 ring-accent' : 'bg-accent text-on-accent',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        {entry.kind === 'reopen' ? (
          <>
            {entry.reason ? (
              <p className="t-body-strong break-words text-ink" data-testid="revision-reason">
                Motiv: {entry.reason}
              </p>
            ) : null}
            <p className="t-caption text-ink-2">
              Redeschis la <time dateTime={entry.at}>{revisionDateTime(entry.at)}</time>
            </p>
          </>
        ) : (
          <>
            <p className="t-body-strong text-ink">
              Închis la <time dateTime={entry.at}>{revisionDateTime(entry.at)}</time>
            </p>
            {entry.added.length > 0 || entry.removed.length > 0 ? (
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {entry.added.length > 0 ? <CatchList tone="added" items={entry.added} /> : null}
                {entry.removed.length > 0 ? <CatchList tone="removed" items={entry.removed} /> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

const TONE = {
  added: { label: 'Adăugat:', box: 'bg-status-success-bg text-status-success-fg', Icon: PlusIcon },
  removed: { label: 'Șters:', box: 'bg-status-danger-bg text-status-danger-fg', Icon: MinusIcon },
} as const;

function CatchList({ tone, items }: { tone: keyof typeof TONE; items: RevisionCatchLine[] }) {
  const t = TONE[tone];
  return (
    <div className={cn('flex flex-col gap-1 rounded-control px-3 py-2', t.box)} data-testid={`revision-${tone}`}>
      <p className="t-body-strong flex items-center gap-1.5">
        <t.Icon aria-hidden className="size-4" />
        {t.label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((c) => (
          <li key={c.key} className="t-body font-semibold">
            • {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
