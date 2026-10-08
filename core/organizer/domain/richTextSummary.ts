/**
 * The plain-text preview of a create-competition rich-text field (description, reward,
 * regulation) on the wizard's first step — fish `helpers/createCompetitionRichTextSummary.ts`.
 *
 * The editor speaks HTML: block ends become line breaks, list items become «• » lines, every other
 * tag is dropped and the common entities are decoded. The step shows at most 3 lines of it and
 * «Vezi mai mult» once the text is longer than 140 characters.
 */

/** fish EXPANDABLE_PREVIEW_THRESHOLD. */
export const RICH_TEXT_PREVIEW_EXPANDABLE_AFTER = 140;

/** fish RichTextPreviewCard `numberOfLines={3}`. */
export const RICH_TEXT_PREVIEW_LINES = 3;

/** The spoken excerpt's length: a screen reader hears the start of the text, never all of it. */
export const RICH_TEXT_EXCERPT_LENGTH = 80;

export type RichTextSummary = {
  /** Plain text, «\n» between blocks, «• » before each list item; '' when there is nothing. */
  preview: string;
  /** Longer than RICH_TEXT_PREVIEW_EXPANDABLE_AFTER characters: «Vezi mai mult». */
  isExpandable: boolean;
  /**
   * The preview on one line, cut at a word to at most RICH_TEXT_EXCERPT_LENGTH characters plus «…»
   * — the accessible description of the preview card ('' when there is nothing).
   */
  excerpt: string;
};

function toExcerpt(preview: string): string {
  const flat = preview.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (flat.length <= RICH_TEXT_EXCERPT_LENGTH) return flat;
  const cut = flat.slice(0, RICH_TEXT_EXCERPT_LENGTH);
  const space = cut.lastIndexOf(' ');
  return `${(space > RICH_TEXT_EXCERPT_LENGTH / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.•-]+$/, '')}…`;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function buildRichTextSummary(html: string | null | undefined): RichTextSummary {
  if (!html || !html.trim()) return { preview: '', isExpandable: false, excerpt: '' };

  // Tags first, entities last: an escaped «&lt;b&gt;» typed by the organizer stays text, not a tag
  // (fish decodes first; the web keeps the literal the editor stored).
  const preview = decodeHtmlEntities(
    html
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|ul|ol)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+• /g, '\n• ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return { preview, isExpandable: preview.length > RICH_TEXT_PREVIEW_EXPANDABLE_AFTER, excerpt: toExcerpt(preview) };
}
