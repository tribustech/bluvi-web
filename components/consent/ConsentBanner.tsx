'use client';

import { type RefObject, useEffect, useId, useRef } from 'react';
import { bannerText, COPY } from '@/lib/consent/catalog';
import type { ConsentChoice } from '@/lib/consent/model';
import { ConsentActions } from './ConsentActions';
import { PrivacyPolicyLink } from './PrivacyPolicyLink';

/**
 * The first-visit banner (m8.consent). Rendered by ConsentProvider only in the browser and only when
 * there is no valid decision: the server HTML holds nothing (static prerender, no layout shift — it
 * is fixed, over the page). Not modal: the page stays usable, the banner goes once the visitor
 * decides. «Refuz toate» and «Accept toate» are equal; «Personalizează» is a smaller ghost button.
 * One short sentence: the services and their cookies are in the dialog (≤ 35% of a 375 × 812 phone).
 *  - phone (<768): a bottom sheet across the width, above the home indicator (safe area); the page
 *    gets the banner's height as bottom padding, so its last rows can still be scrolled into view,
 *    and as `--consent-inset` on <html>, which the fixed bottom bars (T3 DetailActionBar, T1
 *    StickyActions, «Arată harta») add to their `bottom`, so they sit above the sheet;
 *  - from 768: a card of at most 440 in the bottom-left corner, clear of the bottom-centre CTAs
 *    («Arată harta», «Deschide în aplicația Bluvi»).
 */
export function ConsentBanner({
  active,
  onReject,
  onAccept,
  onCustomize,
  covered = false,
}: {
  /** The optional categories on this deployment (lib/consent/active.ts): what the sentence names. */
  active: ConsentChoice;
  onReject: () => void;
  onAccept: () => void;
  onCustomize: () => void;
  /** The preferences dialog is open over it: kept mounted (focus returns to «Personalizează» on Escape) but not drawn. */
  covered?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  usePhonePadding(ref);
  return (
    <section
      ref={ref}
      role="region"
      aria-label="Consimțământ cookie-uri"
      data-testid="consent-banner"
      className={
        (covered ? 'invisible ' : '') +
        'fixed inset-x-0 bottom-0 z-overlay flex flex-col gap-2 rounded-t-card border-t border-hairline bg-surface px-4 pt-4 text-ink shadow-e2 ' +
        'pb-[max(--spacing(4),env(safe-area-inset-bottom))] ' +
        'md:inset-x-auto md:bottom-6 md:left-6 md:w-[calc(100%-(--spacing(12)))] md:max-w-110 md:rounded-card md:border-t-0 md:p-5 xl:bottom-8 xl:left-8'
      }
    >
      <h2 id={titleId} className="t-heading">
        {COPY.bannerTitle}
      </h2>
      <p className="t-body text-ink-2">
        {bannerText(active)} <PrivacyPolicyLink />
      </p>
      <ConsentActions layout="banner" onReject={onReject} onAccept={onAccept} onCustomize={onCustomize} />
    </section>
  );
}

/**
 * Below 768 the sheet spans the width: give <body> its height as bottom padding, and <html> the
 * `--consent-inset` variable for the fixed bottom bars, while it is shown.
 */
function usePhonePadding(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const body = document.body;
    const root = document.documentElement;
    const prev = body.style.paddingBottom;
    const phone = window.matchMedia('(max-width: 767.98px)');
    const apply = () => {
      body.style.paddingBottom = phone.matches ? `${el.offsetHeight}px` : prev;
      if (phone.matches) root.style.setProperty('--consent-inset', `${el.offsetHeight}px`);
      else root.style.removeProperty('--consent-inset');
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    phone.addEventListener('change', apply);
    return () => {
      ro.disconnect();
      phone.removeEventListener('change', apply);
      body.style.paddingBottom = prev;
      root.style.removeProperty('--consent-inset');
    };
  }, [ref]);
}
