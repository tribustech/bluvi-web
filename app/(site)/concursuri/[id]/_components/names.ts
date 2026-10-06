/*
 * A guest team's two names — the team name and the members typed by the organizer — very often say
 * the same thing («Adi Critu si Seba» / «Adi Critu si Seba», «Florin Varjan si Petrisor M» /
 * «Florin Varjan si Petrisor Muraru»). Shared by Participanți and Cântare, so a list shows the
 * second line only when it adds something.
 */

/** Lower case, no diacritics, letters and digits only. */
function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('ro')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * The subtitle only echoes the name: the same text once case, diacritics, spacing and a letter or
 * two are set aside, or one is the other cut short (an initial for a surname).
 */
export function echoes(subtitle: string, name: string): boolean {
  const a = norm(subtitle);
  const b = norm(name);
  if (!a || !b) return false;
  if (a === b) return true;
  // One cut short: the shorter is most of the longer and starts it («petrisorm» / «petrisormuraru»).
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 8 && long.startsWith(short) && short.length >= long.length * 0.6) return true;
  // A near-copy (a typo apart): at most 2 edits, and under a tenth of the text.
  return Math.abs(a.length - b.length) <= 2 && editDistance(a, b) <= Math.min(2, Math.floor(Math.max(a.length, b.length) / 10));
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
