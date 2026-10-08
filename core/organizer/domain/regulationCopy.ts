/**
 * «Copiază din altă competiție» in the create-competition rich text editor.
 * fish `helpers/createCompetitionRegulationCopy.ts`
 */

/** The organizer's competitions minus the one being edited (its draft or published id). */
export function filterOutCurrentCompetitionSource<T extends { documentId: string }>(items: T[], currentId?: string | null): T[] {
  if (!currentId) return items;
  return items.filter(item => item.documentId !== currentId);
}

/** The editor holds real text (not only empty paragraphs, line breaks or &nbsp;) — copying over it asks first. */
export function hasMeaningfulEditorContent(html?: string | null): boolean {
  if (!html) return false;

  const normalized = html
    .replace(/&nbsp;/g, ' ')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<br\s*\/?>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return normalized.length > 0;
}

/**
 * The «N competiție disponibilă / competiții disponibile» count: the list total minus the current
 * competition when there is one (fish rich-text-editor.tsx loadSources, never below 0).
 */
export function availableSourcesCount(total: number, currentId?: string | null): number {
  return Math.max(0, total - (currentId ? 1 : 0));
}
