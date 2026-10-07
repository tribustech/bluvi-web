import { clampWeight, fmtKg, MAX_WEIGHT_KG } from '@/core/partide';

/*
 * The weight keypad's typing rules (fish app/(app)/partide/captura.tsx WeightKeypad): the RAW typed
 * string is the display while the keypad is open — a formatted number cannot show "3," — and the
 * parsed weight follows it. Comma decimal, at most three decimals, at most five digits, never past
 * 60 kg: a refused key returns null (the caller marks it refused), it never snaps back on commit.
 */

export const MAX_DECIMALS = 3;
const MAX_DIGITS = 5;

/** A digit pressed, or null when the key is refused. */
export function pressDigit(buffer: string, digit: string): string | null {
  const comma = buffer.indexOf(',');
  if (comma >= 0 && buffer.length - comma > MAX_DECIMALS) return null;
  if (buffer.replace(',', '').length >= MAX_DIGITS) return null;
  const next = buffer + digit;
  const parsed = Number(next.replace(',', '.'));
  if (Number.isFinite(parsed) && parsed > MAX_WEIGHT_KG) return null;
  return next;
}

/** The comma is only ever added by pressing it — never seeded, never implied. */
export const pressComma = (buffer: string): string => (buffer.includes(',') ? buffer : `${buffer || '0'},`);

/** Deletes whatever is last, comma included. */
export const backspace = (buffer: string): string => buffer.slice(0, -1);

/** The weight a typed string stands for (null = nothing typed). */
export function bufferToWeight(buffer: string): number | null {
  const parsed = Number(buffer.replace(',', '.'));
  return buffer && Number.isFinite(parsed) ? clampWeight(parsed) : null;
}

/** Seed as the user would have typed it: 3 kg is "3", not "3,0". */
export const seedBuffer = (weight: number | null): string => (weight == null ? '' : fmtKg(weight).replace(/,0$/, ''));

/** The empty decimal slots shown in grey behind a typed comma ("3," → "000"). */
export function decimalPlaceholder(buffer: string): string {
  const comma = buffer.indexOf(',');
  if (comma < 0) return '';
  return '0'.repeat(Math.max(0, MAX_DECIMALS - (buffer.length - comma - 1)));
}
