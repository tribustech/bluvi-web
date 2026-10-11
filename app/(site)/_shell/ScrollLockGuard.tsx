'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { releaseOrphanLocks } from '@/components/surfaces/scrollLock';

/**
 * Every page-scroll lock (a modal's, a full-screen map's) is owned by a mounted component and
 * released in its cleanup (components/surfaces/scrollLock). This is the defensive half (owner
 * 2026-10-11, «din harta de bălți … nu mai merge scrollul»): after every route change — forward, back,
 * a tab — a lock whose owner is no longer on screen is released, so no page is ever left unscrollable.
 */
export function ScrollLockGuard() {
  const pathname = usePathname();
  useEffect(() => {
    // After the frame: the previous route has been hidden / unmounted by then.
    const id = requestAnimationFrame(() => releaseOrphanLocks());
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}
