import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';

/** fish components/SeeAllTitle.tsx — section title (title2) + «Vezi toate ›». */
export function SeeAllTitle({
  id,
  title,
  href,
  linkLabel = 'Vezi toate',
  leading,
  className,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel?: string;
  /** e.g. the live halo dot on desktop. */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {leading}
      <h2 id={id} className="min-w-0 flex-1 t-title2">
        {title}
      </h2>
      <Link
        href={href}
        className="-my-2 flex shrink-0 items-center gap-0.5 rounded-control py-2 t-body text-accent-ink underline-offset-2 hover:underline"
        aria-label={`${linkLabel}: ${title}`}
      >
        {linkLabel}
        <ChevronRightIcon aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
