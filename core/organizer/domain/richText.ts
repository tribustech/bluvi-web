/**
 * HTML ⇄ Strapi blocks for the create-competition rich-text fields (description, reward,
 * regulation). The editor speaks HTML; the CMS stores `blocks`.
 * fish `helpers/htmlToStrapiBlocks.ts` + `helpers/strapiBlocksToHtml.ts`
 *
 * Supports:
 * - <p> → paragraph block
 * - <h1>, <h2>, <h3> → heading block with level
 * - <ul>/<li> → list block (unordered)
 * - <ol>/<li> → list block (ordered)
 * - <strong>/<b> → bold inline node
 * - <em>/<i> → italic inline node
 * - Plain text → text inline node
 */

export type TextInlineNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type StrapiBlockNode = {
  type: string;
  children: (TextInlineNode | StrapiBlockNode)[];
  level?: number;
  format?: 'ordered' | 'unordered';
};

function parseInlineNodes(html: string): TextInlineNode[] {
  const nodes: TextInlineNode[] = [];
  // Match tags or text segments
  const regex = /<(strong|b|em|i)>([\s\S]*?)<\/\1>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1];
    const tagContent = match[2];
    const plainText = match[3];

    if (tag && tagContent) {
      // Handle nested formatting: <strong><em>text</em></strong>
      const innerRegex = /<(strong|b|em|i)>([\s\S]*?)<\/\1>/;
      const innerMatch = tagContent.match(innerRegex);

      if (innerMatch) {
        const outerBold = tag === 'strong' || tag === 'b';
        const outerItalic = tag === 'em' || tag === 'i';
        const innerBold = innerMatch[1] === 'strong' || innerMatch[1] === 'b';
        const innerItalic = innerMatch[1] === 'em' || innerMatch[1] === 'i';

        nodes.push({
          type: 'text',
          text: innerMatch[2],
          bold: outerBold || innerBold || undefined,
          italic: outerItalic || innerItalic || undefined,
        });
      } else {
        const node: TextInlineNode = { type: 'text', text: tagContent };
        if (tag === 'strong' || tag === 'b') node.bold = true;
        if (tag === 'em' || tag === 'i') node.italic = true;
        nodes.push(node);
      }
    } else if (plainText) {
      nodes.push({ type: 'text', text: plainText });
    }
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'text', text: '' });
  }

  return nodes;
}

function parseListItems(listHtml: string): StrapiBlockNode[] {
  const items: StrapiBlockNode[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(listHtml)) !== null) {
    // Strip inner <p> tags that Tiptap sometimes wraps in list items
    const content = match[1].replace(/<\/?p[^>]*>/g, '');
    items.push({ type: 'list-item', children: parseInlineNodes(content) });
  }

  return items;
}

export function htmlToStrapiBlocks(html: string): StrapiBlockNode[] | null {
  if (!html || !html.trim()) return null;

  const blocks: StrapiBlockNode[] = [];

  // Match top-level block elements
  const blockRegex = /<(p|h[1-3]|ul|ol)[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1];
    const content = match[2];

    if (tag === 'p') {
      blocks.push({ type: 'paragraph', children: parseInlineNodes(content) });
    } else if (tag.startsWith('h')) {
      blocks.push({ type: 'heading', level: parseInt(tag[1], 10), children: parseInlineNodes(content) });
    } else if (tag === 'ul') {
      blocks.push({ type: 'list', format: 'unordered', children: parseListItems(content) });
    } else if (tag === 'ol') {
      blocks.push({ type: 'list', format: 'ordered', children: parseListItems(content) });
    }
  }

  return blocks.length > 0 ? blocks : null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type LooseNode = { type: string; text?: unknown; bold?: unknown; italic?: unknown; children?: unknown };

function inlineToHtml(children: unknown): string {
  if (!Array.isArray(children)) return '';
  return (children as LooseNode[])
    .map(child => {
      if (child.type !== 'text') return '';
      let text = escapeHtml(String(child.text ?? ''));
      if (child.bold) text = `<strong>${text}</strong>`;
      if (child.italic) text = `<em>${text}</em>`;
      return text;
    })
    .join('');
}

/** Reverse of `htmlToStrapiBlocks`. Accepts any blocks array the CMS returns. */
export function strapiBlocksToHtml(blocks: readonly unknown[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return '';

  return (blocks as (LooseNode & { level?: number; format?: string })[])
    .map(block => {
      switch (block.type) {
        case 'heading': {
          const level = block.level || 1;
          return `<h${level}>${inlineToHtml(block.children)}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${inlineToHtml(block.children)}</p>`;
        case 'list': {
          const tag = block.format === 'ordered' ? 'ol' : 'ul';
          const items = (Array.isArray(block.children) ? (block.children as LooseNode[]) : [])
            .map(item => `<li>${inlineToHtml(item.children)}</li>`)
            .join('');
          return `<${tag}>${items}</${tag}>`;
        }
        default:
          return '';
      }
    })
    .join('');
}
