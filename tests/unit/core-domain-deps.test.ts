import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CORE = path.resolve(__dirname, '../../core');

/**
 * Which domain may import which. Each thing lives once, in its owning domain; the others import it.
 * The graph must stay acyclic: nothing imports organizer or booking, news imports nothing.
 * `core/shared`, `core/transport`, `core/cache` are infrastructure (not domains); `core/realtime`
 * is out of scope here.
 */
const ALLOWED: Record<string, readonly string[]> = {
  organizer: ['competitions', 'social'],
  competitions: ['social', 'lakes'],
  booking: ['lakes', 'social'],
  lakes: ['social'],
  partide: ['social', 'lakes'],
  social: [],
  news: [],
};
const DOMAINS = Object.keys(ALLOWED);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Every module specifier of an `import … from` / `export … from` / bare `import '…'`. */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1] ?? m[2]);
  return out;
}

/** The core top-level folder a specifier resolves to, or null when it leaves core/. */
function targetFolder(fromFile: string, spec: string): string | null {
  let abs: string;
  if (spec.startsWith('@/core/')) abs = path.join(CORE, spec.slice('@/core/'.length));
  else if (spec.startsWith('.')) abs = path.resolve(path.dirname(fromFile), spec);
  else return null;
  const rel = path.relative(CORE, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep)[0];
}

describe('core/ domain dependency direction', () => {
  it('imports between domains follow the allow-list', () => {
    const offenders: string[] = [];
    for (const domain of DOMAINS) {
      for (const file of files(path.join(CORE, domain)).filter(f => !f.endsWith('.test.ts') && !f.includes('.test-'))) {
        for (const spec of specifiers(readFileSync(file, 'utf8'))) {
          const target = targetFolder(file, spec);
          if (!target || target === domain || !DOMAINS.includes(target)) continue;
          if (!ALLOWED[domain].includes(target)) offenders.push(`${path.relative(CORE, file)} → ${target} ('${spec}')`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the allow-list itself is acyclic', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const cyclic = (d: string): boolean => {
      if (done.has(d)) return false;
      if (visiting.has(d)) return true;
      visiting.add(d);
      const hit = ALLOWED[d].some(cyclic);
      visiting.delete(d);
      done.add(d);
      return hit;
    };
    expect(DOMAINS.filter(cyclic)).toEqual([]);
  });

  it('sees the cross-domain imports it is meant to police', () => {
    // Guard against the scanner silently matching nothing (e.g. a regex regression).
    const src = readFileSync(path.join(CORE, 'organizer/mutations.ts'), 'utf8');
    const targets = specifiers(src).map(s => targetFolder(path.join(CORE, 'organizer/mutations.ts'), s));
    expect(targets).toContain('competitions');
    expect(targets).toContain('social');
  });
});
