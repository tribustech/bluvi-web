import { describe, expect, it } from 'vitest';
import { chancesUnit, factLabel, receiptBreakdown } from './breakdown';

describe('receiptBreakdown (participant.raffle-receipt-submitted c2 c3)', () => {
  it('under verification, not yet uploaded: verifying line, «Bonus (în așteptare)» 2, total 3', () => {
    expect(receiptBreakdown({ receiptUploaded: false, receiptUnderVerification: true, entriesCount: 1 })).toEqual({
      message: 'Bonul tău este în curs de verificare.',
      approved: false,
      previous: 1,
      bonusLabel: 'Bonus (în așteptare)',
      bonus: 2,
      bonusPending: true,
      total: 3,
    });
  });

  it('approved (what the CMS answers after an upload): approved line, «Bonus» 2, total = entries', () => {
    expect(receiptBreakdown({ receiptUploaded: true, receiptUnderVerification: false, entriesCount: 3 })).toEqual({
      message: 'Bonul a fost aprobat! Ai primit 2 șanse bonus.',
      approved: true,
      previous: 1,
      bonusLabel: 'Bonus',
      bonus: 2,
      bonusPending: false,
      total: 3,
    });
  });

  it('total follows the entries count once approved (fish entriesCount, not a fixed 3)', () => {
    expect(receiptBreakdown({ receiptUploaded: true, receiptUnderVerification: false, entriesCount: 5 }).total).toBe(5);
  });

  it('both flags: the message is approved (receiptUploaded), the bonus still pending and the total 3, as fish', () => {
    const b = receiptBreakdown({ receiptUploaded: true, receiptUnderVerification: true, entriesCount: 7 });
    expect(b.message).toBe('Bonul a fost aprobat! Ai primit 2 șanse bonus.');
    expect(b.bonusLabel).toBe('Bonus (în așteptare)');
    expect(b.bonus).toBe(2);
    expect(b.total).toBe(3);
  });

  it('no receipt at all: verifying line (fish), «Bonus» 0, total = entries', () => {
    const b = receiptBreakdown({ receiptUploaded: false, receiptUnderVerification: false, entriesCount: 1 });
    expect(b.message).toBe('Bonul tău este în curs de verificare.');
    expect([b.bonusLabel, b.bonus, b.total]).toEqual(['Bonus', 0, 1]);
  });
});

describe('chancesUnit / factLabel', () => {
  it('agrees with the figure', () => {
    expect(chancesUnit(1)).toBe('șansă');
    expect(chancesUnit(0)).toBe('șanse');
    expect(chancesUnit(3)).toBe('șanse');
    expect(chancesUnit(20)).toBe('de șanse');
    expect(chancesUnit(101)).toBe('șanse');
  });
  it('one phrase per tile', () => {
    expect(factLabel('Total', 3)).toBe('Total: 3 șanse');
    expect(factLabel('Înainte', 1)).toBe('Înainte: 1 șansă');
  });
});
