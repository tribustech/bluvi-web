/*
 * Romanian number formatting for cards and ranking. Hand-rolled instead of Intl so server and
 * client render the exact same string (no ICU drift → no hydration mismatch).
 */

/** 1240 → "1.240" (dot thousands separator). */
export function formatInt(n: number): string {
  const sign = n < 0 ? '−' : '';
  const digits = Math.round(Math.abs(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Decimal with a comma, trailing zeros trimmed down to `minDecimals`.
 * formatDecimal(86.4) → "86,4", formatDecimal(52) → "52,0", formatDecimal(12.345) → "12,345".
 */
export function formatDecimal(n: number, minDecimals = 1, maxDecimals = 3): string {
  const fixed = Math.abs(n).toFixed(maxDecimals);
  let [int, frac = ''] = fixed.split('.');
  frac = frac.replace(/0+$/, '');
  while (frac.length < minDecimals) frac += '0';
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + (frac ? `${int},${frac}` : int);
}

/**
 * Romanian count agreement: 1 captură · 2–19 capturi · 20+ de capturi (also 101, 120…: "de" when
 * the last two digits are 0 or ≥ 20).
 */
export function plural(n: number, one: string, few: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = Math.abs(n) % 100;
  const useDe = n !== 0 && (rest === 0 || rest >= 20);
  return `${formatInt(n)} ${useDe ? 'de ' : ''}${few}`;
}
