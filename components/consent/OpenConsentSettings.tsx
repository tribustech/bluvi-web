'use client';

import type { ComponentProps, MouseEvent } from 'react';
import { openConsentSettings } from '@/lib/consent/store';
import { routes } from '@/lib/routes';

/**
 * A link to /cookie-uri that opens the preferences dialog in place once the page is interactive
 * (a plain click; a modified click — new tab, new window — still follows the link). With JS off,
 * or before hydration, it is an ordinary link to the public settings page.
 */
export function OpenConsentSettings({ onClick, ...rest }: Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <a
      {...rest}
      href={routes.cookieSettings()}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openConsentSettings();
      }}
    />
  );
}
