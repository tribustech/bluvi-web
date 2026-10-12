import { describe, expect, it } from 'vitest';
import { bannerText, categoriesFor } from './catalog';
import { acceptAll, anyActive } from './configured';

const NONE = { analytics: false, errors: false };
const BOTH = { analytics: true, errors: true };

describe('consent categories follow the configured services (owner rule 4)', () => {
  it('lists only «Strict necesare» when nothing is configured', () => {
    expect(categoriesFor(NONE).map((c) => c.key)).toEqual(['necessary']);
    expect(anyActive(NONE)).toBe(false);
  });
  it('adds a category only for its configured service', () => {
    expect(categoriesFor({ analytics: true, errors: false }).map((c) => c.key)).toEqual(['necessary', 'analytics']);
    expect(categoriesFor({ analytics: false, errors: true }).map((c) => c.key)).toEqual(['necessary', 'errors']);
    expect(categoriesFor(BOTH).map((c) => c.key)).toEqual(['necessary', 'analytics', 'errors']);
  });
  it('«Accept toate» never turns on a category that is not configured', () => {
    expect(acceptAll({ analytics: true, errors: false })).toEqual({ analytics: true, errors: false });
    expect(acceptAll(BOTH)).toEqual(BOTH);
  });
  it('the banner sentence names only the active uses, without service names', () => {
    expect(bannerText(BOTH)).toBe('Unele cookie-uri sunt necesare ca Bluvi să funcționeze. Altele ne ajută, doar dacă ești de acord, cu statistici de utilizare și raportarea erorilor.');
    expect(bannerText({ analytics: true, errors: false })).toMatch(/acord, cu statistici de utilizare\.$/);
    expect(bannerText({ analytics: false, errors: true })).toMatch(/acord, cu raportarea erorilor\.$/);
    for (const a of [BOTH, { analytics: true, errors: false }]) expect(bannerText(a)).not.toMatch(/Google|Sentry/);
  });
});
