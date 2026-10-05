import type { RichTextNode } from '@/core/shared';

/** Plain text of a Strapi rich text (meta descriptions, a one-line preview, «is it empty?»). */
export function richTextToPlain(blocks: RichTextNode[] | null | undefined): string {
  const walk = (n: RichTextNode): string => (n.text ?? '') + (n.children ?? []).map(walk).join('');
  return (blocks ?? []).map(walk).filter(Boolean).join(' ').trim();
}
