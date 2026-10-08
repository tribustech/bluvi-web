'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoldIcon,
  H1Icon,
  H2Icon,
  H3Icon,
  ItalicIcon,
  ListBulletIcon,
  NumberedListIcon,
} from '@heroicons/react/24/outline';
import { useEditorState, type Editor } from '@tiptap/react';
import { cn } from '@/components/ui/cn';

/*
 * organizer.rich-text-editor c3 — the formatting toolbar: fish DEFAULT_TOOLBAR_ITEMS, limited to
 * what Strapi blocks keep (extensions.ts): undo / redo, bold / italic, headings 1–3, bullet and
 * numbered lists. One WAI-ARIA toolbar: a single tab stop, arrows (Home / End) move between the
 * buttons; marks and blocks are toggle buttons (aria-pressed). A press keeps the editor's
 * selection (mousedown does not take focus away from the text).
 */

type Item = {
  key: string;
  label: string;
  icon: ReactNode;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
  enabled?: (e: Editor) => boolean;
};

const GROUPS: Item[][] = [
  [
    { key: 'undo', label: 'Anulează', icon: <ArrowUturnLeftIcon />, run: e => e.chain().focus().undo().run(), enabled: e => e.can().undo() },
    { key: 'redo', label: 'Refă', icon: <ArrowUturnRightIcon />, run: e => e.chain().focus().redo().run(), enabled: e => e.can().redo() },
  ],
  [
    { key: 'bold', label: 'Îngroșat', icon: <BoldIcon />, run: e => e.chain().focus().toggleBold().run(), active: e => e.isActive('bold') },
    { key: 'italic', label: 'Cursiv', icon: <ItalicIcon />, run: e => e.chain().focus().toggleItalic().run(), active: e => e.isActive('italic') },
  ],
  [
    { key: 'h1', label: 'Titlu 1', icon: <H1Icon />, run: e => e.chain().focus().toggleHeading({ level: 1 }).run(), active: e => e.isActive('heading', { level: 1 }) },
    { key: 'h2', label: 'Titlu 2', icon: <H2Icon />, run: e => e.chain().focus().toggleHeading({ level: 2 }).run(), active: e => e.isActive('heading', { level: 2 }) },
    { key: 'h3', label: 'Titlu 3', icon: <H3Icon />, run: e => e.chain().focus().toggleHeading({ level: 3 }).run(), active: e => e.isActive('heading', { level: 3 }) },
  ],
  [
    { key: 'bullet', label: 'Listă cu puncte', icon: <ListBulletIcon />, run: e => e.chain().focus().toggleBulletList().run(), active: e => e.isActive('bulletList') },
    { key: 'ordered', label: 'Listă numerotată', icon: <NumberedListIcon />, run: e => e.chain().focus().toggleOrderedList().run(), active: e => e.isActive('orderedList') },
  ],
];

const ITEMS = GROUPS.flat();

export function Toolbar({ editor, disabled = false, className }: { editor: Editor; disabled?: boolean; className?: string }) {
  // Re-render on selection / content changes only for the flags the buttons show.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      Object.fromEntries(ITEMS.map(i => [i.key, { active: i.active?.(e) ?? false, enabled: i.enabled?.(e) ?? true }])) as Record<
        string,
        { active: boolean; enabled: boolean }
      >,
  });
  const [current, setCurrent] = useState(ITEMS[2].key);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ITEMS.map(i => i.key);
    const at = keys.indexOf(current);
    const next =
      event.key === 'ArrowRight' ? (at + 1) % keys.length
      : event.key === 'ArrowLeft' ? (at - 1 + keys.length) % keys.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? keys.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    setCurrent(keys[next]);
    refs.current[keys[next]]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatare text"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      data-testid="rte-toolbar"
      className={cn('flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]', className)}
    >
      {GROUPS.map((group, g) => (
        <div key={g} className={cn('flex shrink-0 items-center gap-0.5', g > 0 && 'border-l border-hairline pl-1')}>
          {group.map(item => {
            const s = state?.[item.key] ?? { active: false, enabled: true };
            const off = disabled || !s.enabled;
            return (
              <button
                key={item.key}
                ref={el => {
                  refs.current[item.key] = el;
                }}
                type="button"
                tabIndex={current === item.key ? 0 : -1}
                aria-label={item.label}
                title={item.label}
                aria-pressed={item.active ? s.active : undefined}
                aria-disabled={off || undefined}
                data-key={item.key}
                onMouseDown={e => e.preventDefault()}
                onFocus={() => setCurrent(item.key)}
                onClick={() => {
                  if (!off) item.run(editor);
                }}
                className={cn(
                  'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 [&>svg]:size-5 md:size-10 xl:size-9',
                  'transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill hover:text-ink',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  s.active && 'bg-accent-tint text-accent-ink hover:bg-accent-tint hover:text-accent-ink',
                  off && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-ink-2',
                )}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
