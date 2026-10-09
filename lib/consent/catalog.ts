/*
 * What the consent UI says (m8.consent): the categories, their services and their cookies, in
 * Romanian. Service details follow fish CMP/ui/text.ts (serviceDetails, ro) with the web's changes:
 * - GA4 and Sentry are both consent-based on the web (legal basis lit. a), off until the visitor opts in;
 * - «React Native Firebase» is an app SDK: the web uses Firebase only for the competition chat's
 *   sign-in, which is strictly necessary for that feature (listed under «Strict necesare»);
 * - Sentry runs as a browser SDK, without cookies.
 * Bump CONSENT_VERSION (model.ts) and LAST_UPDATED when a service or a category changes.
 */

import type { ConsentCategory, ConsentChoice } from './model';

/** Shown on /cookie-uri: «Ultima actualizare: 9 octombrie 2026». */
export const LAST_UPDATED_ISO = '2026-10-09';
export const LAST_UPDATED = '9 octombrie 2026';

export const COPY = {
  title: 'Setări de confidențialitate',
  bannerTitle: 'Cookie-uri pe Bluvi',
  intro:
    'Acest instrument te ajută să gestionezi consimțământul pentru tehnologiile terțe care colectează și prelucrează date cu caracter personal. Categoriile opționale sunt oprite până când alegi să le pornești.',
  acceptAll: 'Accept toate',
  rejectAll: 'Refuz toate',
  customize: 'Personalizează',
  save: 'Salvează preferințele',
  saved: 'Preferințele au fost salvate.',
  privacyPolicy: 'Politica de confidențialitate',
  alwaysOn: 'Mereu active',
  details: 'Detalii',
} as const;

/**
 * The banner's one sentence, for the active categories (lib/consent/active.ts). Short on purpose:
 * the services and their cookies are in the dialog and on /cookie-uri.
 */
export function bannerText(active: ConsentChoice): string {
  const uses = [active.analytics ? 'statistici de utilizare' : null, active.errors ? 'raportarea erorilor' : null].filter(Boolean).join(' și ');
  return `Folosim cookie-uri necesare ca site-ul să funcționeze și, doar cu acordul tău, pentru ${uses}.`;
}

export type ServiceDetails = {
  name: string;
  description: string;
  company: string;
  purposes: string[];
  technologies: string[];
  dataCollected: string[];
  legalBasis: string;
  processingLocation: string;
  retention: string;
  dataTransfer: string[];
  recipients: string[];
  privacyPolicy: string;
};

export type CookieEntry = { name: string; provider: string; purpose: string; duration: string };

export type CategoryInfo = {
  /** `necessary` is always on; the others are the switchable ConsentCategory keys. */
  key: 'necessary' | ConsentCategory;
  title: string;
  summary: string;
  services: ServiceDetails[];
  cookies: CookieEntry[];
  /** A line under the cookie list (e.g. «Nu setează cookie-uri»). */
  cookiesNote?: string;
};

/** fish serviceDetailsCategories (ro), the section titles of a service's details. */
export const DETAIL_LABELS = {
  description: 'Descriere serviciu',
  company: 'Compania procesatoare de date',
  purposes: 'Scopurile prelucrării',
  technologies: 'Tehnologii folosite',
  dataCollected: 'Informații colectate',
  legalBasis: 'Baze legale',
  processingLocation: 'Locul procesării',
  retention: 'Perioada de păstrare',
  dataTransfer: 'Transferul către țări terțe',
  recipients: 'Destinatarii datelor',
  privacyPolicy: 'Politica de confidențialitate a furnizorului',
  cookies: 'Cookie-uri și stocare',
} as const;

const RETENTION = 'Datele sunt șterse imediat ce nu mai sunt necesare în scopul prelucrării.';

const GA4: ServiceDetails = {
  name: 'Google Analytics 4',
  description: 'Instrument de analiză: statistici agregate despre paginile vizitate și modul în care este folosit site-ul.',
  company: 'Google Ireland Limited, Google Building Gordon House, 4 Barrow St, Dublin, D04 E5W5, Irlanda',
  purposes: ['Analize'],
  technologies: ['Cookie-uri'],
  dataCollected: [
    'Identificatori',
    'Date privind utilizarea',
    'Durata sesiunii',
    'Adresă IP',
    'Localizare geografică',
    'Sistem de operare',
    'Informații despre browser și dispozitiv',
    'Ora primei vizite',
    'Conținut vizualizat',
  ],
  legalBasis: 'Consimțământ — art. 6 alin. (1) lit. a RGPD',
  processingLocation: 'Uniunea Europeană',
  retention: RETENTION,
  dataTransfer: ['Taiwan', 'Singapore', 'Chile', 'Statele Unite ale Americii'],
  recipients: ['Google LLC', 'Google Ireland Limited', 'Alphabet Inc.'],
  privacyPolicy: 'https://business.safety.google/privacy/?hl=ro',
};

const SENTRY: ServiceDetails = {
  name: 'Sentry',
  description:
    'Platformă de urmărire a erorilor și de monitorizare a performanței. O folosim ca să aflăm și să reparăm repede erorile care apar în browser.',
  company: 'Functional Software, Inc. dba Sentry, 45 Fremont Street 8th Floor, San Francisco, CA 94105, Statele Unite ale Americii',
  purposes: ['Detectarea erorilor de cod', 'Dezvoltarea și îmbunătățirea produsului'],
  technologies: ['SDK JavaScript în browser'],
  dataCollected: ['Date despre eroare', 'Date privind utilizarea', 'Informații despre browser și dispozitiv', 'Adresă IP'],
  legalBasis: 'Consimțământ — art. 6 alin. (1) lit. a RGPD',
  processingLocation: 'Statele Unite ale Americii',
  retention: RETENTION,
  dataTransfer: ['Statele Unite ale Americii'],
  recipients: ['Functional Software, Inc. dba Sentry'],
  privacyPolicy: 'https://sentry.io/privacy/',
};

export const CATEGORIES: CategoryInfo[] = [
  {
    key: 'necessary',
    title: 'Strict necesare',
    summary: 'Țin site-ul în funcțiune: te păstrează conectat și îți rețin alegerea despre cookie-uri. Nu pot fi oprite.',
    services: [],
    cookies: [
      { name: 'bluvi_session', provider: 'Bluvi', purpose: 'Te păstrează conectat în contul tău. Nu poate fi citit de scripturi.', duration: '1 an' },
      { name: 'bluvi_consent', provider: 'Bluvi', purpose: 'Reține alegerile tale de pe această pagină.', duration: '180 de zile' },
      {
        name: 'Stocare locală',
        provider: 'Bluvi',
        purpose: 'Căutări recente, bălți văzute recent și poziția în pagină. Rămân pe dispozitivul tău.',
        duration: 'Până le ștergi din browser',
      },
      {
        name: 'Firebase Authentication',
        provider: 'Google',
        purpose: 'Conectarea la chat-ul concursurilor, doar dacă ești conectat în Bluvi.',
        duration: 'Până te deconectezi',
      },
    ],
  },
  {
    key: 'analytics',
    title: 'Analiză',
    summary: 'Ne arată, în statistici agregate, ce pagini și funcții sunt folosite, ca să îmbunătățim Bluvi. Folosim Google Analytics 4.',
    services: [GA4],
    cookies: [
      { name: '_ga', provider: 'Google', purpose: 'Deosebește vizitatorii între ei.', duration: '2 ani' },
      { name: '_ga_<ID>', provider: 'Google', purpose: 'Păstrează starea sesiunii de analiză.', duration: '2 ani' },
    ],
  },
  {
    key: 'errors',
    title: 'Monitorizarea erorilor',
    summary: 'Când ceva nu merge, ne trimite detalii tehnice despre eroare, ca să o reparăm repede. Folosim Sentry.',
    services: [SENTRY],
    cookies: [],
    cookiesNote: 'Nu setează cookie-uri. Trimite un raport doar când apare o eroare.',
  },
];

/** The categories shown for the active ones: «Strict necesare» always, an optional one only when its service is configured. */
export function categoriesFor(active: ConsentChoice): CategoryInfo[] {
  return CATEGORIES.filter((c) => c.key === 'necessary' || active[c.key]);
}
