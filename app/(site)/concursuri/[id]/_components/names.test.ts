import { describe, expect, it } from 'vitest';
import { echoes } from './names';

describe('echoes (a guest team’s members line that only repeats its name)', () => {
  it('is the same text once case, diacritics and spacing are set aside', () => {
    expect(echoes('Adi Critu si Seba', 'Adi Critu si Seba')).toBe(true);
    expect(echoes('Bibanul și Paul Sârbu', 'Bibanu si Paul Sarbu')).toBe(true);
  });
  it('is one cut short (an initial for the surname)', () => {
    expect(echoes('Florin Varjan si Petrisor Muraru', 'Florin Varjan si Petrisor M')).toBe(true);
    expect(echoes('Florin Varjan si Petrisor M', 'Florin Varjan si Petrisor Muraru')).toBe(true);
  });
  it('is not a different line', () => {
    expect(echoes('Ion și Vasile', 'Rechinii')).toBe(false);
    // A short prefix is not an echo («Ion» of «Ion Popescu și Vasile Ionescu»).
    expect(echoes('Ion', 'Ion Popescu și Vasile Ionescu')).toBe(false);
    expect(echoes('Echipa Crap', 'Echipa Crap Mare din Valea Argeșului')).toBe(false);
    expect(echoes('', 'Rechinii')).toBe(false);
  });
});
