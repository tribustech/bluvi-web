import { describe, expect, it } from 'vitest';
import { receiptDialogTitle } from '../../_shared/copy';
import { receiptModeFromParam } from './mode';

describe('receiptModeFromParam (participant.raffle-upload-receipt.c1/c2)', () => {
  it('maps the Romanian query to fish modes, anything else is first', () => {
    expect(receiptModeFromParam('adauga')).toBe('add');
    expect(receiptModeFromParam('inlocuieste')).toBe('replace');
    expect(receiptModeFromParam(undefined)).toBe('first');
    expect(receiptModeFromParam('replace')).toBe('first');
    expect(receiptModeFromParam('')).toBe('first');
  });

  it('titles per mode', () => {
    expect(receiptDialogTitle(receiptModeFromParam('adauga'))).toBe('Adaugă bon fiscal');
    expect(receiptDialogTitle(receiptModeFromParam('inlocuieste'))).toBe('Înlocuiește bonul fiscal');
    expect(receiptDialogTitle(receiptModeFromParam('x'))).toBe('Încarcă bonul fiscal');
  });
});
