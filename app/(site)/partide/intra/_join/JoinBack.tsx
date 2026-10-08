'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { routes } from '@/lib/routes';

/**
 * The header's back chip — fish helpers/goBackOrHome.ts: back in history when the page before is
 * ours (Acasă's hero, the Partide hub, …), else a REPLACE to the Partide hub (a deep link has
 * nothing behind it, and the spent form must not stay under the hub). A real link to /partide, so
 * it works without JS and a middle / modified click opens the hub in a new tab.
 */
export function JoinBack() {
  const router = useRouter();
  const href = routes.partide();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (canGoBackInApp()) router.back();
    else router.replace(href);
  };
  return (
    <Link href={href} onClick={onClick} aria-label="Înapoi" className={headerChipClass()}>
      <ChevronLeftIcon aria-hidden />
    </Link>
  );
}
