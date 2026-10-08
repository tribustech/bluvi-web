import type { ReactNode } from 'react';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { AppleGlyph, GooglePlayGlyph } from '@/app/(site)/_home/StoreGlyphs';
import { buttonClass, type ButtonSize } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { APP_STORE, PLAY_STORE } from '@/lib/app-links';

/*
 * «Deschide în aplicația Bluvi» — where the web hands a partidă over to the app (owner 2026-10-08,
 * ROADMAP §4b rule 21: starting, joining and running a partidă are app-only on web).
 *  - below 1280 (a phone or a tablet, where the app lives): one button, the universal link `href`
 *    (it opens the app when installed, the store listing otherwise — bluvi-redirect-stores);
 *  - from 1280 (a desktop): the two store links, since a universal link would only land back here.
 * `onDark`: on an indigo ground (the «Ești la pescuit?» hero) — surface buttons, the white focus ring.
 */
export function OpenInApp({
  href,
  label = 'Deschide în aplicația Bluvi',
  onDark = false,
  size = 'default',
  className,
  testId = 'open-in-app',
}: {
  href: string;
  label?: string;
  onDark?: boolean;
  size?: ButtonSize;
  className?: string;
  testId?: string;
}) {
  const focus = onDark ? 'focus-visible:outline-on-accent' : undefined;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid={testId}>
      <a
        href={href}
        className={buttonClass({ variant: onDark ? 'outline' : 'primary', size, className: cn('xl:hidden', focus) })}
        data-testid={`${testId}-link`}
      >
        <DevicePhoneMobileIcon aria-hidden className="size-5" />
        {label}
      </a>
      <StoreLink href={APP_STORE} store="App Store" glyph={<AppleGlyph className="size-4.5" />} size={size} focus={focus} />
      <StoreLink href={PLAY_STORE} store="Google Play" glyph={<GooglePlayGlyph className="size-4" />} size={size} focus={focus} />
    </div>
  );
}

function StoreLink({ href, store, glyph, size, focus }: { href: string; store: string; glyph: ReactNode; size: ButtonSize; focus?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant: 'outline', size, className: cn('max-xl:hidden', focus) })}
      data-testid="open-in-app-store"
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-ink">
        {glyph}
      </span>
      {store}
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
