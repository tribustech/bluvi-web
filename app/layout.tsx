import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@/components/analytics/Analytics';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import { REVEAL_NOW_SCRIPT } from '@/lib/reveal-now';
import { nunito } from './fonts';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Bluvi', template: '%s · Bluvi' },
  description: 'Concursuri de pescuit, bălți și partide — Bluvi.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={nunito.variable}>
      <head>
        {/* Before React's streaming runtime: reveal Suspense boundaries without the 300 ms throttle (lib/reveal-now.ts). */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_NOW_SCRIPT }} />
      </head>
      <body>
        {/* Cookie consent (m8.consent): renders nothing on the server; first in the DOM so the banner is the first Tab stop. */}
        <ConsentProvider />
        {/* GA4 behind consent, page_view tracker, data-analytics-* clicks (m8.ga4): renders no markup. */}
        <Analytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
