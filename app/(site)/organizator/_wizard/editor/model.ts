import type { StatusTone } from '@/components/ui/StatusPill';

/*
 * The rich text editor's pure parts (parity organizer.rich-text-editor): the field table, the copy
 * of each field, the source status badge. fish app/(app)/create-competition/rich-text-editor.tsx and
 * components/competition/RegulationSourcePickerSheet.tsx.
 */

export type RichTextField = 'descriere' | 'premii' | 'regulament';

type FieldDef = {
  /** The form key (CreateCompetitionFormData). */
  key: 'description' | 'reward' | 'regulation';
  /** The header title (fish fieldTitles). */
  title: string;
  /** «Copiază din altă competiție» is offered (fish copyEnabledFields: description, regulation). */
  copy: boolean;
  /**
   * The field inside a sentence, articulated (fish lower-cases the title: «Înlocuiești
   * descriere?»; the web says it the way Romanian does).
   */
  the: string;
  /** The panel hint (fish «… ca să copiezi descriere existent(ă), apoi îl poți adapta …»), agreed in gender. */
  hint: string;
};

/** URL field → form key, title and copy (fish rich-text-editor.tsx fieldTitles; unknown → Descriere, c1). */
export const RICH_TEXT_FIELDS: Record<RichTextField, FieldDef> = {
  descriere: {
    key: 'description',
    title: 'Descriere',
    copy: true,
    the: 'descrierea',
    hint: 'Selectează o altă competiție ca să copiezi descrierea existentă, apoi o poți adapta mai ușor pentru competiția curentă.',
  },
  premii: {
    key: 'reward',
    title: 'Premii',
    copy: false,
    the: 'premiile',
    hint: '',
  },
  regulament: {
    key: 'regulation',
    title: 'Regulament',
    copy: true,
    the: 'regulamentul',
    hint: 'Selectează o altă competiție ca să copiezi regulamentul existent, apoi îl poți adapta mai ușor pentru competiția curentă.',
  },
};

/**
 * The empty editor's example text (fish helpers/createCompetitionRichTextEditorConfig.ts
 * CREATE_COMPETITION_RICH_TEXT_PLACEHOLDERS — defined there, shown here).
 */
export const RICH_TEXT_PLACEHOLDERS: Record<RichTextField, string> = {
  descriere:
    'Concurs de 72 de ore, împărțit pe 3 sectoare, cu premiere pentru clasamentul general și captură capitală. Include aici formatul, etapele, taxele și informațiile de contact.',
  regulament:
    'Se pescuiește cu maximum 4 lansete, punctează doar capturile de peste pragul stabilit, iar orice abatere de la regulament poate atrage avertisment sau eliminare.',
  premii:
    'Locul 1: trofeu + 10.000 lei. Locul 2: 7.000 lei. Locul 3: 5.000 lei. Cea mai mare captură: premiu special oferit de organizatori și sponsori.',
};

export function parseRichTextField(value: string | null | undefined): RichTextField {
  return value === 'premii' || value === 'regulament' ? value : 'descriere';
}

/** The source detail key the copy reads (fish contentKey: description for Descriere, else regulation). */
export function sourceContentKey(field: RichTextField): 'description' | 'regulation' {
  return field === 'descriere' ? 'description' : 'regulation';
}

/** The panel's copy for a field (fish RegulationSourcePickerSheet + rich-text-editor.tsx). */
export function panelCopy(field: RichTextField) {
  const f = RICH_TEXT_FIELDS[field];
  const lower = f.title.toLowerCase();
  return {
    listTitle: 'Copiază din altă competiție',
    hint: f.hint,
    previewTitle: `Previzualizare ${lower}`,
    loadingPreview: `Se încarcă ${f.the}...`,
    previewError: `Nu am putut încărca ${f.the} pentru această competiție.`,
    noContent: `Competiția selectată nu are ${lower}.`,
    confirmTitle: `Înlocuiești ${f.the}?`,
    confirmText: 'Textul existent va fi înlocuit.',
  };
}

/** fish getCompetitionStatusBadge: Ciornă / În viitor / În curs / Terminat; anything else has none. */
export function sourceStatusBadge(status: string | null | undefined): { label: string; tone: StatusTone } | null {
  switch (status) {
    case 'draft':
      return { label: 'Ciornă', tone: 'warning' };
    case 'notStarted':
      return { label: 'În viitor', tone: 'info' };
    case 'started':
      return { label: 'În curs', tone: 'success' };
    case 'completed':
      return { label: 'Terminat', tone: 'neutral' };
    default:
      return null;
  }
}

const DAY = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric' });

/** fish `new Date(startDate).toLocaleDateString('ro-RO')` (dd.mm.yyyy), in Romania's time; null without a date. */
export function sourceDate(startDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const d = new Date(startDate);
  return Number.isNaN(d.getTime()) ? null : DAY.format(d);
}

const BR = String.raw`<br\s*\/?>`;
const BLOCK = 'p|h[1-6]|ul|ol|li|div';

/**
 * <br> → the editor's schema, before HTML enters it (the AI's answer, pasted text). The editor has
 * no hard break (a line break inside a block does not survive Strapi blocks), and ProseMirror drops
 * a <br> it cannot place — gluing the text on both sides («100 leiLocul 2»). So: inside a list item
 * or a heading a break becomes a space; anywhere else it ends the paragraph and starts a new one
 * (a run of breaks = one split). Breaks at a block's edge or between blocks carry nothing: dropped.
 */
export function normalizeLineBreaks(html: string): string {
  if (!/<br/i.test(html)) return html;
  const edge = new RegExp(String.raw`(<(?:${BLOCK})\b[^>]*>)\s*(?:${BR}\s*)+|(?:\s*${BR})+\s*(?=</?(?:${BLOCK})\b)|(</(?:${BLOCK})>)\s*(?:${BR}\s*)+`, 'gi');
  let out = html.replace(edge, (_m, open: string | undefined, close: string | undefined) => open ?? close ?? '');
  out = out.replace(/<(li|h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag: string, attrs: string, inner: string) =>
    `<${tag}${attrs}>${inner.replace(new RegExp(String.raw`\s*(?:${BR}\s*)+`, 'gi'), ' ')}</${tag}>`,
  );
  out = out.replace(new RegExp(String.raw`\s*(?:${BR}\s*)+`, 'gi'), '</p><p>');
  return out;
}
