'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import { cn } from '@/components/ui/cn';
import { PROSE_MAX } from '@/components/nav/shell';
import { EDITOR_EXTENSIONS } from './extensions';
import { normalizeLineBreaks } from './model';
import { ToolbarSkeleton } from './ToolbarSkeleton';
import { Toolbar } from './Toolbar';

/*
 * The TipTap surface of the rich text editor (c3) — loaded client-only (index.tsx next/dynamic,
 * ssr: false), so the wizard's prerender never touches ProseMirror. It opens with the field's
 * HTML, focused at the end (fish useEditorBridge autofocus), and hands the instance up (onReady):
 * «Gata», «Formatează cu AI» and «Copiază» read / replace the content through it.
 *
 * The text column is capped at the reading width (ROADMAP §4: long text ~720 px).
 */

/** The text styles of the content: the same scale as the competition page's rules (RichText). */
const PROSE = cn(
  'min-h-full px-4 py-5 t-body text-ink outline-none md:px-6 xl:px-8',
  '[&_p]:my-2 [&_p:first-child]:mt-0',
  '[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:t-title1 [&_h1:first-child]:mt-0',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:t-heading [&_h2:first-child]:mt-0',
  '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:t-body-strong [&_h3:first-child]:mt-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li_p]:my-1',
  '[&_strong]:font-bold [&_em]:italic',
);

/**
 * The example text while the editor is empty (one empty paragraph): drawn by the paragraph's
 * ::before from the --rte-ph custom property, so it is never part of the content or of getHTML().
 */
// Literal classes (Tailwind only sees whole class names in the source).
const PLACEHOLDER = cn(
  '[&>p:only-child:has(>br.ProseMirror-trailingBreak:only-child)]:before:pointer-events-none',
  '[&>p:only-child:has(>br.ProseMirror-trailingBreak:only-child)]:before:float-left',
  '[&>p:only-child:has(>br.ProseMirror-trailingBreak:only-child)]:before:h-0',
  '[&>p:only-child:has(>br.ProseMirror-trailingBreak:only-child)]:before:text-muted',
  '[&>p:only-child:has(>br.ProseMirror-trailingBreak:only-child)]:before:content-(--rte-ph)',
);

type Props = {
  initialContent: string;
  /** Example text shown while the editor is empty (also its accessible description). */
  placeholder: string;
  /** The field's title (the editor's accessible name). */
  label: string;
  /** Toolbar and text are read-only (the AI is formatting). */
  disabled?: boolean;
  onReady: (editor: TiptapEditor | null) => void;
};

export default function Editor({ initialContent, placeholder, label, disabled = false, onReady }: Props) {
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: normalizeLineBreaks(initialContent),
    autofocus: 'end',
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      // Text pasted from Docs / Word carries <br>: the schema has no hard break (normalizeLineBreaks).
      transformPastedHTML: normalizeLineBreaks,
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        'aria-placeholder': placeholder,
        'data-testid': 'rte-content',
        class: cn(PROSE, PLACEHOLDER),
        style: `--rte-ph: ${JSON.stringify(placeholder)}`,
      },
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <>
      <div className="flex shrink-0 items-center border-b border-hairline px-2 py-1 md:px-4">
        {editor ? <Toolbar editor={editor} disabled={disabled} /> : <ToolbarSkeleton />}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto" data-testid="rte-scroll">
        <div className={cn('h-full w-full', PROSE_MAX, disabled && 'opacity-60')}>
          {editor ? <EditorContent editor={editor} className="h-full [&>div]:min-h-full" /> : null}
        </div>
      </div>
    </>
  );
}
