import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProxyAllowed } from '@/lib/server/proxy';

const CORE = path.resolve(__dirname, '../../core');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') && !p.includes('test-data') ? [p] : [];
  });
}

/** Every `path: '/x/...'` or `path: \`/x/${...}\`` literal in core/, reduced to its static head. */
function corePaths(): string[] {
  const found = new Set<string>();
  const re = /path:\s*[`'"](\/[^`'"$?]*)/g;
  for (const f of sourceFiles(CORE)) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) found.add(m[1]);
  }
  return [...found].sort();
}

describe('proxy allow-list covers core/', () => {
  it('finds the paths', () => {
    expect(corePaths().length).toBeGreaterThan(100);
  });

  it('lets every CMS path core/ calls through /api/cms', () => {
    const blocked = corePaths().filter(p => !isProxyAllowed(p.endsWith('/') ? `${p}x` : p));
    expect(blocked).toEqual([]);
  });
});
