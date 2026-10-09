'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { disableGa4, enableGa4, ga4Id } from '@/lib/analytics';
import { readConsent, subscribeConsent } from '@/lib/consent/store';

/**
 * Google Analytics 4 behind the cookie consent (m8.ga4). Without NEXT_PUBLIC_GA4_ID: nothing (no
 * script, no gtag). With it: gtag.js loads only after the visitor opted in to «Analiză» — now or
 * later in the same visit (subscribeConsent, no reload; a decision from another tab is re-read from
 * the cookie when this tab is shown / focused again); a withdrawal stops it (disable flag, consent
 * denied) and deletes the _ga cookies. lib/analytics forwards events only while opted in.
 */
export function Ga4({ id = ga4Id() }: { id?: string | null }) {
  // Once loaded, the script stays (it cannot be unloaded); the disable flag stops it.
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (!id) return;
    let granted = false;
    const apply = (analytics: boolean) => {
      if (analytics && !granted) {
        granted = true;
        enableGa4(id);
        setLoad(true);
      } else if (!analytics && granted) {
        granted = false;
        disableGa4(id);
      }
    };
    const recheck = () => apply(readConsent()?.analytics === true);
    recheck();
    // subscribeConsent only hears this tab. A decision taken in another tab only rewrites the
    // cookie: re-read it whenever this tab comes back, so a withdrawal there stops gtag.js here too
    // (its own user_engagement / enhanced-measurement hits would re-create the deleted _ga cookies).
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    const unsubscribe = subscribeConsent((c) => apply(c.analytics));
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
    };
  }, [id]);

  if (!id || !load) return null;
  return <Script id="ga4-gtag" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />;
}
