/*
 * Small formatters for Acasă. Dates are read in Europe/Bucharest (the app's wall clock) and the
 * month names are spelled here, so server and browser render the same string.
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

const BUCHAREST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function bucharestParts(iso: string): { day: number; month: number; year: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(BUCHAREST.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: Number(parts.day), month: Number(parts.month), year: Number(parts.year) };
}

/** fish NewsCard: `format(createdAt, 'dd MMMM yyyy', ro).toUpperCase()` → «28 SEPTEMBRIE 2026». */
export function newsDate(iso: string): string {
  const p = bucharestParts(iso);
  if (!p) return '';
  return `${String(p.day).padStart(2, '0')} ${MONTHS[p.month - 1]} ${p.year}`.toUpperCase();
}

/** fish OwnedLakesCard `waitedLabel`: «de 2 ore» / «de 40 min». */
export function waitedLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `de ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `de ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
  const days = Math.floor(hours / 24);
  return `de ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

/**
 * Design (desktop poll footer) «se închide în 3 zile» — time left until `closesAt`, coarse on
 * purpose (days, then hours) so the server and the browser agree. null when already past.
 */
export function closesInLabel(closesAt: string | null, now = Date.now()): string | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'se închide în mai puțin de o oră';
  if (hours < 24) return `se închide în ${hours === 1 ? 'o oră' : `${hours} ore`}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'se închide mâine';
  return `se închide în ${days}${days % 100 >= 20 || (days % 100 === 0 && days > 0) ? ' de' : ''} zile`;
}
