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
 * - Plain text → text inline node (entities decoded)
 * - <strong>/<em> nested in any order and depth (a real walk, not one level of regex)
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

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * The text of an HTML text run: entities decoded (TipTap's getHTML() escapes & < > and writes
 * &nbsp; for runs of spaces — the Strapi text node must hold «Crap & amur», not «Crap &amp; amur»).
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return code === 0xa0 ? ' ' : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Inline HTML → text nodes. A real nested walk: marks are counters carried down the open tags, so
 * `<strong>Premiu mare <em>special</em></strong>` keeps «Premiu mare » (bold) and «special» (bold +
 * italic) — ProseMirror nests bold above italic, so a word made italic inside a bold run always
 * produces that shape. Unknown inline tags (span, a, u…) keep their text; <br> is a line break.
 * Adjacent runs with the same marks merge.
 */
function parseInlineNodes(html: string): TextInlineNode[] {
  const nodes: TextInlineNode[] = [];
  let bold = 0;
  let italic = 0;

  const push = (raw: string) => {
    const text = decodeHtmlEntities(raw);
    if (!text) return;
    const last = nodes[nodes.length - 1];
    const b = bold > 0;
    const it = italic > 0;
    if (last && Boolean(last.bold) === b && Boolean(last.italic) === it) {
      last.text += text;
      return;
    }
    const node: TextInlineNode = { type: 'text', text };
    if (b) node.bold = true;
    if (it) node.italic = true;
    nodes.push(node);
  };

  const tokens = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>|([^<]+)|(<)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(html)) !== null) {
    const [, closing, rawTag, selfClosing, text, strayLt] = match;
    if (text != null) {
      push(text);
      continue;
    }
    if (strayLt != null) {
      push('<');
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (tag === 'br') {
      push('\n');
      continue;
    }
    if (selfClosing) continue;
    const delta = closing ? -1 : 1;
    if (tag === 'strong' || tag === 'b') bold = Math.max(0, bold + delta);
    else if (tag === 'em' || tag === 'i') italic = Math.max(0, italic + delta);
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
