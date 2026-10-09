'use client';

import { useState } from 'react';
import { ConsentActions } from '@/components/consent/ConsentActions';
import { ConsentCategories } from '@/components/consent/ConsentCategories';
import { COPY } from '@/lib/consent/catalog';
import { acceptAll, anyActive, useActiveCategories } from '@/lib/consent/active';
import { NO_CHOICE, type ConsentChoice } from '@/lib/consent/model';
import { setConsent } from '@/lib/consent/store';
import { useConsent } from '@/lib/consent/useConsent';

/**
 * The page's controls: the same categories and buttons as the preferences dialog, inline. The
 * switches are a draft over the stored decision (all off when there is none) until a button saves;
 * «Preferințele au fost salvate.» is announced after each save. Server HTML / hydration: the cards
 * without switches and no buttons (the decision is unknown there — owner rule 4); with JS off a
 * line says the choices need JavaScript.
 */
export function CookieSettingsPanel() {
  const consent = useConsent();
  const active = useActiveCategories();
  const [draft, setDraft] = useState<ConsentChoice | null>(null);
  const [status, setStatus] = useState('');
  const known = consent !== undefined;
  const values: ConsentChoice | undefined = !known ? undefined : (draft ?? (consent ? { analytics: consent.analytics, errors: consent.errors } : NO_CHOICE));

  const save = (choice: ConsentChoice) => {
    setConsent(choice);
    setDraft(choice);
    // Re-announced on every save (a changed string is what a live region reads).
    setStatus((s) => (s === COPY.saved ? `${COPY.saved} ` : COPY.saved));
  };

  return (
    <section aria-labelledby="cookie-uri-categorii" className="flex flex-col gap-3" data-testid="cookie-settings">
      <h2 id="cookie-uri-categorii" className="t-title2 text-ink">
        Categorii de cookie-uri
      </h2>
      <ConsentCategories values={values} onChange={(k, on) => values && setDraft({ ...values, [k]: on })} />
      <noscript>
        <p className="t-body text-ink-2">Pentru a-ți schimba alegerea, activează JavaScript în browser.</p>
      </noscript>
      {/* No optional category on this deployment: nothing to choose, no buttons. */}
      <div className={anyActive(active) ? 'min-h-26 md:min-h-12 xl:min-h-10' : 'hidden'}>
        {known && anyActive(active) ? (
          <ConsentActions layout="page" onReject={() => save(NO_CHOICE)} onAccept={() => save(acceptAll(active))} onSave={() => values && save(values)} />
        ) : null}
      </div>
      <p role="status" className="t-body-strong min-h-5 text-status-success-fg">
        {status}
      </p>
    </section>
  );
}
