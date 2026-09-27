import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const CORE = path.resolve(__dirname, '../../core');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Belt and braces next to the ESLint rule: lint can be skipped, this runs with the unit suite. */
const FORBIDDEN = [
  /from ['"]react['"]/,
  /from ['"]react-dom['"]/,
  /from ['"]react-native['"]/,
  /from ['"]next(\/[^'"]*)?['"]/,
  /from ['"]expo-[^'"]*['"]/,
  /from ['"]@react-native-firebase\/[^'"]*['"]/,
  /^import (?!type )[^;]*from ['"]@tanstack\/react-query['"]/m,
  /from ['"]@\/(lib|app)\//,
];

describe('core/ import boundary', () => {
  it('imports no framework, platform or app module at runtime', () => {
    const offenders = files(CORE)
      .filter(f => !f.endsWith('.test.ts'))
      .flatMap(f => {
        const src = readFileSync(f, 'utf8');
        return FORBIDDEN.filter(re => re.test(src)).map(re => `${path.relative(CORE, f)}: ${re}`);
      });
    expect(offenders).toEqual([]);
  });
});
