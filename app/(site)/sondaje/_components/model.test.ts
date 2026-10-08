import { describe, expect, it } from 'vitest';
import { canSuggest, pendingIsDashed, pollPercent, pollShareText, pressOption, submitLabel, voteEvent } from './model';

const base = { optionId: 2, closed: false, signedIn: true, myVote: null as number | null, pending: null as number | null };

describe('participant.poll-current model', () => {
  it('c6 percentage: rounded, 0 without votes', () => {
    expect(pollPercent(1, 3)).toBe(33);
    expect(pollPercent(2, 3)).toBe(67);
    expect(pollPercent(0, 0)).toBe(0);
    expect(pollPercent(5, 5)).toBe(100);
  });

  it('c7 option press, in fish order', () => {
    expect(pressOption({ ...base, closed: true, signedIn: false })).toEqual({ kind: 'none' });
    expect(pressOption({ ...base, signedIn: false })).toEqual({ kind: 'sign-in' });
    expect(pressOption({ ...base, myVote: 2 })).toEqual({ kind: 'none' });
    expect(pressOption({ ...base, pending: 2 })).toEqual({ kind: 'pending', pending: null });
    expect(pressOption(base)).toEqual({ kind: 'pending', pending: 2 });
    // My vote again while another option is pending: it becomes the pending one (fish).
    expect(pressOption({ ...base, myVote: 2, pending: 3 })).toEqual({ kind: 'pending', pending: 2 });
  });

  it('c8 inline button label; dashed pending row', () => {
    expect(submitLabel(null)).toBe('Votează');
    expect(submitLabel(4)).toBe('Schimbă votul');
    expect(pendingIsDashed(true, false)).toBe(true);
    expect(pendingIsDashed(true, true)).toBe(false);
    expect(pendingIsDashed(false, false)).toBe(false);
  });

  it('c15 vote event name', () => {
    expect(voteEvent(null, 1)).toBe('poll_vote');
    expect(voteEvent(1, 1)).toBe('poll_vote');
    expect(voteEvent(2, 1)).toBe('poll_vote_change');
  });

  it('c10 suggestion length gate (trimmed 3–200, not while sending)', () => {
    expect(canSuggest('  ab  ', false)).toBe(false);
    expect(canSuggest(' abc ', false)).toBe(true);
    expect(canSuggest('abc', true)).toBe(false);
    expect(canSuggest('x'.repeat(200), false)).toBe(true);
    expect(canSuggest('x'.repeat(201), false)).toBe(false);
  });

  it('c14 share text (no emoji, as home.acasa.c35)', () => {
    expect(pollShareText('Care baltă?')).toBe('Votează în sondajul comunității Bluvi:\n\nCare baltă?');
  });
});
