import { describe, expect, it } from 'vitest';
import { pickRest } from './sheet';

const rests = { peek: 120, half: 380, full: 760 };

describe('pickRest', () => {
  it('settles on the nearest rest when released still', () => {
    expect(pickRest(140, 0, rests)).toBe('peek');
    expect(pickRest(400, 0, rests)).toBe('half');
    expect(pickRest(700, 0, rests)).toBe('full');
  });
  it('a flick carries the sheet on in its direction', () => {
    // From half, a quick upward flick (negative = up) lands on full though it barely moved.
    expect(pickRest(450, -2, rests)).toBe('full');
    // A quick downward flick from half drops to the peek.
    expect(pickRest(330, 1.5, rests)).toBe('peek');
  });
  it('a slow drag keeps the nearest rest', () => {
    expect(pickRest(420, -0.1, rests)).toBe('half');
  });
});
