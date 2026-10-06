import { describe, expect, it } from 'vitest';
import { getRegistrationByStandId, getRosterDocumentIds } from './roster';

describe('roster (fish getRosterDocumentIds / getRegistrationByStandId)', () => {
  it('keeps only members with an account', () => {
    expect(getRosterDocumentIds(null)).toEqual([]);
    expect(getRosterDocumentIds({ participants: null })).toEqual([]);
    expect(getRosterDocumentIds({ participants: [{ documentId: 'a' }, { documentId: '' }, null, { documentId: null }, { documentId: 'b' }] })).toEqual(['a', 'b']);
  });

  it('finds the registration on a stand by its numeric id, sent as number or string', () => {
    const regs = [{ documentId: 'r1', stand: { id: 7 } }, { documentId: 'r2', stand: null }, { documentId: 'r3', stand: { id: 12 } }];
    expect(getRegistrationByStandId(regs, 12)?.documentId).toBe('r3');
    expect(getRegistrationByStandId(regs, '7')?.documentId).toBe('r1');
    expect(getRegistrationByStandId(regs, 99)).toBeNull();
    expect(getRegistrationByStandId(regs, null)).toBeNull();
    expect(getRegistrationByStandId(undefined, 7)).toBeNull();
  });
});
