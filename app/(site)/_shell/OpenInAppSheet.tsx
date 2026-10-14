'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Sheet } from '@/components/surfaces/Sheet';
import { buttonClass, Button } from '@/components/ui/Button';
import { track } from '@/lib/analytics';
import { anyActive, useActiveCategories } from '@/lib/consent/active';
import { useConsent } from '@/lib/consent/useConsent';
import { answeredRecently, isQuietPath, markAnswered, openInAppHref, phoneOf, readAnsweredAt } from '@/lib/open-in-app';
import appIcon from '../../apple-icon.png';

const noSubscribe = () => () => {};
const readEligible = () =>
  phoneOf(navigator.userAgent, navigator.maxTouchPoints) !== null && !answeredRecently(readAnsweredAt(), Date.now());

/**
 * «Deschide în aplicație / Continuă în browser» (lib/open-in-app.ts): on a phone, on whatever page
 * the visitor lands on, once the cookie banner is answered (never two bottom sheets at once).
 * Any answer (open, continue, scrim, Escape, drag) keeps it away 3 days.
 */
export function OpenInAppSheet() {
  const pathname = usePathname();
  const consent = useConsent();
  const active = useActiveCategories();
  const consentPending = consent === undefined || (consent === null && anyActive(active));
  // A phone whose visitor has not answered in the last 3 days (server and hydration: no).
  const eligible = useSyncExternalStore(noSubscribe, readEligible, () => false);
  const [answered, setAnswered] = useState(false);
  const open = eligible && !answered && !consentPending && !isQuietPath(pathname);

  useEffect(() => {
    if (open) track('open_in_app_sheet_shown', { page_path: pathname });
    // Once per opening, not per navigation behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    markAnswered();
    setAnswered(true);
  };

  if (!eligible) return null;
  return (
    <Sheet open={open} onClose={close} title="Bluvi e mai bun în aplicație" titleHidden fixed initialSnap="fit">
      <div className="flex flex-col items-center gap-3 pt-1 pb-2 text-center">
        <Image src={appIcon} alt="" width={72} height={72} className="size-18 rounded-card shadow-e1" />
        <p className="t-title1">Bluvi e mai bun în aplicație</p>
        <p className="t-body text-ink-2">Clasamente live, partide, rezervări și notificări când se întâmplă ceva la balta ta.</p>
        <div className="mt-2 flex w-full flex-col gap-2">
          <a
            // Rendered only in the browser (`eligible` is false on the server).
            href={openInAppHref(pathname, window.location.search)}
            onClick={() => {
              track('open_in_app_sheet_open', { page_path: pathname });
              close();
            }}
            className={buttonClass({ variant: 'primary', block: true })}
            data-testid="open-in-app-open"
          >
            Deschide aplicația
          </a>
          <Button
            variant="ghost"
            block
            onClick={() => {
              track('open_in_app_sheet_continue', { page_path: pathname });
              close();
            }}
            data-testid="open-in-app-continue"
          >
            Continuă în browser
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
