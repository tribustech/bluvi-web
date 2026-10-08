import { describe, expect, it } from 'vitest';
import { RECEIPT_DELETE_FAILED, RECEIPT_NO_IMAGE, receiptCardModel } from './ReceiptCard';

describe('ReceiptCard model (participant.raffle-confirmation.c6 c7 c8)', () => {
  it('shows the image when there is a URL', () => {
    const m = receiptCardModel({ imageUrl: 'https://x/bon.jpg', canChange: true });
    expect(m.imageUrl).toBe('https://x/bon.jpg');
    expect(m.fallback).toBeNull();
  });

  it('falls back to fish’s line without a URL (null or blank)', () => {
    for (const imageUrl of [null, '', '   ']) {
      const m = receiptCardModel({ imageUrl, canChange: true });
      expect(m.imageUrl).toBeNull();
      expect(m.fallback).toBe(RECEIPT_NO_IMAGE);
    }
    expect(RECEIPT_NO_IMAGE).toBe('Bon încărcat. Poți înlocui sau șterge până la termenul limită.');
  });

  it('while it can change: both actions on, no cutoff hint', () => {
    const m = receiptCardModel({ imageUrl: null, canChange: true });
    expect(m).toMatchObject({ cutoffHint: null, replaceDisabled: false, deleteDisabled: false });
  });

  it('after the deadline: both off, with the hint (c7)', () => {
    const m = receiptCardModel({ imageUrl: null, canChange: false });
    expect(m).toMatchObject({ cutoffHint: 'Nu mai poți modifica bonul după termenul limită.', replaceDisabled: true, deleteDisabled: true });
  });

  it('deleting: delete off, replace still on (fish disabled={deleting || !canChangeType})', () => {
    const m = receiptCardModel({ imageUrl: null, canChange: true, deleting: true });
    expect(m).toMatchObject({ replaceDisabled: false, deleteDisabled: true });
  });

  it('a failed delete has a message (fish is silent, c8)', () => {
    expect(RECEIPT_DELETE_FAILED).toMatch(/^Nu am putut șterge bonul/);
  });
});
