'use client';

import { InLucru } from '../steps/InLucru';
import { Button } from '@/components/ui/Button';
import { useWizard } from '../context';

/*
 * The rich text editor over step 1 (parity organizer.rich-text-editor) — STUB until its batch
 * replaces the body. Final signature: `export function RichTextEditor({ field })`. The frame renders
 * it instead of StepDetalii while the URL has ?editor=<field> (fields below); it owns its own back /
 * «Gata» (close: `setQuery({ editor: null })`), the frame hides its action bar meanwhile.
 */

export type RichTextField = 'descriere' | 'premii' | 'regulament';

/** URL field → form key and title (fish rich-text-editor.tsx FIELD_TITLES; unknown → Descriere, c1). */
export const RICH_TEXT_FIELDS: Record<RichTextField, { key: 'description' | 'reward' | 'regulation'; title: string }> = {
  descriere: { key: 'description', title: 'Descriere' },
  premii: { key: 'reward', title: 'Premii' },
  regulament: { key: 'regulation', title: 'Regulament' },
};

export function parseRichTextField(value: string | null | undefined): RichTextField {
  return value === 'premii' || value === 'regulament' ? value : 'descriere';
}

export function RichTextEditor({ field }: { field: RichTextField }) {
  const { setQuery } = useWizard();
  return (
    <>
      <InLucru title={RICH_TEXT_FIELDS[field].title} />
      <div>
        <Button variant="secondary" onClick={() => setQuery({ editor: null })}>
          Înapoi
        </Button>
      </div>
    </>
  );
}
