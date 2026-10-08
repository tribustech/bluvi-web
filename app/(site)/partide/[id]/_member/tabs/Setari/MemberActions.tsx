import { ChatBubbleLeftEllipsisIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { CARD } from './parts';

/*
 * fish InfoScene's action rows:
 *  - «Raportează o problemă» (c3) — always, live or ended, host or guest: the moment something
 *    misbehaves is the moment it can still be described. Opens the frame's feedback dialog.
 *  - c9: on a live partidă a member sees «Părăsește partida», the owner «Termină partida» (both the
 *    frame's confirmations), and — owner with a documentId, live or ended — a quiet red «Șterge
 *    partida» text row that never competes with «Termină».
 */

export function ReportRow({ onReport }: { onReport: () => void }) {
  return (
    <button
      type="button"
      data-testid="setari-report"
      onClick={onReport}
      className={cn(
        CARD,
        'flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-4.5">
        <ChatBubbleLeftEllipsisIcon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-body-strong text-ink">Raportează o problemă</span>
        <span className="t-caption text-muted">Ceva nu merge sau ai o idee? Scrie-ne direct din partidă.</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-faint" />
    </button>
  );
}

export function MemberActions({
  showLeave,
  showFinish,
  canDelete,
  onLeave,
  onFinish,
  onDelete,
}: {
  showLeave: boolean;
  showFinish: boolean;
  canDelete: boolean;
  onLeave: () => void;
  onFinish: () => void;
  onDelete: () => void;
}) {
  if (!showLeave && !showFinish && !canDelete) return null;
  return (
    <div data-testid="setari-actions" className="flex flex-col gap-1">
      {showLeave ? (
        <Button variant="danger" block onClick={onLeave}>
          Părăsește partida
        </Button>
      ) : null}
      {showFinish ? (
        <Button variant="danger" block onClick={onFinish}>
          Termină partida
        </Button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-control t-body-strong text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <TrashIcon aria-hidden className="size-4.5" />
          Șterge partida
        </button>
      ) : null}
    </div>
  );
}
