import type { Metadata } from 'next';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { PrivacyPolicyLink } from '@/components/consent/PrivacyPolicyLink';
import { COPY, LAST_UPDATED, LAST_UPDATED_ISO } from '@/lib/consent/catalog';
import { anyActive, CONFIGURED } from '@/lib/consent/configured';
import { jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { CookieSettingsPanel } from './_components/CookieSettingsPanel';

/*
 * /cookie-uri — «Setări de confidențialitate» (m8.consent; fish app/(app)/cmp-personalize.tsx →
 * CMP/ui/PersonalizeScreen). Public and indexable, statically prerendered: the text, the categories
 * and the cookie list are in the HTML; the switches and buttons appear once the page knows the
 * visitor's decision (browser cookie — never read on the server). With JS off it is the readable
 * fallback of every «Setări de confidențialitate» link.
 *
 * Layout: T1 ListPage + ListHeader like Setări, one reading column of ~720 at every width (long text
 * is the only thing capped — owner rule).
 */

// Only the services this deployment runs are named (lib/consent/configured.ts — owner rule 4).
const OPTIONAL = anyActive(CONFIGURED);
const OPTIONAL_NAMES = [CONFIGURED.analytics ? 'analiza cu Google Analytics' : null, CONFIGURED.errors ? 'monitorizarea erorilor cu Sentry' : null].filter(Boolean).join(' și ');
const OPTIONAL_SHORT = [CONFIGURED.analytics ? 'analiza' : null, CONFIGURED.errors ? 'monitorizarea erorilor' : null].filter(Boolean).join(' și ');
const DESCRIPTION = OPTIONAL
  ? `Alege ce cookie-uri folosește Bluvi: cele strict necesare și ${OPTIONAL_NAMES}. Le poți schimba oricând.`
  : 'Ce cookie-uri folosește Bluvi: doar cele strict necesare, ca site-ul să funcționeze.';
const TITLE_ID = 'cookie-uri-titlu';

export const metadata: Metadata = {
  title: COPY.title,
  description: DESCRIPTION,
  alternates: { canonical: routes.cookieSettings() },
  openGraph: {
    type: 'website',
    title: `${COPY.title} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.cookieSettings()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${COPY.title} · Bluvi`, description: DESCRIPTION },
};

const COLUMN = 'mx-auto w-full max-w-180';

export default function CookieSettingsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: COPY.title,
    description: DESCRIPTION,
    url: absoluteUrl(routes.cookieSettings()),
    inLanguage: 'ro-RO',
    dateModified: LAST_UPDATED_ISO,
  };
  return (
    <ListPage
      header={
        <div className={COLUMN}>
          <ListHeader title={COPY.title} titleId={TITLE_ID} description={<>Ultima actualizare: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED}</time></>} />
        </div>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(jsonLd)} />
      <div className={`${COLUMN} flex flex-col gap-6`}>
        <div className="flex flex-col gap-3">
          <p className="t-body text-ink-2">
            {OPTIONAL
              ? `Bluvi folosește cookie-uri și tehnologii asemănătoare. Cele strict necesare țin site-ul în funcțiune și nu pot fi oprite. Celelalte — ${OPTIONAL_SHORT} — sunt oprite până când alegi să le pornești, iar alegerea ta se păstrează 180 de zile.`
              : 'Bluvi folosește doar cookie-uri și stocare strict necesare: țin site-ul în funcțiune și nu pot fi oprite.'}
          </p>
          <p className="t-body text-ink-2">
            Detaliile despre datele tale sunt în <PrivacyPolicyLink />.
          </p>
        </div>
        <CookieSettingsPanel />
        {OPTIONAL ? (
        <section aria-labelledby="cookie-uri-retragere" className="flex flex-col gap-2">
          <h2 id="cookie-uri-retragere" className="t-title2 text-ink">
            Cum îți retragi acordul
          </h2>
          <p className="t-body text-ink-2">
            {[
              'Poți schimba alegerea oricând, de pe această pagină sau din «Setări de confidențialitate» (în Setări sau pe Acasă).',
              CONFIGURED.analytics ? 'Când oprești analiza, ștergem cookie-urile Google Analytics de pe acest site și nu mai trimitem date.' : null,
              'Alegerea se păstrează doar în acest browser: pe alt dispozitiv te întrebăm din nou.',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
        </section>
        ) : null}
      </div>
    </ListPage>
  );
}
