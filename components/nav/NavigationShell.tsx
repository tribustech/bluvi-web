'use client';

import { Suspense, use, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Rail } from './Rail';
import { SideNav } from './SideNav';
import { TabBar } from './TabBar';
import { navKeyForPath, type AdminLink, type NavKey } from './items';

type Props = {
  /**
   * A boolean, or a promise of one (the server's un-awaited session read). With a promise each
   * navigation renders signed out in the static shell and swaps to the resolved state when the
   * session streams in, so the session never blocks the page.
   */
  signedIn: boolean | Promise<boolean>;
  admin?: AdminLink[];
  children: ReactNode;
};

type NavState = { signedIn: boolean; active?: NavKey | (string & {}) };
type Render = (s: NavState) => ReactNode;

/**
 * Each navigation reads the pathname and the session behind its own Suspense boundary: on a
 * dynamic route the pathname is request data (Cache Components rejects reading it outside a
 * boundary), and the session may still be streaming. Fallback: signed out, nothing highlighted.
 */
function Nav({ signedIn, admin, render }: { signedIn: Props['signedIn']; admin?: AdminLink[]; render: Render }) {
  return (
    <Suspense fallback={render({ signedIn: false })}>
      <LiveNav signedIn={signedIn} admin={admin} render={render} />
    </Suspense>
  );
}

function LiveNav({ signedIn, admin, render }: { signedIn: Props['signedIn']; admin?: AdminLink[]; render: Render }) {
  const pathname = usePathname() ?? '/';
  const active = admin?.find((a) => pathname.startsWith(a.href))?.key ?? navKeyForPath(pathname);
  return render({ signedIn: typeof signedIn === 'boolean' ? signedIn : use(signedIn), active });
}

/**
 * Thin client wrapper: places the three presentational navigations per breakpoint — tab bar <768
 * (fixed bottom), rail 768–1279, side menu ≥1280 — and gives each the active key and session.
 * The only router-aware part of the navigation.
 */
export function NavigationShell({ signedIn, admin, children }: Props) {
  return (
    <div className="min-h-dvh md:flex">
      <Nav
        signedIn={signedIn}
        admin={admin}
        render={(s) => (
          <Rail {...s} className="sticky top-0 hidden h-dvh shrink-0 md:flex xl:hidden" />
        )}
      />
      <Nav
        signedIn={signedIn}
        admin={admin}
        render={(s) => (
          <SideNav {...s} admin={admin} className="sticky top-0 hidden h-dvh shrink-0 overflow-y-auto xl:flex" />
        )}
      />
      <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <Nav
        signedIn={signedIn}
        admin={admin}
        render={(s) => <TabBar {...s} className="fixed inset-x-0 bottom-0 z-30 md:hidden" />}
      />
    </div>
  );
}
