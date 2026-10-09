import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WEB_SCREEN_NAMES,
  extractEntityParams,
  reportablePath,
  resolveScreenName,
  resolveRoute,
  routePattern,
  screenInstanceKey,
  screenViewParams,
} from '@/components/analytics/screenNames';
import { defaultEventParams, ga4Id, isCollectionEnabled, resolveAppEnv } from '@/lib/analytics';
import { readAnalyticsParams } from '@/components/analytics/AnalyticsLinkListener';

/* m8.ga4 — route pattern → fish screen name (fish analytics/screenNames.ts), ids (screenParams.ts). */

const TABLE: [pattern: string, name: string][] = [
  ['/', 'Dashboard'],
  ['/intra', 'Sign In Page'],
  ['/profil', 'Profile'],
  ['/profil/completeaza', 'Complete Profile Page'],
  ['/setari', 'Settings'],
  ['/setari/profil', 'Edit Profile Page'],
  ['/notificari', 'Notifications Page'],
  ['/cookie-uri', 'CMP Personalize'],
  ['/pescari/[id]', 'Angler Profile'],
  ['/pescari/[id]/conexiuni', 'Angler Connections'],
  ['/balti', 'Lakes List'],
  ['/balti/[id]', 'Lake Page'],
  ['/balti/[id]/capturi', 'Lake Capturi'],
  ['/balti/[id]/clasament', 'Lake Clasament'],
  ['/balti/[id]/concursuri', 'Lake Competitions'],
  ['/balti/[id]/galerie', 'Lake Gallery'],
  ['/balti/[id]/harta', 'Lake Map'],
  ['/balti/[id]/partide', 'Lake Partide'],
  ['/balti/[id]/recenzii', 'Lake Reviews'],
  ['/balti/[id]/recenzie', 'Lake Review Form'],
  ['/balti/[id]/standuri', 'Lake Standuri'],
  ['/balti/[id]/statistici', 'Lake Statistici'],
  ['/balti/[id]/rezerva', 'Book Lake'],
  ['/rezervari', 'My Bookings'],
  ['/rezervari/[id]', 'Booking Detail'],
  ['/ape-publice/[id]', 'Public Water Page'],
  ['/ape-publice/[id]/harta', 'Public Water Map'],
  ['/concursuri', 'Competitions List'],
  ['/concursuri/viitoare', 'Competitions List'],
  ['/concursuri/[id]', 'Competition Page'],
  ['/concursuri/[id]/informatii', 'Competition Page'],
  ['/concursuri/[id]/statistici/cronologie', 'Stand Timeline'],
  ['/concursuri/[id]/clasament/imagine', 'Ranking Image'],
  ['/concursuri/[id]/inscriere', 'Register Competition Page'],
  ['/concursuri/[id]/inscriere/echipa', 'Register Team Disclaimer'],
  ['/concursuri/[id]/inscriere/fara-cont', 'Register Guests'],
  ['/concursuri/[id]/sectoare', 'Configure Sectors Page'],
  ['/concursuri/[id]/alocare', 'Configure Participants Page'],
  ['/concursuri/[id]/cantar', 'Scale Sector-Stands Page'],
  ['/concursuri/[id]/cantar/[standId]', 'Add Scale Page'],
  ['/concursuri/[id]/cantar/[standId]/[weighingId]', 'Scale History Page'],
  ['/concursuri/[id]/cantar/[standId]/[weighingId]/modificari', 'Scale Revisions'],
  ['/concursuri/[id]/penalizari', 'Penalties'],
  ['/concursuri/[id]/penalizari/stand', 'Penalties Select Stand'],
  ['/concursuri/[id]/penalizari/aplica', 'Penalties Apply'],
  ['/organizator', 'Organizer'],
  ['/operator', 'Operator Lakes'],
  ['/operator/[lakeId]', 'Operator Lake Dashboard'],
  ['/operator/[lakeId]/blocaje', 'Operator Blocks'],
  ['/operator/[lakeId]/rezervari', 'Operator Bookings'],
  ['/operator/[lakeId]/calendar', 'Operator Walk In'],
  ['/operator/evalueaza/[bookingId]', 'Operator Rate Angler'],
  ['/partide', 'Partide Tab'],
  ['/partide/[id]', 'Partida Spectator'],
  ['/partide/[id]/capturi', 'Partida Spectator Capturi'],
  ['/partide/[id]/galerie', 'Partida Spectator Galerie'],
  ['/partide/istoric', 'Partida Istoric'],
  ['/partide/statistici', 'Partida Statistici'],
  ['/partide/clasament', 'Partida Clasament'],
  ['/stiri', 'News List'],
  ['/stiri/[id]', 'News Page'],
  ['/sponsori/[id]', 'Sponsor Page'],
  ['/sondaje', 'Poll Current'],
  ['/sondaje/anterioare', 'Poll Past'],
];

describe('screen names (fish screenNames.ts)', () => {
  it.each(TABLE)('%s → %s', (pattern, name) => {
    expect(resolveScreenName(pattern)).toBe(name);
  });

  it('the wizard step names by [pas], create and edit alike', () => {
    expect(resolveScreenName('/organizator/concursuri/nou/[pas]', { pas: 'detalii' })).toBe('Create Competition Basics');
    expect(resolveScreenName('/organizator/concursuri/nou/[pas]', { pas: 'lac-si-sectoare' })).toBe('Create Competition Lake Sectors');
    expect(resolveScreenName('/concursuri/[id]/editeaza/[pas]', { id: 'c', pas: 'revizuire' })).toBe('Create Competition Review');
  });

  it('a route without a name gets a derived one (never untracked)', () => {
    expect(resolveScreenName('/dev/templates/t1')).toBe('Dev Templates T1');
    expect(resolveScreenName('/ceva-nou/[id]')).toBe('Ceva Nou');
  });

  it('every page route in app/ has an explicit name (dev pages excepted)', () => {
    const appDir = path.resolve(__dirname, '../../app');
    const patterns: string[] = [];
    const walk = (dir: string, parts: string[]) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry.startsWith('_') || entry.startsWith('@')) continue;
          walk(full, entry.startsWith('(') ? parts : [...parts, entry]);
        } else if (entry === 'page.tsx') {
          patterns.push(`/${parts.join('/')}`);
        }
      }
    };
    walk(appDir, []);
    const missing = patterns.filter((p) => !p.startsWith('/dev') && !(p in WEB_SCREEN_NAMES));
    expect(missing).toEqual([]);
  });
});

describe('route pattern from the pathname (never the router tree: history.pushState keeps it stale)', () => {
  it('matches the table, ids back to their [name]', () => {
    expect(routePattern('/balti/abc')).toBe('/balti/[id]');
    expect(routePattern('/rezervari')).toBe('/rezervari');
    expect(routePattern('/')).toBe('/');
    expect(routePattern('/concursuri/c1/cantar/s1/w1')).toBe('/concursuri/[id]/cantar/[standId]/[weighingId]');
    expect(routePattern('/nu/exista', { rest: ['nu', 'exista'] })).toBe('/[...rest]');
    expect(resolveRoute('/nu/a%20b', { rest: ['nu', 'a b'] }).params).toEqual({ rest: ['nu', 'a b'] });
  });

  it('static segments win over params (Next precedence)', () => {
    expect(routePattern('/concursuri/live')).toBe('/concursuri/live');
    expect(routePattern('/balti/harta')).toBe('/balti/harta');
    expect(routePattern('/pescari/sugerati')).toBe('/pescari/sugerati');
    expect(routePattern('/partide/istoric')).toBe('/partide/istoric');
    expect(routePattern('/operator/evalueaza/b1')).toBe('/operator/evalueaza/[bookingId]');
    expect(routePattern('/organizator/concursuri/nou/clasament')).toBe('/organizator/concursuri/nou/[pas]');
  });

  it('decodes values; the params come from the pathname, not from stale useParams()', () => {
    expect(resolveRoute('/partide/sesiune/a%20b')).toEqual({ pattern: '/partide/sesiune/[clientId]', params: { clientId: 'a b' } });
    // A wizard step moved with history.pushState: useParams still says the previous step.
    expect(resolveRoute('/organizator/concursuri/nou/configurare', { pas: 'detalii' }).params).toEqual({ pas: 'configurare' });
    // A tab moved with history.pushState: the new tab, same competition.
    expect(routePattern('/concursuri/C/cantare', { id: 'C' })).toBe('/concursuri/[id]/cantare');
  });

  it('a page outside the table (dev) falls back to the params', () => {
    expect(routePattern('/dev/templates/t1')).toBe('/dev/templates/t1');
    expect(routePattern('/dev/x/abc', { id: 'abc' })).toBe('/dev/x/[id]');
  });
});

describe('screen instance (fish: one screen, in-place tabs)', () => {
  const key = (pathname: string) => {
    const { pattern, params } = resolveRoute(pathname);
    return screenInstanceKey(pathname, pattern, params);
  };
  it('the tabs of one competition share a key; another competition does not', () => {
    const c = ['/concursuri/C', '/concursuri/C/clasament', '/concursuri/C/cantare', '/concursuri/C/informatii', '/concursuri/C/extra-cantare'].map(key);
    expect(new Set(c).size).toBe(1);
    expect(key('/concursuri/D/clasament')).not.toBe(c[0]);
    // Its other screens stay their own.
    expect(key('/concursuri/C/inscriere')).not.toBe(c[0]);
    expect(key('/concursuri/C/statistici/cronologie')).not.toBe(c[0]);
  });
  it('the list status tabs share a key; other routes keep their pathname', () => {
    expect(new Set(['/concursuri', '/concursuri/viitoare', '/concursuri/live', '/concursuri/rezultate'].map(key)).size).toBe(1);
    expect(key('/balti/A')).not.toBe(key('/balti/B'));
  });
});

describe('entity params (fish screenParams.ts: default-deny)', () => {
  it('ids per area', () => {
    expect(extractEntityParams('/balti/[id]/galerie', { id: 'L' })).toEqual({ lake_id: 'L' });
    expect(extractEntityParams('/balti/[id]/rezerva', { id: 'L' })).toEqual({ lake_id: 'L' });
    expect(extractEntityParams('/operator/[lakeId]/rezervari', { lakeId: 'L' })).toEqual({ lake_id: 'L' });
    expect(extractEntityParams('/concursuri/[id]/cantar/[standId]', { id: 'C', standId: 'S' })).toEqual({ competition_id: 'C' });
    expect(extractEntityParams('/stiri/[id]', { id: 'N' })).toEqual({ news_id: 'N' });
    expect(extractEntityParams('/sponsori/[id]', { id: 'S' })).toEqual({ creative_id: 'S' });
    expect(extractEntityParams('/ape-publice/[id]/statistici', { id: 'W' })).toEqual({ public_water_id: 'W' });
  });

  it('people, bookings, partide and sessions are never logged', () => {
    expect(extractEntityParams('/pescari/[id]', { id: 'P' })).toEqual({});
    expect(extractEntityParams('/rezervari/[id]', { id: 'B' })).toEqual({});
    expect(extractEntityParams('/operator/evalueaza/[bookingId]', { bookingId: 'B' })).toEqual({});
    expect(extractEntityParams('/partide/[id]', { id: 'X' })).toEqual({});
    expect(extractEntityParams('/partide/sesiune/[clientId]', { clientId: 'X' })).toEqual({});
  });

  it('page_path keeps only reportable ids', () => {
    expect(reportablePath('/balti/[id]/galerie', { id: 'L 1' })).toBe('/balti/L%201/galerie');
    expect(reportablePath('/pescari/[id]/conexiuni', { id: 'P' })).toBe('/pescari/[id]/conexiuni');
    expect(reportablePath('/concursuri/[id]/cantar/[standId]', { id: 'C', standId: 'S' })).toBe('/concursuri/C/cantar/[standId]');
  });

  it('screenViewParams', () => {
    expect(screenViewParams('/concursuri/[id]', { id: 'C' })).toEqual({
      screen_name: 'Competition Page',
      screen_class: 'Competition Page',
      page_path: '/concursuri/C',
      competition_id: 'C',
    });
  });
});

describe('app_env (fish appEnv.ts)', () => {
  it.each([
    [undefined, undefined, 'local'],
    ['http://localhost:3000', 'production', 'local'],
    ['https://bluvi.ro', 'production', 'production'],
    ['https://staging.bluvi.ro', 'production', 'staging'],
    ['https://bluvi-web-git-x.vercel.app', 'preview', 'staging'],
    ['https://bluvi.ro', undefined, 'local'],
    ['not a url', 'production', 'local'],
  ] as const)('%s + %s → %s', (url, env, expected) => {
    expect(resolveAppEnv(url, env)).toBe(expected);
  });

  it('collection like fish isCollectionEnabled: production, or the explicit debug opt-in', () => {
    expect(isCollectionEnabled('production', undefined)).toBe(true);
    expect(isCollectionEnabled('staging', undefined)).toBe(false);
    expect(isCollectionEnabled('local', '')).toBe(false);
    expect(isCollectionEnabled('staging', '1')).toBe(true);
    expect(isCollectionEnabled('local', 'true')).toBe(true);
    expect(isCollectionEnabled('local', 'yes')).toBe(false);
  });

  describe('ga4Id()', () => {
    afterEach(() => vi.unstubAllEnvs());
    const env = (url: string, vercel: string, id: string, debug = '') => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', url);
      vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', vercel);
      vi.stubEnv('NEXT_PUBLIC_GA4_ID', id);
      vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DEBUG', debug);
      return ga4Id();
    };
    it.each([
      ['https://bluvi.ro', 'production', 'G-ABC123', '', 'G-ABC123'],
      ['https://bluvi-web-git-x.vercel.app', 'preview', 'G-ABC123', '', null],
      ['https://bluvi-web-git-x.vercel.app', 'preview', 'G-ABC123', '1', 'G-ABC123'],
      ['https://staging.bluvi.ro', 'production', 'G-ABC123', '', null],
      ['http://localhost:3120', 'development', 'G-ABC123', '', null],
      ['http://localhost:3120', 'development', 'G-ABC123', 'true', 'G-ABC123'],
      ['https://bluvi.ro', 'production', '', '1', null],
      ['https://bluvi.ro', 'production', 'UA-1-1', '', null],
    ] as const)('%s + %s + id «%s» + debug «%s» → %s', (url, vercel, id, debug, expected) => {
      expect(env(url, vercel, id, debug)).toBe(expected);
    });
  });

  it('debug_mode only outside production (GA4 reads any value as on)', () => {
    expect(defaultEventParams('production')).toEqual({ app_env: 'production' });
    expect(defaultEventParams('staging')).toEqual({ app_env: 'staging', debug_mode: true });
  });
});

describe('data-analytics-params', () => {
  it('keeps scalars of a JSON object, ignores the rest', () => {
    expect(readAnalyticsParams('{"newsId":"n","n":1,"b":true,"o":{"x":1}}')).toEqual({ newsId: 'n', n: 1, b: true });
    expect(readAnalyticsParams('nope')).toEqual({});
    expect(readAnalyticsParams('[1]')).toEqual({});
    expect(readAnalyticsParams(null)).toEqual({});
  });
});
