import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * m8.runbook drift guard: every environment variable the code reads is named in .env.example and
 * in docs/RUNBOOK.md §2, and the (public) runbook never carries a value or a private detail.
 */

const ROOT = path.resolve(__dirname, '../..');
const SOURCES = ['app', 'lib', 'core', 'components', 'proxy.ts', 'next.config.ts', 'instrumentation.ts', 'instrumentation-client.ts'];

/** Set by Node / Next / Vercel / the test harness, or computed in next.config.ts: never configured by hand. */
const NOT_CONFIGURED = new Set([
  'NODE_ENV',
  'TZ',
  'CI',
  'NEXT_PHASE',
  'NEXT_DIST_DIR',
  'VERCEL_ENV',
  'NEXT_PUBLIC_VERCEL_ENV',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_PUBLIC_SENTRY_ENVIRONMENT',
  'BLUVI_E2E_FAULTS',
  'FISH_DIR',
]);

function files(p: string): string[] {
  const abs = path.join(ROOT, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes('node_modules'))
    .map((f) => path.join(abs, f));
}

function envNamesReadByCode(): string[] {
  const names = new Set<string>();
  for (const f of SOURCES.flatMap(files)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g)) names.add(m[1]);
  }
  return [...names].filter((n) => !NOT_CONFIGURED.has(n)).sort();
}

const envExample = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
const runbook = readFileSync(path.join(ROOT, 'docs/RUNBOOK.md'), 'utf8');

describe('m8.runbook — environment variables', () => {
  const names = envNamesReadByCode();

  it('finds the variables the code reads (sanity)', () => {
    expect(names).toEqual(expect.arrayContaining(['CMS_URL', 'REVALIDATE_SECRET', 'SITE_INDEXABLE', 'NEXT_PUBLIC_GA4_ID', 'SENTRY_DSN']));
  });

  it.each(names)('%s is named in .env.example', (name) => {
    expect(envExample).toMatch(new RegExp(`^${name}=`, 'm'));
  });

  it.each(names)('%s is in the runbook env table', (name) => {
    expect(runbook).toContain(`\`${name}\``);
  });

  it('names the CMS-side revalidation variables', () => {
    expect(runbook).toContain('`WEB_REVALIDATE_URL`');
    expect(runbook).toContain('`WEB_REVALIDATE_SECRET`');
  });

  it('.env.example carries no telemetry / secret values', () => {
    for (const name of ['SITE_INDEXABLE', 'NEXT_PUBLIC_GA4_ID', 'SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'ENABLE_LOCAL_AUTH', 'ENABLE_DEV_KIT', 'GOOGLE_CLIENT_SECRET']) {
      expect(envExample).toMatch(new RegExp(`^${name}=$`, 'm'));
    }
  });
});

describe('m8.runbook — content', () => {
  it.each([
    '## 1. Owner decisions and accounts',
    '## 2. Environment variables',
    '## 3. Deploy order',
    '## 4. Pre-launch checks',
    '## 5. Universal links cut-over',
    '## 6. Rollback',
    '## 7. Monitoring after launch',
  ])('has the section «%s»', (heading) => {
    expect(runbook).toContain(heading);
  });

  it('deploys the CMS before the web, wires the webhook once the domain serves, flips indexing last', () => {
    const cms = runbook.indexOf('### 3.1 CMS');
    const web = runbook.indexOf('### 3.2 Web');
    const webhook = runbook.indexOf('### 3.3 Revalidation webhook');
    const index = runbook.indexOf('### 3.4 Go indexable');
    expect(cms).toBeGreaterThan(0);
    expect(web).toBeGreaterThan(cms);
    expect(webhook).toBeGreaterThan(web);
    expect(index).toBeGreaterThan(webhook);
  });

  it('is public-safe: no ids, DSNs, tokens or private patch details', () => {
    expect(runbook).not.toMatch(/\bG-[A-Z0-9]{6,}\b/); // GA4 measurement id
    expect(runbook).not.toMatch(/https:\/\/[0-9a-f]{16,}@/); // Sentry DSN
    expect(runbook).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
    expect(runbook).not.toMatch(/sntrys_|sk_live|AIza[0-9A-Za-z_-]{20,}/); // tokens / API keys
    expect(runbook).not.toMatch(/\bP0\b|debug_token|bluvi-strapi#|hardening/i); // the private security patch
    expect(runbook).not.toMatch(/ondigitalocean\.app/); // internal hosts
  });
});
