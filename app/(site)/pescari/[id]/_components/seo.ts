import type { AnglerPublicProfile } from '@/core/social';
import { absoluteUrl, routes } from '@/lib/routes';

/* The angler page's SEO words, from the PUBLIC header (./public-profile.ts) — pure, unit-tested (seo.test.ts). */

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : n >= 20 ? `${n} de ${many}` : `${n} ${many}`);

/** The meta description (≤ 160 characters): the bio when there is one, else what the profile shows. */
export function anglerDescription(p: AnglerPublicProfile): string {
  const bio = (p.bio ?? '').replace(/\s+/g, ' ').trim();
  const facts = [
    p.counts.sessions ? plural(p.counts.sessions, 'partidă', 'partide') : null,
    p.counts.competitions ? plural(p.counts.competitions, 'concurs', 'concursuri') : null,
    p.counts.catches ? plural(p.counts.catches, 'captură', 'capturi') : null,
  ].filter(Boolean);
  const base = bio
    ? `${p.username}: ${bio}`
    : `${p.username} pe Bluvi${facts.length ? `: ${facts.join(', ')}` : ''}. Capturile, partidele și concursurile pescarului.`;
  return base.length > 160 ? `${base.slice(0, 157).trimEnd()}…` : base;
}

/** schema.org ProfilePage whose mainEntity is the Person (Google's profile-page structured data). */
export function anglerJsonLd(p: AnglerPublicProfile): Record<string, unknown> {
  const url = absoluteUrl(routes.angler(p.documentId));
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    dateCreated: p.memberSince,
    mainEntity: {
      '@type': 'Person',
      name: p.username,
      identifier: p.documentId,
      url,
      ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
      ...(p.bio ? { description: p.bio } : {}),
      interactionStatistic: [
        { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: p.counts.followers },
      ],
    },
  };
}
