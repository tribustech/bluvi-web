/** fish `features/chat/domain/linkify.ts` — ported verbatim (pure). */
export type LinkToken = { kind: 'text' | 'url' | 'phone'; value: string; href: string };

// URLs: scheme or www., up to whitespace. Phones: RO mobile/landline 07xx/02xx/03xx with optional
// spaces/dots/dashes, or +40 followed by 9 digits. Times like 07:30 do not match (colon).
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const PHONE_RE = /(?:\+40[\s.-]?\d(?:[\s.-]?\d){8}|\b0[237]\d{2}(?:[\s.-]?\d{3}){2}\b)/g;
const TRAILING_PUNCT = /[.,;:!?)]+$/;

export function linkify(text: string): LinkToken[] {
  const matches: { start: number; end: number; kind: 'url' | 'phone'; value: string }[] = [];
  for (const match of text.matchAll(URL_RE)) {
    let value = match[0];
    const trimmed = value.replace(TRAILING_PUNCT, '');
    value = trimmed.length ? trimmed : value;
    matches.push({ start: match.index!, end: match.index! + value.length, kind: 'url', value });
  }
  for (const match of text.matchAll(PHONE_RE)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (matches.some(m => start < m.end && end > m.start)) continue;
    matches.push({ start, end, kind: 'phone', value: match[0] });
  }
  matches.sort((a, b) => a.start - b.start);

  const tokens: LinkToken[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) tokens.push({ kind: 'text', value: text.slice(cursor, m.start), href: '' });
    tokens.push({
      kind: m.kind,
      value: m.value,
      href:
        m.kind === 'url'
          ? m.value.toLowerCase().startsWith('www.')
            ? `https://${m.value}`
            : m.value
          : `tel:${m.value.replace(/[\s.-]/g, '')}`,
    });
    cursor = m.end;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor), href: '' });
  return tokens.length ? tokens : [{ kind: 'text', value: text, href: '' }];
}
