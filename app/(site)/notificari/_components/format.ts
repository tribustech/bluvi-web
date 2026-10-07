/*
 * The sent time of a notification (account.notifications.c6; fish notifications.tsx:170-174,
 * date-fns `d MMMM, 'ora' HH:mm` with the ro locale, `d MMMM yyyy, 'ora' HH:mm` when the year is
 * not the current one): «3 octombrie, ora 21:31», «28 decembrie 2025, ora 09:05».
 * fish formats in the phone's zone; the web formats in Romania's (Europe/Bucharest), so a reader
 * abroad and the server agree with what the app shows at home.
 */
const TZ = 'Europe/Bucharest';

const PARTS = new Intl.DateTimeFormat('ro-RO', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(date: Date) {
  const p = Object.fromEntries(PARTS.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: p.day, month: p.month, year: p.year, hour: p.hour, minute: p.minute };
}

export function formatNotificationTime(sentAt: string, now: Date = new Date()): string {
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return '';
  const d = parts(date);
  const year = d.year === parts(now).year ? '' : ` ${d.year}`;
  return `${d.day} ${d.month}${year}, ora ${d.hour}:${d.minute}`;
}
