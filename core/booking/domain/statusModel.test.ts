import { describe, expect, it } from 'vitest';
import { statusAppearance } from './statusModel';

describe('statusAppearance', () => {
  it('labels every status in Romanian', () => {
    expect(statusAppearance('pending').label).toBe('În așteptare');
    expect(statusAppearance('confirmed').label).toBe('Confirmată');
    expect(statusAppearance('rejected').label).toBe('Respinsă');
    expect(statusAppearance('cancelled').label).toBe('Anulată');
    expect(statusAppearance('completed').label).toBe('Încheiată');
  });

  it('marks only the dead states quiet', () => {
    expect(statusAppearance('pending').quiet).toBe(false);
    expect(statusAppearance('confirmed').quiet).toBe(false);
    expect(statusAppearance('completed').quiet).toBe(false);
    expect(statusAppearance('rejected').quiet).toBe(true);
    expect(statusAppearance('cancelled').quiet).toBe(true);
  });

  it('never uses a gray fill', () => {
    const grays = ['#F2F2F2', '#E5E5E5'];
    for (const s of ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'] as const) {
      expect(grays).not.toContain(statusAppearance(s).fill.toUpperCase());
    }
  });

  it('falls back to pending for an unknown status from the API', () => {
    expect(statusAppearance('something-new' as never).label).toBe('În așteptare');
  });

  it('names the other side of a cancellation, per viewer', () => {
    expect(statusAppearance('cancelled', { cancelledBy: 'angler', viewer: 'operator' }).label).toBe(
      'Anulată de pescar'
    );
    expect(statusAppearance('cancelled', { cancelledBy: 'operator', viewer: 'operator' }).label).toBe(
      'Anulată de tine'
    );
    expect(statusAppearance('cancelled', { cancelledBy: 'operator', viewer: 'angler' }).label).toBe(
      'Anulată de baltă'
    );
    expect(statusAppearance('cancelled', { cancelledBy: 'angler', viewer: 'angler' }).label).toBe(
      'Anulată de tine'
    );
    expect(statusAppearance('cancelled', { cancelledBy: 'system', viewer: 'operator' }).label).toBe(
      'Anulare automată'
    );
  });

  it('keeps the plain label for pre-attribution rows and for non-cancelled states', () => {
    expect(statusAppearance('cancelled', {}).label).toBe('Anulată');
    expect(statusAppearance('cancelled').label).toBe('Anulată');
    expect(statusAppearance('rejected', { cancelledBy: 'operator', viewer: 'operator' }).label).toBe('Respinsă');
  });

  it('keeps the cancelled tint whatever the attribution', () => {
    const plain = statusAppearance('cancelled');
    const attributed = statusAppearance('cancelled', { cancelledBy: 'operator', viewer: 'operator' });
    expect(attributed.fill).toBe(plain.fill);
    expect(attributed.border).toBe(plain.border);
    expect(attributed.quiet).toBe(true);
  });

  it('outlines completed only; cancelled is filled red like rejected', () => {
    expect(statusAppearance('completed').border).toBe('#E0E7FF');
    expect(statusAppearance('cancelled').border).toBeUndefined();
    expect(statusAppearance('cancelled').fill).toBe('#FEE4E2');
    expect(statusAppearance('pending').border).toBeUndefined();
    expect(statusAppearance('confirmed').border).toBeUndefined();
    expect(statusAppearance('rejected').border).toBeUndefined();
  });

  it('reports a no-show instead of the confirmed status it keeps server-side', () => {
    const a = statusAppearance('confirmed', { noShow: true });
    expect(a.label).toBe('Nu a venit');
    expect(a.quiet).toBe(true);
    expect(statusAppearance('confirmed', { noShow: false }).label).toBe('Confirmată');
    expect(statusAppearance('confirmed').label).toBe('Confirmată');
  });
});
