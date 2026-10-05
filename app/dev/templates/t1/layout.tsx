import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { SHELL_MAX } from '@/components/nav/shell';
import { DemoChrome } from './DemoChrome';
import { DemoTopBar } from './DemoTopBar';
import { readViewer, SIGNED_OUT } from './serverReads';
import { StateSwitcher } from './StateSwitcher';
import { StateSwitcherFromUrl } from './StateSwitcherFromUrl';

/**
 * /dev/templates/t1's frame: the real top bar and the state band over <main>. Here, not in the
 * page, so the route's error boundary (error.tsx) renders INSIDE it — a crash keeps the viewer's
 * shell. While the session is read the bar's account slot is PENDING (never «Intră», which would
 * read as a logout to a signed-in user and then jump to the avatar), and the state band already
 * marks the current state (read from the URL on the client). A session read that runs over the
 * budget is «unknown» (DemoChrome re-reads it), never «Intră».
 */
export default function T1DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <>
      <Suspense
        fallback={
          <>
            <DemoTopBar viewer={{ status: 'pending' }} roles={null} />
            <Suspense fallback={<StateSwitcher />}>
              <StateSwitcherFromUrl />
            </Suspense>
          </>
        }
      >
        <Chrome />
      </Suspense>
      <main id="continut" className={`mx-auto ${SHELL_MAX}`}>
        {children}
      </main>
    </>
  );
}

async function Chrome() {
  const viewer = await readViewer();
  if (viewer === 'unknown') return <DemoChrome viewer={{ status: 'unknown' }} roles={null} />;
  return (
    <DemoChrome
      viewer={viewer ? { status: 'in', name: viewer.username, avatarUrl: viewer.avatarUrl } : SIGNED_OUT}
      roles={viewer ? { isOrganizer: viewer.isOrganizer, ownedLakes: viewer.ownedLakes } : null}
    />
  );
}
