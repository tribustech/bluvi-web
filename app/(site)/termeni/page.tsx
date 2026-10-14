import { TERMS } from '@/lib/legal/terms';
import { routes } from '@/lib/routes';
import { LegalDocument, legalMetadata } from '../_legal/LegalDocument';

/* /termeni — Termeni și condiții (lib/legal/terms.ts); the app's sign-in and Setări link here. */
export const metadata = legalMetadata(TERMS, routes.terms());

export default function TermsPage() {
  return <LegalDocument doc={TERMS} path={routes.terms()} />;
}
