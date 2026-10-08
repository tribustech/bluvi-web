import { describe, expect, it } from 'vitest';
import { normalizeLineBreaks, panelCopy, parseRichTextField, RICH_TEXT_FIELDS, sourceContentKey, sourceDate, sourceStatusBadge } from './model';

describe('rich text editor model (fish rich-text-editor.tsx, RegulationSourcePickerSheet.tsx)', () => {
  it('c1 — the URL field, unknown → descriere; title and form key per field', () => {
    expect(parseRichTextField('premii')).toBe('premii');
    expect(parseRichTextField('regulament')).toBe('regulament');
    expect(parseRichTextField('descriere')).toBe('descriere');
    expect(parseRichTextField('reward')).toBe('descriere');
    expect(parseRichTextField(null)).toBe('descriere');
    expect(Object.values(RICH_TEXT_FIELDS).map((f) => [f.title, f.key, f.copy])).toEqual([
      ['Descriere', 'description', true],
      ['Premii', 'reward', false],
      ['Regulament', 'regulation', true],
    ]);
  });

  it('c8 c9 — the copy reads description for Descriere, regulation otherwise; copy per field', () => {
    expect(sourceContentKey('descriere')).toBe('description');
    expect(sourceContentKey('regulament')).toBe('regulation');
    expect(panelCopy('regulament')).toMatchObject({
      previewTitle: 'Previzualizare regulament',
      loadingPreview: 'Se încarcă regulamentul...',
      noContent: 'Competiția selectată nu are regulament.',
      confirmTitle: 'Înlocuiești regulamentul?',
      confirmText: 'Textul existent va fi înlocuit.',
    });
    expect(panelCopy('descriere').confirmTitle).toBe('Înlocuiești descrierea?');
  });

  it('c8 — status badges: Ciornă / În viitor / În curs / Terminat; none for others', () => {
    expect(['draft', 'notStarted', 'started', 'completed', 'cancelled', undefined].map((s) => sourceStatusBadge(s)?.label ?? null)).toEqual([
      'Ciornă',
      'În viitor',
      'În curs',
      'Terminat',
      null,
      null,
    ]);
  });

  it('dates as fish toLocaleDateString(ro-RO), in Romania’s time; none without a date', () => {
    expect(sourceDate('2026-05-09T22:30:00.000Z')).toBe('10.05.2026');
    expect(sourceDate(null)).toBeNull();
    expect(sourceDate('nope')).toBeNull();
  });

  it('c5 — <br> never glues text: a paragraph splits, a list item / heading gets a space, edge breaks drop', () => {
    expect(normalizeLineBreaks('<p>Locul 1<br>Locul 2</p>')).toBe('<p>Locul 1</p><p>Locul 2</p>');
    expect(normalizeLineBreaks('<p>a<br/><br />b</p>')).toBe('<p>a</p><p>b</p>');
    expect(normalizeLineBreaks('<p><strong>100 lei<br>Locul 2</strong></p>')).toBe('<p><strong>100 lei</p><p>Locul 2</strong></p>');
    expect(normalizeLineBreaks('<ul><li>a<br>b</li></ul><h2>x<br>y</h2>')).toBe('<ul><li>a b</li></ul><h2>x y</h2>');
    expect(normalizeLineBreaks('<p><br>a<br></p><br><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(normalizeLineBreaks('<p>fără</p>')).toBe('<p>fără</p>');
  });
});
