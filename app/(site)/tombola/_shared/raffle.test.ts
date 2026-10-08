import { describe, expect, it } from 'vitest';
import { badgeTextOn, contrast, parseCssColor } from './badge';
import {
  chancesLabel,
  joinBlocker,
  prizeSubtitle,
  prizesToShow,
  prizeTypeLabel,
  raffleCopy,
  receiptDialogTitle,
  registrationsLabel,
  showReceiptPreview,
  STATIC_PRIZES,
} from './copy';
import { introRedirect } from './useRaffle';
import { phoneError } from '../_intro/PhonePromptDialog';

describe('receipt upload dialog (participant.raffle-upload-receipt.c2 c3)', () => {
  it('titles per mode', () => {
    expect(receiptDialogTitle('first')).toBe('Încarcă bonul fiscal');
    expect(receiptDialogTitle('add')).toBe('Adaugă bon fiscal');
    expect(receiptDialogTitle('replace')).toBe('Înlocuiește bonul fiscal');
  });
  it('previews the uploaded receipt only when replacing one', () => {
    expect(showReceiptPreview('replace', true, 'https://x/r.jpg')).toBe(true);
    expect(showReceiptPreview('replace', false, 'https://x/r.jpg')).toBe(false);
    expect(showReceiptPreview('replace', true, null)).toBe(false);
    expect(showReceiptPreview('add', true, 'https://x/r.jpg')).toBe(false);
    expect(showReceiptPreview('first', true, 'https://x/r.jpg')).toBe(false);
  });
});

describe('registrations and type labels', () => {
  it('«înscris» singular, plural, «de» from 20 (fish wrote «1 înscriși»)', () => {
    expect(registrationsLabel(1)).toBe('1 înscris');
    expect(registrationsLabel(2)).toBe('2 înscriși');
    expect(registrationsLabel(20)).toBe('20 de înscriși');
  });
  it('the session label first, else the static key with its diacritics', () => {
    expect(prizeTypeLabel('rapitor', 'Răpitor CMS')).toBe('Răpitor CMS');
    expect(prizeTypeLabel('rapitor', undefined)).toBe('Răpitor');
    expect(prizeTypeLabel('crap', null)).toBe('Crap');
    expect(prizeTypeLabel('feeder', undefined)).toBe('Feeder');
    expect(prizeTypeLabel('altul', undefined)).toBe('altul');
    expect(prizeTypeLabel(null, undefined)).toBe('');
  });
  it('the summary before a type is picked (fish «Nealeas»)', () => {
    expect(raffleCopy.intro.summaryTypeNone).toBe('Nu ai ales încă');
  });
});

describe('chances copy', () => {
  it('singular, plural, «de» from 20', () => {
    expect(chancesLabel(1)).toBe('1 șansă');
    expect(chancesLabel(3)).toBe('3 șanse');
    expect(chancesLabel(20)).toBe('20 de șanse');
  });
  it('prize items toggle', () => {
    expect(raffleCopy.prizeItems.countLabel(1)).toBe('1 produs');
    expect(raffleCopy.prizeItems.countLabel(2)).toBe('2 produse');
  });
});

describe('prizes (c5 c6)', () => {
  it('session prizes, else the static ones', () => {
    expect(prizesToShow([])).toEqual({ prizes: STATIC_PRIZES, fromSession: false });
    const own = [{ title: 'Kit', count: 1, typeKey: 'crap' }];
    expect(prizesToShow(own)).toEqual({ prizes: own, fromSession: true });
    expect(STATIC_PRIZES.map((p) => p.title)).toEqual(['Echipament premium de pescuit', 'Merchandise Bluvi', 'Premii speciale expoziție']);
  });
  it('subtitle', () => {
    expect(prizeSubtitle({ description: 'Mulinetă', priceLei: 500, count: 2 })).toBe('Mulinetă · 500 LEI × 2');
    expect(prizeSubtitle({ priceLei: 150, count: 5 })).toBe('150 LEI × 5');
    expect(prizeSubtitle({ description: 'Doar text', priceLei: null, count: 1 })).toBe('Doar text');
    expect(prizeSubtitle({ count: 1 })).toBeNull();
  });
});

describe('join checks in fish order (c12)', () => {
  const ok = { regulationAccepted: true, isRegistrationOpen: true, selectedTypeKey: 'crap' };
  it('regulation, then closed, then type', () => {
    expect(joinBlocker({ regulationAccepted: false, isRegistrationOpen: false, selectedTypeKey: null })).toBe('regulation');
    expect(joinBlocker({ ...ok, isRegistrationOpen: false, selectedTypeKey: null })).toBe('closed');
    expect(joinBlocker({ ...ok, selectedTypeKey: null })).toBe('type');
    expect(joinBlocker(ok)).toBeNull();
  });
});

describe('phone (c13)', () => {
  it('required, then min 7', () => {
    expect(phoneError('')).toBe('Introdu numărul de telefon');
    expect(phoneError('0712')).toBe('Minim 7 caractere');
    expect(phoneError('0712345678')).toBeNull();
  });
});

describe('redirects (c1)', () => {
  const base = { joined: false, sessionDocumentId: 's1', isEnded: false, hasWinners: false };
  it('fish order', () => {
    expect(introRedirect(base)).toBeNull();
    expect(introRedirect({ ...base, joined: true })).toBe('home');
    expect(introRedirect({ ...base, sessionDocumentId: null })).toBe('home');
    expect(introRedirect({ ...base, isEnded: true, hasWinners: true })).toBe('winners');
    expect(introRedirect({ ...base, isEnded: true })).toBe('home');
    expect(introRedirect({ ...base, joined: true, isEnded: true, hasWinners: true })).toBe('home');
  });
});

describe('type badge contrast', () => {
  it('parses hex and rgb', () => {
    expect(parseCssColor('#FFC107')).toEqual([255, 193, 7]);
    expect(parseCssColor('#0f0')).toEqual([0, 255, 0]);
    expect(parseCssColor('rgb(0, 128, 0)')).toEqual([0, 128, 0]);
    expect(parseCssColor('blue')).toBeNull();
  });
  it('the label is always AA', () => {
    for (const c of ['#FFC107', '#0000ff', '#008000', '#6366f1', '#ffffff', '#000000', '#777777']) {
      const bg = parseCssColor(c)!;
      const fg = badgeTextOn(bg).match(/\d+/g)!.map(Number) as [number, number, number];
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(badgeTextOn([255, 193, 7])).not.toBe('rgb(255 255 255)');
    expect(badgeTextOn([0, 0, 255])).toBe('rgb(255 255 255)');
  });
});
