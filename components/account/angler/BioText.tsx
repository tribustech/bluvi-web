import { cn } from '@/components/ui/cn';
import { bioParts } from '@/core/social';

/*
 * fish components/profile/BioText.tsx (parity account.angler-profile c14): the bio, centred under the
 * header, its #hashtags (letters, digits, underscore) in the accent colour. No bio, no block (the
 * caller renders it only when there is one).
 */
export function BioText({ bio, className }: { bio: string; className?: string }) {
  return (
    <p className={cn('t-label whitespace-pre-line text-ink-2', className)} data-testid="bio">
      {bioParts(bio).map((p, i) =>
        p.tag ? (
          <span key={i} className="text-accent-ink" data-hashtag>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </p>
  );
}
