'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { acceptAll, anyActive, useActiveCategories } from '@/lib/consent/active';
import { CONSENT_OPEN_EVENT, setConsent } from '@/lib/consent/store';
import { useConsent } from '@/lib/consent/useConsent';
import { NO_CHOICE, type ConsentChoice } from '@/lib/consent/model';
import { routes } from '@/lib/routes';
import { ConsentBanner } from './ConsentBanner';
import { ConsentPreferencesDialog } from './ConsentPreferencesDialog';

/**
 * The consent layer's UI, mounted once from app/layout.tsx (m8.consent):
 *  - the banner, after mount, only while there is no valid `bluvi_consent` (server HTML: nothing),
 *    only when an optional category exists (lib/consent/active.ts), and never on /cookie-uri: that
 *    page is the decision UI, with the same choices inline;
 *  - the preferences dialog, opened by the banner's «Personalizează» or by openConsentSettings()
 *    from anywhere (Setări «Setări de confidențialitate», the Acasă card). Closing it without a
 *    decision (Escape, X, backdrop) saves nothing; focus goes back to the control that opened it.
 */
export function ConsentProvider() {
  const consent = useConsent();
  const active = useActiveCategories();
  const banner = consent === null && anyActive(active);
  // 0 = never opened (not mounted); each opening bumps it, remounting the dialog with a fresh draft.
  const [openId, setOpenId] = useState(0);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setOpenId((n) => n + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(CONSENT_OPEN_EVENT, show);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, show);
  }, [show]);

  // Focus trap: a native modal <dialog> makes the page inert, but Tab past its last control leaves
  // for the browser's own UI. Wrap it inside the dialog instead (first ↔ last).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const d = document.querySelector('[data-testid="consent-dialog-body"]')?.closest('dialog');
      if (!d) return;
      const items = [...d.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null || el.getClientRects().length > 0,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !d.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !d.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    const back = opener.current;
    opener.current = null;
    // After the <dialog> left the top layer (its own focus fix-up runs on close()).
    requestAnimationFrame(() => {
      if (back?.isConnected) back.focus();
    });
  }, []);

  const decide = useCallback(
    (choice: ConsentChoice) => {
      setConsent(choice);
      if (open) close();
    },
    [open, close],
  );

  return (
    <>
      {banner ? <BannerOffSettingsPage active={active} covered={open} onReject={() => decide(NO_CHOICE)} onAccept={() => decide(acceptAll(active))} onCustomize={show} /> : null}
      {openId > 0 ? (
        <ConsentPreferencesDialog key={openId} open={open} initial={consent ?? null} onClose={close} onDecide={decide} />
      ) : null}
    </>
  );
}

/**
 * The banner, except on /cookie-uri (the page is the decision UI). Mounted only once the decision is
 * known to be missing — in the browser, after hydration — so usePathname never runs in a prerender.
 */
function BannerOffSettingsPage(props: Parameters<typeof ConsentBanner>[0]) {
  return usePathname() === routes.cookieSettings() ? null : <ConsentBanner {...props} />;
}
