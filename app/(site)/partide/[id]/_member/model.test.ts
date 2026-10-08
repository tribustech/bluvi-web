import { describe, expect, it } from 'vitest';
import { rodsLabel } from './model';

// Owner rule: Romanian plurals by formatCount — «de» from 20 (except …01–…19), over fish's verbatim
// «20 lansete».
describe('member view plurals (formatCount)', () => {
  it('rodsLabel: 1 / 2 / 19 / 20 / 101', () => {
    expect([1, 2, 19, 20, 101].map(rodsLabel)).toEqual(['1 lansetă', '2 lansete', '19 lansete', '20 de lansete', '101 lansete']);
  });
});
