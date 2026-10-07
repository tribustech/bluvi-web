/** fish `features/chat/domain/format.ts` — ported verbatim (pure). */
const WEEKDAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** 24h clock on both platforms; the OS locale is never consulted. */
export function formatTime24(date?: Date): string {
  if (!date) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Date chip label. A missing date is a pending message, i.e. today. */
export function formatDayLabel(date: Date | undefined, now: Date = new Date()): string {
  if (!date) return 'Astăzi';
  const key = getDayKey(date);
  if (key === getDayKey(now)) return 'Astăzi';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === getDayKey(yesterday)) return 'Ieri';
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (date.getFullYear() !== now.getFullYear()) return `${dayMonth} ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]}, ${dayMonth}`;
}

/**
 * fish `helpers/formatCount.ts` (re-exported by chat's format.ts there).
 * Romanian cardinal + noun: 1 takes the singular, 2–19 the bare plural, and
 * from 20 up the noun is introduced by "de" — `24 de pescari` — unless the last
 * two digits fall between 01 and 19, where it is not: `101 pescari`.
 */
export function formatCount(count: number, singular: string, plural: string): string {
  const noun = pluralNoun(count, singular, plural);
  if (count === 1) return `1 ${noun}`;
  const lastTwo = count % 100;
  const needsDe = count >= 20 && (lastTwo === 0 || lastTwo >= 20);
  return needsDe ? `${count} de ${noun}` : `${count} ${noun}`;
}

/**
 * The noun alone for `count` (web): the label under a figure («partidă» / «partide»). The one
 * singular/plural choice formatCount also makes, so a label and an inline count never disagree;
 * inline, use formatCount (it adds the «de» from 20).
 */
export function pluralNoun(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
