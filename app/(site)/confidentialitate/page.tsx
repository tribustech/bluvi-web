import { PRIVACY } from '@/lib/legal/privacy';
import { routes } from '@/lib/routes';
import { LegalDocument, legalMetadata } from '../_legal/LegalDocument';

/* /confidentialitate — Politica de confidențialitate (lib/legal/privacy.ts); every privacy link points here. */
export const metadata = legalMetadata(PRIVACY, routes.privacy());

export default function PrivacyPage() {
  return <LegalDocument doc={PRIVACY} path={routes.privacy()} />;
}
