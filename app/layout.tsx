import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
