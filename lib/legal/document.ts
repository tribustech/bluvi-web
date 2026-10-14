/*
 * The legal documents (owner 2026-10-14: Termly dropped the hosted policies, they live on bluvi.ro
 * now) as data: /termeni and /confidentialitate render them with app/(site)/_legal/LegalDocument.tsx,
 * and the mobile app links to those pages. Plain text only — a paragraph, or a list of items; a
 * `**bold**` lead-in is the one inline mark. Edit the text here; the date moves with it.
 */

export type LegalBlock = string | { list: string[] };

export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };

export type LegalDocument = {
  title: string;
  description: string;
  /** «14 octombrie 2026» and its ISO date. */
  updated: string;
  updatedIso: string;
  intro: LegalBlock[];
  sections: LegalSection[];
};

/** The operator, as the documents name it (ANAF registry, CUI RO42291622). */
export const OPERATOR = {
  name: 'TRIBUS TECHNOLOGIES S.R.L.',
  cui: 'RO42291622',
  regCom: 'J2020002414403',
  address: 'Calea Vitan nr. 199, bl. 52, sc. 2, et. 3, ap. 37, cam. 1, Sector 3, București, România',
  email: 'contact@bluvi.ro',
} as const;
