import { describe, expect, it } from 'vitest';
import { RANKING_EXPLANATIONS } from '@/core/organizer';
import { buildExplanationView, explanationFor, explanationParam, formTypeFor, parseExplanationParam, splitParagraphs, type ExplanationTarget } from './model';

describe('?explicatie= codec', () => {
  const cases: [ExplanationTarget, string][] = [
    [{ kind: 'ranking', rankingType: 'quantity' }, 'quantity'],
    [{ kind: 'ranking', rankingType: 'nuExista' }, 'nuExista'],
    [{ kind: 'generalMode', rankingType: 'quantityQuality' }, 'mod-general-quantityQuality'],
    [{ kind: 'gridRule' }, 'grila'],
    [{ kind: 'gridRule', rankingType: 'quality' }, 'grila-quality'],
  ];

  it.each(cases)('%o ⇄ %s', (target, param) => {
    expect(explanationParam(target)).toBe(param);
    expect(parseExplanationParam(param)).toEqual(target);
    expect(parseExplanationParam(new URLSearchParams({ explicatie: explanationParam(target) }).get('explicatie'))).toEqual(target);
  });

  it('no value = no panel', () => {
    expect(parseExplanationParam(null)).toBeNull();
    expect(parseExplanationParam(undefined)).toBeNull();
    expect(parseExplanationParam('')).toBeNull();
    expect(parseExplanationParam('  ')).toBeNull();
  });

  it('a bare prefix is a (unknown) ranking type, not an empty general mode / grid type', () => {
    expect(parseExplanationParam('mod-general-')).toEqual({ kind: 'ranking', rankingType: 'mod-general-' });
    expect(parseExplanationParam('grila-')).toEqual({ kind: 'ranking', rankingType: 'grila-' });
  });
});

describe('buildExplanationView', () => {
  it('c1 c2 — a known type: its title and every section, heading and body in order', () => {
    const view = buildExplanationView({ kind: 'ranking', rankingType: 'quantity' });
    const src = RANKING_EXPLANATIONS.quantity;
    expect(view.title).toBe('⚖️ Cantitate');
    expect(view.sections.map((s) => s.heading)).toEqual(src.sections.map((s) => s.heading));
    view.sections.forEach((s, i) => {
      // Paragraphs rejoin to the body (blank lines split them; nothing is lost or reordered).
      expect(s.paragraphs.map((p) => (p.label ? `${p.label}:\n${p.text}` : p.text)).join('\n\n')).toBe(src.sections[i].body.trim());
    });
    expect(view.sections[1].paragraphs[0].text).toContain('1. Se adună greutatea tuturor capturilor fiecărei echipe\n2.');
  });

  const UNKNOWN = { eyebrow: undefined, title: 'Necunoscut', sections: [{ heading: undefined, level: 1, paragraphs: [{ text: 'Tip de clasament necunoscut.' }] }] };

  it('c3 — an unknown type: «Necunoscut» / «Tip de clasament necunoscut.», no eyebrow', () => {
    expect(buildExplanationView({ kind: 'ranking', rankingType: 'nuExista' })).toEqual(UNKNOWN);
  });

  it('rule 4 — a general mode / grid rule the type does not have (or of an unknown type) reads «Necunoscut», no eyebrow', () => {
    for (const param of ['mod-general-bestOf', 'mod-general-nuExista', 'grila-quantity', 'grila-bestOf', 'grila-nuExista']) {
      expect(buildExplanationView(parseExplanationParam(param)!), param).toEqual(UNKNOWN);
    }
    // A bare «grila» explains the form type's grid rule — none for a type without one, or no type.
    expect(buildExplanationView({ kind: 'gridRule' }, 'quantity')).toEqual(UNKNOWN);
    expect(buildExplanationView({ kind: 'gridRule' })).toEqual(UNKNOWN);
    expect(buildExplanationView({ kind: 'gridRule' }, 'constructor')).toEqual(UNKNOWN);
  });

  it('a URL value that is an Object.prototype name is not a type (no crash, no «function Object()»)', () => {
    for (const param of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf', 'mod-general-constructor', 'grila-constructor', 'grila-__proto__', 'mod-general-toString']) {
      const target = parseExplanationParam(param)!;
      expect(() => buildExplanationView(target), param).not.toThrow();
      expect(buildExplanationView(target), param).toEqual(UNKNOWN);
      expect(JSON.stringify(explanationFor(target)), param).not.toContain('native code');
    }
  });

  it('step-ranking c11 — the general-mode group is built from the type options: 1., 1.n …, 2.', () => {
    const view = buildExplanationView({ kind: 'generalMode', rankingType: 'quantityQuality' });
    expect(view.title).toBe('Cum funcționează departajarea la Cantitate/Calitate');
    expect(view.sections.map((s) => [s.heading, s.level])).toEqual([
      ['1. 📊 După poziția în sector', 1],
      ['1.1 ⚖️ După poziția în sector, primează Cantitatea', 2],
      ['1.2 🐟 După poziția în sector, primează Calitatea', 2],
      ['2. 🔢 După punctaj', 1],
    ]);
    expect(view.sections[1].paragraphs[0].label).toBe('Cum funcționează');
    expect(view.sections[1].paragraphs.some((p) => p.label === 'Exemplu concret')).toBe(true);
  });

  it('a two-option type has one sector sub-section', () => {
    const view = buildExplanationView({ kind: 'generalMode', rankingType: 'quality' });
    expect(view.sections.map((s) => s.heading)).toEqual(['1. 📊 După poziția în sector', '1.1 🐟 După poziția în sector, primează Calitatea', '2. 🔢 După punctaj']);
  });

  it('the grid rule: of its own type, else of the form type', () => {
    expect(explanationFor({ kind: 'gridRule', rankingType: 'quality' }).sections.at(-2)?.heading).toBe('Exemplu concret — La Calitate');
    expect(explanationFor({ kind: 'gridRule' }, 'qualityQuantity').sections.at(-2)?.heading).toBe('Exemplu concret — La Calitate/Cantitate');
    // Its own type wins over the form's.
    expect(explanationFor({ kind: 'gridRule', rankingType: 'quality' }, 'quantityQuality').sections.at(-2)?.heading).toBe('Exemplu concret — La Calitate');
    const view = buildExplanationView({ kind: 'gridRule' }, 'quality');
    expect(view.eyebrow).toBe('Regula grilei');
    expect(view.title).toBe('🔀 Regula departajare standuri fără grilă');
  });

  it('only a bare «grila» reads the form type (a draft hydrating does not rebuild other targets)', () => {
    expect(formTypeFor({ kind: 'gridRule' }, 'quality')).toBe('quality');
    expect(formTypeFor({ kind: 'gridRule', rankingType: 'quality' }, 'quantityQuality')).toBeUndefined();
    expect(formTypeFor({ kind: 'ranking', rankingType: 'quantity' }, 'quality')).toBeUndefined();
    expect(formTypeFor({ kind: 'generalMode', rankingType: 'quality' }, 'quality')).toBeUndefined();
  });

  it('never says «capot» (owner rule 11)', () => {
    const all = [
      ...Object.keys(RANKING_EXPLANATIONS).flatMap((t) => [
        buildExplanationView({ kind: 'ranking', rankingType: t }),
        buildExplanationView({ kind: 'generalMode', rankingType: t }),
        buildExplanationView({ kind: 'gridRule', rankingType: t }),
      ]),
    ];
    expect(JSON.stringify(all).toLowerCase()).not.toContain('capot');
  });
});

describe('splitParagraphs', () => {
  it('splits on blank lines, keeps single breaks, lifts a short «…:» lead line into a label', () => {
    expect(splitParagraphs('Cum funcționează:\nA\nB\n\nExemplu concret:\nC')).toEqual([
      { label: 'Cum funcționează', text: 'A\nB' },
      { label: 'Exemplu concret', text: 'C' },
    ]);
    expect(splitParagraphs('📊 După poziția în sector (implicit): Locurile 1\n\n🔢 După punctaj: Toate')).toEqual([
      { text: '📊 După poziția în sector (implicit): Locurile 1' },
      { text: '🔢 După punctaj: Toate' },
    ]);
    expect(splitParagraphs('Doar un rând:')).toEqual([{ text: 'Doar un rând:' }]);
  });
});
