'use client';

import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeftIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { hasMeaningfulEditorContent, strapiBlocksToHtml } from '@/core/organizer';
import type { RichTextNode } from '@/core/shared';
import { Dialog } from '@/components/surfaces/Dialog';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useWizard } from '../context';
import { ActionChip } from './ActionChip';
import { AiFormatButton, type FormatStatus } from './AiFormatButton';
import { CopyFromCompetitionPanel } from './CopyFromCompetitionPanel';
import { ToolbarSkeleton } from './ToolbarSkeleton';
import { normalizeLineBreaks, panelCopy, RICH_TEXT_FIELDS, RICH_TEXT_PLACEHOLDERS, type RichTextField } from './model';

export { parseRichTextField, RICH_TEXT_FIELDS, type RichTextField } from './model';

/*
 * The rich text editor over step 1 (parity organizer.rich-text-editor c1–c9; fish
 * app/(app)/create-competition/rich-text-editor.tsx). The wizard frame renders it instead of
 * StepDetalii while the URL has ?editor=descriere|premii|regulament (unknown → Descriere) and hides
 * its own action bar meanwhile.
 *
 * Layout (T4): <768 a full-screen editor over the page (fish's screen: header, actions, toolbar,
 * text); from 768 the same editor as one large card in the wizard's form column — the step list
 * and the summary stay beside it from 1280. The card is as tall as the viewport allows and the text
 * scrolls inside it, under the toolbar, so the toolbar never leaves the text it formats.
 *
 * c1 header: back (leaves without applying — the browser's Back does the same), the field title,
 *    «Gata». c2 «Gata» stores the editor HTML in the field (dirty) and auto-saves at once, then
 *    returns to the step. c3 TipTap (client-only chunk; the prerender never loads it), opened
 *    focused at the end of the field's content, with the toolbar. c4 actions row: «Copiază din altă
 *    competiție» (Descriere, Regulament), «Formatează cu AI» (all). c5 AiFormatButton. c6–c8
 *    CopyFromCompetitionPanel. c9 «Copiază» replaces the text, asking first when it holds real text.
 *
 * Unapplied text (the editor's HTML differs from what it opened with) is never dropped silently by
 * an exit other than the editor's own back: the wizard's header back, progress and step list are
 * off while the editor is open (fish: a full-screen route whose only exits are back and «Gata»),
 * and `onDirtyChange` feeds the wizard's leave guard (links, closing the tab), whose «Salvează»
 * applies the text first (`handle.apply`).
 *
 * <768 the editor is a modal layer: role=dialog + aria-modal, everything else on the page inert,
 * Escape = back (unless the copy panel or a confirm dialog is open).
 *
 * Leaving: an entry the wizard pushed (the step's «Editează») is left with history.back(), so the
 * editor never leaves a dead Back entry; a deep link (the wizard's first entry) drops the param in
 * place (replace).
 */

const Editor = dynamic(() => import('./Editor'), { ssr: false, loading: () => <EditorLoading /> });

/** context.tsx DEPTH_KEY: the depth the wizard stamps on every entry it pushes (0 = its first entry). */
const WIZARD_DEPTH_KEY = 'bluviWizardDepth';

function pushedByWizard(): boolean {
  const d = (window.history.state as Record<string, unknown> | null)?.[WIZARD_DEPTH_KEY];
  return typeof d === 'number' && d > 0;
}

/** What the wizard frame can do with an open editor. */
export type RichTextEditorHandle = {
  /** Store the editor's text in the form now (no auto-save): the leave guard's «Salvează». */
  apply: () => void;
};

type Props = {
  field: RichTextField;
  /** The text differs from what the editor opened with (false again on close). */
  onDirtyChange?: (dirty: boolean) => void;
  handle?: Ref<RichTextEditorHandle>;
};

export function RichTextEditor({ field, onDirtyChange, handle }: Props) {
  const w = useWizard();
  const def = RICH_TEXT_FIELDS[field];
  const copy = panelCopy(field);
  const titleId = useId();
  // The field's content when the editor opened (fish watch(field) at mount); later form changes
  // (an auto-save answer) never reset what the organizer is typing.
  const [initialContent] = useState(() => w.values[def.key] ?? '');
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [formatStatus, setFormatStatus] = useState<FormatStatus>('idle');
  const [copyOpen, setCopyOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const closingRef = useRef(false);
  const currentId = w.draftId ?? w.competitionId ?? null;

  const sectionRef = useRef<HTMLElement>(null);
  const phone = useBreakpoint() === 'mobile';
  // The editor's own HTML when it opened: getHTML() normalises the field's HTML (e.g. <li><p>), so
  // «changed» is measured against this, never against the raw field value.
  const baselineRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const onDirtyRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyRef.current = onDirtyChange;
  }, [onDirtyChange]);

  const onReady = useCallback((e: TiptapEditor | null) => {
    baselineRef.current = e ? e.getHTML() : null;
    setEditor(e);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const dirty = baselineRef.current != null && editor.getHTML() !== baselineRef.current;
      if (dirty === dirtyRef.current) return;
      dirtyRef.current = dirty;
      onDirtyRef.current?.(dirty);
    };
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);
  useEffect(
    () => () => {
      if (dirtyRef.current) onDirtyRef.current?.(false);
    },
    [],
  );

  /**
   * The value «Gata» stores, or null when there is nothing to store: the text did not change, or
   * a field that had no text is still empty. A cleared field is '' (rule 4: no blank section) —
   * unless it held text before: then the empty paragraph is kept, because the draft PUT omits an
   * empty field (fish buildCompetitionPayload) and '' would leave the old text on the server.
   */
  const nextValue = (): string | null => {
    if (!editor) return null;
    const html = editor.getHTML();
    if (html === baselineRef.current) return null;
    if (hasMeaningfulEditorContent(html)) return html;
    if (!hasMeaningfulEditorContent(initialContent)) return null;
    return html;
  };

  useImperativeHandle(handle, () => ({
    apply: () => {
      const value = nextValue();
      if (value != null) w.setValue(def.key, value);
    },
  }));

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (pushedByWizard()) window.history.back();
    else w.setQuery({ editor: null }, { replace: true });
  };

  // c2 — fish handleDone: setValue(field, html, { shouldDirty }) + autoSaveDraft() + back.
  const done = () => {
    if (!editor) return;
    const value = nextValue();
    if (value != null) w.setValue(def.key, value, { autoSave: 'now' });
    close();
  };

  // The AI's answer may hold <br> (normalizeLineBreaks); a copied field never does.
  const replaceWith = (html: string) => {
    editor?.chain().setContent(normalizeLineBreaks(html)).focus('end').run();
  };

  // c9 — fish handleConfirmCopy.
  const copyFrom = (blocks: RichTextNode[]) => {
    const html = strapiBlocksToHtml(blocks);
    if (!html || !editor) return;
    if (hasMeaningfulEditorContent(editor.getHTML())) {
      setPending(html);
      return;
    }
    setCopyOpen(false);
    replaceWith(html);
  };

  usePhoneScrollLock();
  usePhoneInertBackground(sectionRef, phone);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Not gated on defaultPrevented: ProseMirror binds Escape (selectParentNode) and prevents it.
    if (e.key !== 'Escape' || !phone || copyOpen || pending != null) return;
    e.preventDefault();
    close();
  };

  const formatting = formatStatus === 'loading';

  return (
    <section
      ref={sectionRef}
      role={phone ? 'dialog' : undefined}
      aria-modal={phone ? true : undefined}
      onKeyDown={onKeyDown}
      aria-labelledby={titleId}
      data-testid="rich-text-editor"
      data-field={field}
      className={cn(
        'fixed inset-0 z-overlay flex flex-col bg-surface',
        'md:relative md:inset-auto md:z-auto md:h-[calc(100dvh-var(--spacing)*80)] md:min-h-120 md:overflow-hidden md:rounded-card md:shadow-e0',
        'xl:h-[calc(100dvh-var(--spacing)*74)]',
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-3 md:px-5">
        <button
          type="button"
          onClick={close}
          aria-label="Înapoi, fără să aplici modificările"
          title="Înapoi"
          data-testid="rte-back"
          className={cn(
            'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control bg-soft-fill text-ink-2 xl:size-10',
            'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint hover:text-accent-ink active:opacity-70',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <ChevronLeftIcon aria-hidden className="size-5" />
        </button>
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-center t-heading text-ink md:text-left md:t-title2">
          {def.title}
        </h2>
        <Button size="compact" onClick={done} disabled={!editor || formatting} data-testid="rte-done" className="min-w-18">
          Gata
        </Button>
      </header>

      <div className="relative shrink-0 border-b border-hairline">
        <div className="flex items-center gap-2.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:px-5" data-testid="rte-actions">
          {def.copy ? (
            <ActionChip
              icon={<DocumentDuplicateIcon aria-hidden />}
              onClick={() => {
                editor?.commands.blur();
                setCopyOpen(true);
              }}
              disabled={!editor || formatting}
              aria-haspopup="dialog"
              data-testid="rte-copy"
            >
              Copiază din altă competiție
            </ActionChip>
          ) : null}
          <AiFormatButton
            getText={() => editor?.getText() ?? null}
            onFormatted={replaceWith}
            onStatusChange={setFormatStatus}
            disabled={!editor}
          />
        </div>
        {/* fish's fade at the end of the actions row: there is more to scroll on a narrow phone. */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-surface to-transparent md:hidden" />
      </div>

      <Editor initialContent={initialContent} placeholder={RICH_TEXT_PLACEHOLDERS[field]} label={def.title} disabled={formatting} onReady={onReady} />

      {copyOpen ? (
        <CopyFromCompetitionPanel
          field={field}
          currentId={currentId}
          onClose={() => {
            setCopyOpen(false);
            editor?.commands.focus();
          }}
          onCopy={copyFrom}
        />
      ) : null}

      <Dialog
        open={pending != null}
        onClose={() => setPending(null)}
        title={copy.confirmTitle}
        description={copy.confirmText}
        alert
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} data-testid="rte-replace-cancel">
              Renunță
            </Button>
            <Button
              onClick={() => {
                const html = pending;
                setPending(null);
                setCopyOpen(false);
                if (html) replaceWith(html);
              }}
              data-testid="rte-replace-confirm"
            >
              Copiază
            </Button>
          </>
        }
      />
    </section>
  );
}

/** The editor chunk is loading: the toolbar's shape and a few text lines (no layout jump). */
function EditorLoading() {
  return (
    <>
      <div className="flex shrink-0 items-center border-b border-hairline px-2 py-1 md:px-4">
        <ToolbarSkeleton />
      </div>
      <div aria-hidden className="flex flex-1 flex-col gap-3 px-4 py-5 md:px-6 xl:px-8" data-testid="rte-loading">
        <span className="h-4 w-11/12 max-w-160 animate-pulse rounded-badge bg-soft-fill" />
        <span className="h-4 w-4/5 max-w-140 animate-pulse rounded-badge bg-soft-fill" />
        <span className="h-4 w-3/5 max-w-110 animate-pulse rounded-badge bg-soft-fill" />
      </div>
    </>
  );
}

/**
 * <768 the editor covers the page: everything else is inert (no focus, no screen reader) — every
 * sibling of the editor and of each of its ancestors up to <body>. Only what it made inert is
 * restored; dialogs opened later (portals, the top layer) are new nodes and stay live.
 */
function usePhoneInertBackground(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const made: HTMLElement[] = [];
    for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sib of Array.from(parent.children)) {
        if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
        if (sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE') continue;
        sib.inert = true;
        made.push(sib);
      }
    }
    return () => made.forEach(m => (m.inert = false));
  }, [ref, active]);
}

/** <768 the editor covers the page: the page behind must not scroll under it. */
function usePhoneScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia(`(max-width: ${BREAKPOINT_MD - 0.02}px)`);
    let locked = false;
    const prev = root.style.overflow;
    const apply = () => {
      if (mq.matches && !locked) {
        root.style.overflow = 'hidden';
        locked = true;
      } else if (!mq.matches && locked) {
        root.style.overflow = prev;
        locked = false;
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      if (locked) root.style.overflow = prev;
    };
  }, []);
}
