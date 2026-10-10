import { describe, expect, it } from 'vitest';
import { anglerDescription, anglerJsonLd } from './seo';

const S = 'http://localhost:3000';
const base = {
  documentId: 'a1',
  username: 'Ion Pop',
  avatarUrl: 'https://cdn/av.jpg',
  bio: null as string | null,
  memberSince: '2025-03-01T10:00:00.000Z',
  counts: { followers: 21, following: 2, catches: 1, sessions: 3, competitions: 0 },
  biggestCatch: null,
  podium: { first: 0, second: 0, third: 0 },
};

describe('anglerDescription', () => {
  it('the bio when there is one, after the name', () => {
    expect(anglerDescription({ ...base, bio: 'Crap  la\nfeeder.' })).toBe('Ion Pop: Crap la feeder.');
  });
  it('else the public counts (zeros left out, RO plurals)', () => {
    expect(anglerDescription(base)).toBe('Ion Pop pe Bluvi: 3 partide, 1 captură. Capturile, partidele și concursurile pescarului.');
    expect(anglerDescription({ ...base, counts: { ...base.counts, sessions: 0, catches: 0 } })).toBe(
      'Ion Pop pe Bluvi. Capturile, partidele și concursurile pescarului.',
    );
  });
  it('at most 160 characters', () => {
    const d = anglerDescription({ ...base, bio: 'x'.repeat(400) });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith('…')).toBe(true);
  });
});

describe('anglerJsonLd', () => {
  it('a ProfilePage whose mainEntity is the Person', () => {
    expect(anglerJsonLd({ ...base, bio: 'Feeder.' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: `${S}/pescari/a1`,
      dateCreated: '2025-03-01T10:00:00.000Z',
      mainEntity: {
        '@type': 'Person',
        name: 'Ion Pop',
        identifier: 'a1',
        url: `${S}/pescari/a1`,
        image: 'https://cdn/av.jpg',
        description: 'Feeder.',
        interactionStatistic: [{ '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: 21 }],
      },
    });
  });
  it('no image / description keys when the angler has none', () => {
    const p = anglerJsonLd({ ...base, avatarUrl: null }).mainEntity as Record<string, unknown>;
    expect(p).not.toHaveProperty('image');
    expect(p).not.toHaveProperty('description');
  });
});
