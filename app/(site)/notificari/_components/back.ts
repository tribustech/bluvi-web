'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';

type NavigationLike = { canGoBack?: boolean };

/**
 * fish helpers/goBackOrHome.ts (account.notifications.c2): back in history when the page before is
 * the site's own, else Acasă (replace — a deep link straight onto /notificari has nothing behind it,
 * and the bell must never leave the visitor stuck). The Navigation API's `canGoBack` counts this
 * tab's same-origin entries only; without it a same-origin referrer stands in.
 * TODO(kit): one `useBack` in components/nav (balti/[id]/_sub/useBack.ts is the same idea).
 */
function canGoBackInSite(): boolean {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (nav && typeof nav.canGoBack === 'boolean') return nav.canGoBack;
  try {
    return Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useBackOrHome() {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInSite()) router.back();
    else router.replace(routes.home());
  }, [router]);
}
