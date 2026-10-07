import type { ReactNode } from 'react';
import { LivePartideProvider } from './_live/LivePartideProvider';

/*
 * Every /partide page runs under the Partide live layer (./_live, parity partide.b.live-subscription):
 * the viewer's active partidă pointer and its realtime projection, mounted once here as fish mounts
 * usePartideLiveMount once for the app. A client provider that renders its children at once — the
 * static shells of the public pages (hub, spectator) are unchanged.
 */
export default function PartideLayout({ children }: { children: ReactNode }) {
  return <LivePartideProvider>{children}</LivePartideProvider>;
}
