import { describe, expect, it } from 'vitest';
import { chancesUnit, confirmationHeading, firstUploadIsFinal, notJoinedRedirect, receiptBlock, showWinnersLink } from './model';

const types = [
  { key: 'crap', label: 'Crap', description: null, badgeColor: null },
  { key: 'feeder', label: 'Feeder', description: null, badgeColor: null },
];

describe('confirmation model (participant.raffle-confirmation)', () => {
  it('c3: the noun after the figure, «de» from 20 (formatCount)', () => {
    expect(chancesUnit(0)).toBe('șanse');
    expect(chancesUnit(1)).toBe('șansă');
    expect(chancesUnit(3)).toBe('șanse');
    expect(chancesUnit(19)).toBe('șanse');
    expect(chancesUnit(20)).toBe('de șanse');
    expect(chancesUnit(101)).toBe('șanse');
  });

  it('c2: heading with the type label, the raw key (fish), or none', () => {
    expect(confirmationHeading({ types, selectedTypeKey: 'crap' })).toBe('Ești înscris în tragerea la sorți pentru categoria Crap!');
    expect(confirmationHeading({ types, selectedTypeKey: 'rapitor' })).toBe('Ești înscris în tragerea la sorți pentru categoria rapitor!');
    expect(confirmationHeading({ types, selectedTypeKey: null })).toBe('Ești înscris în tragerea la sorți!');
  });

  it('c5 c6: upload card / receipt card before the end; nothing after it, without a session or not joined', () => {
    const base = { isEnded: false, receiptUploaded: false, sessionDocumentId: 's', joined: true };
    expect(receiptBlock(base)).toBe('upload');
    expect(receiptBlock({ ...base, receiptUploaded: true })).toBe('receipt');
    expect(receiptBlock({ ...base, isEnded: true, receiptUploaded: true })).toBeNull();
    expect(receiptBlock({ ...base, sessionDocumentId: null })).toBeNull();
    // The CMS answers 400 «Trebuie să te înscrii…» to an upload without a participation.
    expect(receiptBlock({ ...base, joined: false })).toBeNull();
  });

  it('c5 c7: a first upload after registration closes is final (no replace / delete after it)', () => {
    expect(firstUploadIsFinal({ canChangeType: true })).toBe(false);
    expect(firstUploadIsFinal({ canChangeType: false })).toBe(true);
  });

  it('not joined → the intro, but only on settled data (a join’s refetch may be in flight)', () => {
    expect(notJoinedRedirect({ joined: false }, { fetching: false })).toBe(true);
    expect(notJoinedRedirect({ joined: false }, { fetching: true })).toBe(false);
    expect(notJoinedRedirect({ joined: true }, { fetching: false })).toBe(false);
  });

  it('c9: winners link only when ended with winners', () => {
    expect(showWinnersLink({ isEnded: true, hasWinners: true })).toBe(true);
    expect(showWinnersLink({ isEnded: true, hasWinners: false })).toBe(false);
    expect(showWinnersLink({ isEnded: false, hasWinners: true })).toBe(false);
  });
});
