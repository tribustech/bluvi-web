import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';

/*
 * The editor's schema = what the create-competition fields round-trip through Strapi blocks
 * (core/organizer/domain/richText.ts htmlToStrapiBlocks ⇄ strapiBlocksToHtml): paragraphs,
 * headings 1–3, bullet and numbered lists (one level), bold and italic. fish's TenTap editor (the
 * same TipTap / ProseMirror schema) offers more (links, quotes, code, strike, underline, nesting),
 * which the conversion drops on save; the web leaves those out, so what the organizer sees is
 * what gets saved. Pasted HTML (and the AI's answer) is parsed into this schema: anything else
 * falls back to plain paragraphs / text.
 */

/**
 * Tab leaves the editor (keyboard users are never trapped, WCAG 2.1.2) instead of nesting a list
 * item — a nested list does not survive htmlToStrapiBlocks. Returning true from handleDOMEvents
 * stops ProseMirror's own keymaps without preventing the browser's focus move.
 */
const TabLeavesEditor = Extension.create({
  name: 'tabLeavesEditor',
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tabLeavesEditor'),
        props: {
          handleDOMEvents: {
            keydown: (_view, event) => event.key === 'Tab',
          },
        },
      }),
    ];
  },
});

export const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    // No line break inside a block (Strapi blocks keep none the competition page shows): HTML with
    // <br> (the AI's answer, pasted text) goes through model.ts normalizeLineBreaks first.
    hardBreak: false,
    horizontalRule: false,
    link: false,
    strike: false,
    underline: false,
    // TipTap 3 appends an empty paragraph after a trailing list / heading: it would be saved as an
    // empty Strapi paragraph block (fish's TipTap 2 bridge has no trailing node).
    trailingNode: false,
  }),
  TabLeavesEditor,
];
