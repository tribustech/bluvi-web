import { describe, expect, it } from 'vitest';
import { buildRichTextSummary, RICH_TEXT_EXCERPT_LENGTH, RICH_TEXT_PREVIEW_EXPANDABLE_AFTER } from './richTextSummary';

describe('buildRichTextSummary (fish createCompetitionRichTextSummary)', () => {
  it('is empty for nothing, blanks and undefined', () => {
    expect(buildRichTextSummary('')).toEqual({ preview: '', isExpandable: false, excerpt: '' });
    expect(buildRichTextSummary('   \n ')).toEqual({ preview: '', isExpandable: false, excerpt: '' });
    expect(buildRichTextSummary(undefined)).toEqual({ preview: '', isExpandable: false, excerpt: '' });
    expect(buildRichTextSummary(null)).toEqual({ preview: '', isExpandable: false, excerpt: '' });
  });

  it('turns blocks into lines and drops inline tags', () => {
    expect(buildRichTextSummary('<p>Prima <strong>linie</strong></p><p>A doua<br>și a treia</p>').preview).toBe(
      'Prima linie\nA doua\nși a treia',
    );
    expect(buildRichTextSummary('<h2>Titlu</h2><p>Text</p>').preview).toBe('Titlu\nText');
  });

  it('writes list items as bullets, with no blank line before them', () => {
    expect(buildRichTextSummary('<p>Premii:</p><ul><li>Locul 1</li><li>Locul 2</li></ul>').preview).toBe(
      'Premii:\n• Locul 1\n• Locul 2',
    );
    expect(buildRichTextSummary('<ol><li>Unu</li><li>Doi</li></ol>').preview).toBe('• Unu\n• Doi');
  });

  it('decodes entities and collapses spaces and blank lines', () => {
    expect(buildRichTextSummary('<p>Crap &amp; amur&nbsp;&nbsp; &quot;mare&quot; &#39;x&#39;</p>').preview).toBe(
      'Crap & amur "mare" \'x\'',
    );
    expect(buildRichTextSummary('<p>A</p><p></p><p></p><p></p><p>B</p>').preview).toBe('A\n\nB');
  });

  it('keeps an escaped tag typed by the organizer as text', () => {
    expect(buildRichTextSummary('<p>&lt;b&gt;nu e bold&lt;/b&gt;</p>').preview).toBe('<b>nu e bold</b>');
  });

  it('is expandable only past 140 characters', () => {
    const at = 'a'.repeat(RICH_TEXT_PREVIEW_EXPANDABLE_AFTER);
    expect(buildRichTextSummary(`<p>${at}</p>`).isExpandable).toBe(false);
    expect(buildRichTextSummary(`<p>${at}b</p>`).isExpandable).toBe(true);
  });

  it('gives a one-line excerpt cut at a word, never the whole text', () => {
    expect(buildRichTextSummary('<p>Premii:</p><ul><li>Locul 1</li><li>Locul 2</li></ul>').excerpt).toBe('Premii: • Locul 1 • Locul 2');
    const long = buildRichTextSummary(`<p>${'cuvânt '.repeat(500)}</p>`);
    expect(long.preview.length).toBeGreaterThan(3000);
    expect(long.excerpt.length).toBeLessThanOrEqual(RICH_TEXT_EXCERPT_LENGTH + 1);
    expect(long.excerpt).toMatch(/^cuvânt( cuvânt)+…$/);
    // One unbroken word longer than the excerpt is cut mid-word.
    expect(buildRichTextSummary(`<p>${'a'.repeat(200)}</p>`).excerpt).toBe(`${'a'.repeat(RICH_TEXT_EXCERPT_LENGTH)}…`);
  });
});
