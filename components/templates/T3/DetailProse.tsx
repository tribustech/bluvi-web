'use client';

import { Fragment, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { RichTextNode } from '@/core/shared';
import { cn } from '@/components/ui/cn';

/*
 * T3 long text — a Strapi «blocks» rich text (lake description, competition rules) held to the
 * ~720px reading measure (ROADMAP §4: only long reading text is capped).
 *
 * `collapsed` = fish ExpandableText: the first lines with a fade and «Citește mai mult»; fish then
 * opens the whole text on its own page, the web expands it in place («Arată mai puțin» folds it).
 * The toggle only appears when the text is actually longer than the fold.
 *
 * `stripLeadingLabel`: CMS texts often open with their own bold label («**Descriere:**CHITA LAKE…»)
 * under a section already titled so. A leading bold run equal to it (any case, optional colon) is
 * dropped and the text after it trimmed — the CMS text itself is left alone.
 */

export function DetailProse({
  blocks: raw,
  collapsed = false,
  stripLeadingLabel,
  className,
}: {
  blocks: RichTextNode[];
  collapsed?: boolean;
  stripLeadingLabel?: string;
  className?: string;
}) {
  const blocks = stripLeadingLabel ? stripLabel(raw, stripLeadingLabel) : raw;
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(collapsed);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !collapsed) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1 || open);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed, open]);

  const folded = collapsed && !open;
  return (
    <div className={cn('flex max-w-180 flex-col gap-2', className)}>
      <div
        id={id}
        ref={ref}
        className={cn(
          'flex flex-col gap-3 t-body text-ink-2',
          folded && 'max-h-30 overflow-hidden xl:max-h-33',
          folded && overflows && '[mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
        )}
      >
        {blocks.map((b, i) => (
          <Block key={i} node={b} />
        ))}
      </div>
      {collapsed && overflows ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(o => !o)}
          className="self-start rounded-badge t-body-strong text-accent-ink underline-offset-2 hover:underline"
        >
          {open ? 'Arată mai puțin' : 'Citește mai mult'}
        </button>
      ) : null}
    </div>
  );
}

/** Drop a leading bold «Label:» from the first paragraph (see `stripLeadingLabel`). */
function stripLabel(blocks: RichTextNode[], label: string): RichTextNode[] {
  const first = blocks[0];
  const kids = first?.type === 'paragraph' ? (first.children ?? []) : [];
  const lead = kids[0];
  const norm = (s: string) => s.trim().replace(/:$/, '').trim().toLocaleLowerCase('ro');
  if (!lead || lead.type !== 'text' || !lead.bold || norm(lead.text ?? '') !== norm(label)) return blocks;
  const rest = kids.slice(1);
  if (rest[0]?.type === 'text') rest[0] = { ...rest[0], text: (rest[0].text ?? '').trimStart() };
  const empty = rest.every(c => c.type === 'text' && !c.text);
  return empty ? blocks.slice(1) : [{ ...first, children: rest }, ...blocks.slice(1)];
}

function Block({ node }: { node: RichTextNode }): ReactNode {
  const kids = <Inline nodes={node.children ?? []} />;
  switch (node.type) {
    case 'heading': {
      const level = typeof node.level === 'number' ? node.level : 3;
      return level <= 3 ? <h3 className="t-heading text-ink">{kids}</h3> : <h4 className="t-body-strong text-ink">{kids}</h4>;
    }
    case 'list': {
      const items = (node.children ?? []).map((li, i) => (
        <li key={i}>
          <Inline nodes={li.children ?? []} />
        </li>
      ));
      return node.format === 'ordered' ? (
        <ol className="list-decimal pl-5">{items}</ol>
      ) : (
        <ul className="list-disc pl-5">{items}</ul>
      );
    }
    case 'quote':
      return <blockquote className="border-l-2 border-hairline pl-3 text-muted">{kids}</blockquote>;
    case 'paragraph': {
      // Strapi writes empty paragraphs as spacers; the gap already spaces blocks.
      const empty = (node.children ?? []).every(c => c.type === 'text' && !c.text);
      return empty ? null : <p>{kids}</p>;
    }
    default:
      return <p>{kids}</p>;
  }
}

function Inline({ nodes }: { nodes: RichTextNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'link' && typeof n.url === 'string') {
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-ink underline underline-offset-2">
              <Inline nodes={n.children ?? []} />
            </a>
          );
        }
        let out: ReactNode = n.text ?? '';
        if (n.code) out = <code className="rounded-badge bg-soft-fill px-1">{out}</code>;
        if (n.bold) out = <strong className="font-bold text-ink">{out}</strong>;
        if (n.italic) out = <em>{out}</em>;
        if (n.underline) out = <span className="underline">{out}</span>;
        if (n.strikethrough) out = <s>{out}</s>;
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </>
  );
}
