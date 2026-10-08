import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { SignInGate } from '@/components/templates/SignInGate';
import { cn } from '@/components/ui/cn';

/*
 * The chat page's server-rendered states, in the chat's own frame (./ChatFrame.tsx):
 *  - ChatSkeleton — the Suspense fallback and loading.tsx: header bars, the room switcher's shape,
 *    bubble-shaped rows, the composer's bar (no spinner; fish's header placeholders, c1 / c13);
 *  - ChatSignedOut — a cookie the CMS refused (participant.b.chat-signed-out): the sign-in gate,
 *    back to this chat (with its room) after sign-in.
 */

/** The viewport under the site bar (56 / 64 from 768) and the offline banner while it shows. */
export const FRAME_H =
  'h-[calc(100dvh-var(--spacing)*14-var(--shell-banner-h,0px))] md:h-[calc(100dvh-var(--spacing)*16-var(--shell-banner-h,0px))]';

const BUBBLES = [
  { w: 'w-3/5', side: 'self-start' },
  { w: 'w-2/5', side: 'self-start' },
  { w: 'w-1/2', side: 'self-end' },
  { w: 'w-2/3', side: 'self-start' },
  { w: 'w-1/3', side: 'self-end' },
];

export function ChatSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă chatul" className={cn(FRAME_H, 'flex bg-surface md:bg-page md:p-4 xl:grid xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:gap-4 xl:px-6 2xl:px-8')}>
      <div aria-hidden className="hidden flex-col gap-4 xl:flex">
        <span className="h-80 animate-shimmer rounded-card" />
        <span className="h-28 animate-shimmer rounded-card" />
      </div>
      <div aria-hidden className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface md:mx-auto md:max-w-200 md:rounded-card md:shadow-e1 md:ring-1 md:ring-hairline xl:mx-0 xl:max-w-none">
        <div className="flex min-h-16 items-center gap-2.5 border-b border-hairline py-2 pr-3 pl-2">
          <span className="size-11 shrink-0" />
          <span className="size-10 shrink-0 animate-shimmer rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="block h-3.5 w-3/5 animate-shimmer rounded-full" />
            <span className="block h-2.5 w-1/3 animate-shimmer rounded-full" />
          </span>
        </div>
        <div className="mx-auto flex w-full max-w-160 flex-1 flex-col justify-end gap-3 px-4 py-4">
          {BUBBLES.map((b, i) => (
            <span key={i} className={cn('block h-10 animate-shimmer rounded-card', b.w, b.side)} />
          ))}
        </div>
        <div className="flex items-end gap-2 border-t border-hairline px-3 pt-2.5 pb-[calc(--spacing(2.5)+env(safe-area-inset-bottom))]">
          <span className="h-11 flex-1 animate-shimmer rounded-control" />
          <span className="size-11 animate-shimmer rounded-full" />
        </div>
      </div>
      <div aria-hidden className="hidden flex-col gap-4 xl:flex">
        <span className="h-56 animate-shimmer rounded-card" />
        <span className="h-40 animate-shimmer rounded-card" />
      </div>
    </div>
  );
}

export function ChatSignedOut({ next }: { next: string }) {
  return (
    <div className={cn(FRAME_H, 'flex flex-col items-center justify-center overflow-y-auto bg-page px-4 py-6')}>
      <h1 className="sr-only">Chat concurs</h1>
      <SignInGate
        title="Intră în cont ca să vezi chatul"
        description="Chatul concursului e pentru pescarii cu cont Bluvi: participanți, organizatori și urmăritori."
        next={next}
        icon={<ChatBubbleLeftRightIcon />}
        headingLevel={2}
      />
    </div>
  );
}
