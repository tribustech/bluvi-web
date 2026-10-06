'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

/*
 * fish FollowersListSheet's body — who follows a competition — shared by every surface that opens
 * it (the competition cards' FollowersPill, the competition page header). The host owns the read
 * and the surface (sheet / dialog / docked panel) and titles it «Urmăritori» with
 * `followersSubtitle`; this draws the states:
 *  - loading: grey rows shaped like the list (avatar + name), not a spinner (Fundații «se încarcă»);
 *  - error: «Urmăritorii nu au putut fi încărcați.» + «Încearcă din nou» (busy while it re-reads);
 *  - the rows: fish's solid indigo disc (kit Avatar `solid`) or the photo, the username;
 *  - empty: «Nu există urmăritori».
 * A row opens the angler profile when the web has one (`hrefFor` → lib/routes.ts anglerHref; null
 * until /pescari/[id] ships in M2 — never a dead link). Without row links the list itself takes
 * focus, so a keyboard can scroll a long one.
 */

export type Follower = { documentId: string; username: string; avatar?: { url: string } | null };

/** The surface's subtitle: «N urmăresc» once the list is known. */
export const followersSubtitle = (followers: readonly Follower[] | undefined) => (followers ? `${followers.length} urmăresc` : undefined);

export function FollowersList({
  followers,
  pending,
  error,
  retrying = false,
  onRetry,
  hrefFor,
  onNavigate,
}: {
  followers: readonly Follower[] | undefined;
  pending: boolean;
  error: boolean;
  /** A retry is in flight: the button says so and ignores presses. */
  retrying?: boolean;
  onRetry: () => void;
  /** The follower's page, or null while the web has none. */
  hrefFor: (documentId: string) => string | null;
  /** A row link was followed (the host closes a non-modal surface). */
  onNavigate?: () => void;
}) {
  if (pending && !followers) {
    return (
      // A status region (a <ul> may not take role=status), its grey rows decorative.
      <div role="status" aria-label="Se încarcă urmăritorii" className="-mx-2 flex flex-col gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} aria-hidden className="flex min-h-12 items-center gap-3 px-2 py-1.5">
            <span className="size-10 shrink-0 animate-shimmer rounded-full" />
            <span className="h-3 w-2/5 animate-shimmer rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (error && !followers) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="t-body text-ink-2">Urmăritorii nu au putut fi încărcați.</p>
        <Button size="compact" variant="secondary" aria-disabled={retrying || undefined} onClick={() => !retrying && onRetry()}>
          {retrying ? 'Se reîncarcă…' : 'Încearcă din nou'}
        </Button>
      </div>
    );
  }
  if (!followers?.length) return <p className="py-8 text-center t-body-strong text-ink-2">Nu există urmăritori</p>;

  const linked = followers.some((f) => hrefFor(f.documentId) !== null);
  return (
    <ul
      tabIndex={linked ? undefined : 0}
      aria-label="Urmăritori"
      className="-mx-2 flex flex-col gap-1 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
    >
      {followers.map((f) => {
        const person = (
          <>
            <Avatar name={f.username} src={f.avatar?.url} size={40} tone="solid" />
            <span className="min-w-0 flex-1 truncate t-body text-ink">{f.username}</span>
          </>
        );
        const href = hrefFor(f.documentId);
        return (
          <li key={f.documentId}>
            {href ? (
              <Link
                href={href}
                onClick={onNavigate}
                className="flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                {person}
              </Link>
            ) : (
              <div className="flex min-h-12 items-center gap-3 px-2 py-1.5">{person}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
