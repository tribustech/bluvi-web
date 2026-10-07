import { describe, expect, it } from 'vitest';
import { lossSummary } from '@/components/partide/dialogs/DeletePartidaDialog';
import { rodsLabel } from './model';

// Owner rule: Romanian plurals by formatCount — «de» from 20 (except …01–…19), over fish's verbatim
// «25 capturi» / «Cei 20 coechipieri» / «20 lansete».
describe('member view plurals (formatCount)', () => {
  it('rodsLabel: 1 / 2 / 19 / 20 / 101', () => {
    expect([1, 2, 19, 20, 101].map(rodsLabel)).toEqual(['1 lansetă', '2 lansete', '19 lansete', '20 de lansete', '101 lansete']);
  });

  it('lossSummary captures: o captură / 2 / 19 / 20 de / 101', () => {
    const lost = (n: number) => lossSummary(n, 0, 0);
    expect(lost(1)).toBe('Se șterg definitiv o captură, împreună cu tot jurnalul partidei. Acțiunea nu poate fi anulată.');
    expect(lost(2)).toContain('definitiv 2 capturi,');
    expect(lost(19)).toContain('definitiv 19 capturi,');
    expect(lost(20)).toContain('definitiv 20 de capturi,');
    expect(lost(25)).toContain('definitiv 25 de capturi,');
    expect(lost(101)).toContain('definitiv 101 capturi,');
  });

  it('lossSummary photos: o fotografie / 2 / 19 / 20 de / 101', () => {
    expect(lossSummary(1, 1, 0)).toContain('o captură și o fotografie,');
    expect(lossSummary(3, 2, 0)).toContain('3 capturi și 2 fotografii,');
    expect(lossSummary(3, 19, 0)).toContain('și 19 fotografii,');
    expect(lossSummary(30, 20, 0)).toContain('30 de capturi și 20 de fotografii,');
    expect(lossSummary(3, 101, 0)).toContain('și 101 fotografii,');
  });

  it('lossSummary teammates: Coechipierul / Cei 2 / 19 / 20 de / 101', () => {
    expect(lossSummary(0, 0, 0)).toBe('Se șterge definitiv tot jurnalul partidei. Acțiunea nu poate fi anulată.');
    expect(lossSummary(0, 0, 1)).toContain(' Coechipierul tău pierde și el accesul și capturile lui.');
    expect(lossSummary(0, 0, 2)).toContain(' Cei 2 coechipieri pierd și ei accesul și capturile lor.');
    expect(lossSummary(0, 0, 19)).toContain(' Cei 19 coechipieri pierd');
    expect(lossSummary(0, 0, 20)).toContain(' Cei 20 de coechipieri pierd');
    expect(lossSummary(0, 0, 101)).toContain(' Cei 101 coechipieri pierd');
  });
});
