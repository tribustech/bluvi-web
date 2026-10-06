import { Fragment, type ReactNode } from 'react';
import { PhoneIcon } from '@heroicons/react/20/solid';
import type { RichTextNode } from '@/core/shared';
import { cn } from '@/components/ui/cn';
import { hasRichText, linkEvent, readLink, type LinkTracking } from './content';

/*
 * fish components/CustomBlocksRenderer.tsx — a Strapi «blocks» rich text, the news article's and
 * the sponsor's. Server-safe (no hooks): the article is HTML in the first response.
 *
 * Kit gap: T3 DetailProse renders the same blocks for lake descriptions, but every heading level
 * as one h3, no phone links, no list dashes and no link payload — this is the fish renderer:
 *  - paragraph: body, semibold, 8px apart; Strapi's empty paragraphs are the author's blank lines
 *    (fish's only paragraph spacing), each one more 8px here;
 *  - heading 1 / 2 / 3: title1 / heading / bodyStrong (4–6 fall back to title1, as fish). The page
 *    h1 is the article's title, so the levels shift one down in the outline (h2 / h3 / h4);
 *  - lists, ordered or not: one item per line prefixed «- » (fish `list-item`), in a real <ul>/<ol>;
 *  - bold, italic, underline (fish modifiers) and strikethrough / code (Strapi's other two);
 *  - a «\n» inside a text (a soft line break) is a new line, as in fish (<br>);
 *  - a link opens its URL in a new tab; a «tel» link dials, in accent with a phone glyph (fish
 *    prints «📞 …»; Fundații keeps emoji out of the UI, so the kit's 20/solid phone icon stands in).
 *    Each link carries what fish logs on press (data-analytics-*: news_link_clicked /
 *    sponsor_link_clicked with the url) for the GA4 listener of M8.
 * Empty or missing content renders nothing (fish `!content || content.length === 0`).
 */
export function RichText({
  blocks,
  tracking,
  className,
}: {
  blocks: RichTextNode[] | null | undefined;
  /** fish `trackingData`: the event and its params, without the url (added per link). */
  tracking?: LinkTracking;
  className?: string;
}) {
  if (!hasRichText(blocks)) return null;
  return (
    <div className={cn('flex flex-col gap-2 t-body text-ink-2', className)}>
      {blocks.map((b, i) => (
        <Block key={i} node={b} tracking={tracking} />
      ))}
    </div>
  );
}

const HEADING: Record<number, { as: 'h2' | 'h3' | 'h4'; className: string }> = {
  1: { as: 'h2', className: 't-title1 text-ink' },
  2: { as: 'h3', className: 't-heading text-ink' },
  3: { as: 'h4', className: 't-body-strong text-ink' },
};

const isEmptyInline = (nodes: RichTextNode[] | undefined) => (nodes ?? []).every((c) => c.type === 'text' && !c.text);

function Block({ node, tracking }: { node: RichTextNode; tracking?: LinkTracking }): ReactNode {
  const kids = <Inline nodes={node.children ?? []} tracking={tracking} />;
  switch (node.type) {
    case 'paragraph':
      // An empty paragraph is a blank line the author typed: it adds one more block gap (fish has no
      // gap between blocks, so its blank line is the only paragraph spacing; the web has both).
      return isEmptyInline(node.children) ? <p aria-hidden className="h-2" /> : <p>{kids}</p>;
    case 'heading': {
      const level = typeof node.level === 'number' ? node.level : 1;
      const h = HEADING[level] ?? HEADING[1];
      const H = h.as;
      return <H className={cn(h.className, 'mb-1 text-pretty')}>{kids}</H>;
    }
    case 'list':
      return <List node={node} tracking={tracking} />;
    case 'quote':
      return <blockquote className="border-l-2 border-hairline pl-3 text-muted">{kids}</blockquote>;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-control bg-soft-fill p-3">
          <code>{(node.children ?? []).map((c) => c.text ?? '').join('')}</code>
        </pre>
      );
    default:
      // Strapi's inline image block and any later block type: fish's renderer has no case for them.
      return null;
  }
}

function List({ node, tracking }: { node: RichTextNode; tracking?: LinkTracking }) {
  const ordered = node.format === 'ordered';
  const L = ordered ? 'ol' : 'ul';
  return (
    <L className={cn('flex list-none flex-col', !ordered && 'mb-1 gap-1')}>
      {(node.children ?? []).map((li, i) =>
        li.type === 'list' ? (
          // A nested list (Strapi indents it inside the parent list).
          <li key={i} className="pl-4">
            <List node={li} tracking={tracking} />
          </li>
        ) : (
          <li key={i}>
            <span aria-hidden> - </span>
            <Inline nodes={li.children ?? []} tracking={tracking} />
          </li>
        ),
      )}
    </L>
  );
}

function Inline({ nodes, tracking }: { nodes: RichTextNode[]; tracking?: LinkTracking }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'link' && typeof n.url === 'string') return <Link key={i} node={n} url={n.url} tracking={tracking} />;
        let out: ReactNode = lineBreaks(n.text ?? '');
        if (n.code) out = <code className="rounded-badge bg-soft-fill px-1">{out}</code>;
        if (n.bold) out = <strong className="font-bold">{out}</strong>;
        if (n.italic) out = <em>{out}</em>;
        if (n.underline) out = <span className="underline">{out}</span>;
        if (n.strikethrough) out = <s>{out}</s>;
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </>
  );
}

/**
 * A line break typed inside a paragraph (Shift+Enter in the Strapi editor) is a «\n» in the text:
 * fish's Text renders it as a new line (its patched renderer keeps the raw text), the web as <br>
 * (Strapi's own web renderer) — never collapsed into a space.
 */
function lineBreaks(text: string): ReactNode {
  const lines = text.split(/\r?\n|\r/);
  if (lines.length === 1) return text;
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

function Link({ node, url, tracking }: { node: RichTextNode; url: string; tracking?: LinkTracking }) {
  const link = readLink(url);
  const event = linkEvent(tracking, link.href);
  const data = event ? { 'data-analytics-event': event.event, 'data-analytics-params': JSON.stringify(event.params) } : {};
  const kids = <Inline nodes={node.children ?? []} />;
  if (link.kind === 'tel') {
    return (
      <a href={link.href} {...data} className="font-bold text-accent-ink underline underline-offset-2">
        <PhoneIcon aria-hidden className="mr-1 inline size-4 align-[-0.15em]" />
        {kids}
      </a>
    );
  }
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      {...data}
      className="text-accent-ink underline underline-offset-2"
    >
      {kids}
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
