/*
 * Shared by Noutăți, Știre and the sponsor page (app/(site)/sponsori imports from here).
 * Dates are read in Europe/Bucharest (the app's wall clock) and the month names are spelled here,
 * so the server HTML and the browser render the same string.
 */

const MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** fish `format(createdAt, 'dd MMMM yyyy', { locale: ro }).toUpperCase()` → «07 SEPTEMBRIE 2026». */
export function newsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(PARTS.formatToParts(d).map((p) => [p.type, p.value]));
  const day = String(parts.day).padStart(2, '0');
  const month = MONTHS[Number(parts.month) - 1] ?? '';
  return `${day} ${month} ${parts.year}`.toLocaleUpperCase('ro');
}

/** The CMS enumeration is stored without diacritics; the badge reads it in Romanian. */
const CATEGORY_LABEL: Record<string, string> = {
  Noutati: 'Noutăți',
  Evenimente: 'Evenimente',
  Interesant: 'Interesant',
  Concursuri: 'Concursuri',
  Tehnici: 'Tehnici',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}
