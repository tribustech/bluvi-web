import { describe, expect, it } from 'vitest';
import { bonusChances, chancesToWinUnit, leaveForIntro, statusReceiptBlock, statusCopy, totalWithReceiptLine, typeTileDisabled, typesNote } from './model';

describe('status model (participant.raffle-status)', () => {
  it('c2: bonus 2 with a receipt, else 0', () => {
    expect(bonusChances(true)).toBe(2);
    expect(bonusChances(false)).toBe(0);
  });

  it('c2: the unit agrees with the figure', () => {
    expect(chancesToWinUnit(1)).toBe('șansă de câștig');
    expect(chancesToWinUnit(3)).toBe('șanse de câștig');
    expect(chancesToWinUnit(20)).toBe('de șanse de câștig');
  });

  it('c2: the receipt line', () => {
    expect(totalWithReceiptLine(3)).toBe('Total șanse cu bon: 3 șanse');
  });

  it('c5: after the deadline only the chosen type stays on', () => {
    expect(typeTileDisabled('crap', 'crap', false)).toBe(false);
    expect(typeTileDisabled('feeder', 'crap', false)).toBe(true);
    expect(typeTileDisabled('feeder', 'crap', true)).toBe(false);
  });

  it('c5: the type card says one true thing — the body while it can change, the lock line instead after', () => {
    expect(typesNote({ canChangeType: true, isEnded: false })).toEqual({ text: statusCopy.typesBody, locked: false });
    expect(typesNote({ canChangeType: false, isEnded: false })).toEqual({ text: 'Termenul limită a trecut: tipul nu mai poate fi schimbat.', locked: true });
    expect(typesNote({ canChangeType: false, isEnded: true })).toEqual({ text: 'Tragerea s-a încheiat: tipul nu mai poate fi schimbat.', locked: true });
    expect(typesNote({ canChangeType: true, isEnded: true }).locked).toBe(true);
  });

  it('c7: receipt / upload before the end, nothing after it or without a session', () => {
    expect(statusReceiptBlock({ isEnded: false, receiptUploaded: true, sessionDocumentId: 's' })).toBe('receipt');
    expect(statusReceiptBlock({ isEnded: false, receiptUploaded: false, sessionDocumentId: 's' })).toBe('upload');
    expect(statusReceiptBlock({ isEnded: true, receiptUploaded: true, sessionDocumentId: 's' })).toBe(null);
    expect(statusReceiptBlock({ isEnded: false, receiptUploaded: false, sessionDocumentId: null })).toBe(null);
  });

  it('not joined → the intro, once settled', () => {
    expect(leaveForIntro({ joined: false }, { fetching: false })).toBe(true);
    expect(leaveForIntro({ joined: false }, { fetching: true })).toBe(false);
    expect(leaveForIntro({ joined: true }, { fetching: false })).toBe(false);
  });
});
