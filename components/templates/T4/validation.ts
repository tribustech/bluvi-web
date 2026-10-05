import type { z } from 'zod';
import type { T4FieldError } from './types';

/** A field of the step, in the order it is shown: the error summary keeps that order. */
export type T4FieldSpec = {
  /** Key in the step's values (the zod path's first segment). */
  name: string;
  /** DOM id of the control, for the summary's link and the focus. */
  id: string;
  /** The field's visible label (the summary names it). */
  label: string;
};

export type T4StepValidation = {
  ok: boolean;
  /** First message per field, keyed by `name` — what each control shows under itself. */
  byField: Record<string, string>;
  /** The same errors in form order, for <T4ErrorSummary>. */
  list: T4FieldError[];
};

/**
 * The message already names its field: it contains the label's significant words («Alege ziua
 * sosirii.» for «Ziua sosirii»; «Alege un stand liber.» for «Standul» — a word's stem, so the
 * article ending does not hide it).
 */
function namesField(message: string, label: string): boolean {
  const m = message.toLocaleLowerCase('ro');
  return label
    .toLocaleLowerCase('ro')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .every((w) => m.includes(w.length > 5 ? w.slice(0, -2) : w));
}

/**
 * Per-step validation with the domain's own zod schema (core/organizer `createCompetitionSchema`
 * picked down to the step's keys, the booking contact schema…). The schema is the only source of
 * the messages, so web and fish say the same thing; this only orders them for the page.
 *
 * Issues on a key that is not in `fields` are kept at the end (labelled with the key) rather than
 * dropped: a step must never refuse to advance without saying why.
 */
export function validateStep(schema: z.ZodType, values: unknown, fields: T4FieldSpec[]): T4StepValidation {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, byField: {}, list: [] };

  const byField: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    if (!(key in byField)) byField[key] = issue.message;
  }
  const known = fields
    .filter((f) => f.name in byField)
    .map((f) => ({ id: f.id, label: f.label, message: byField[f.name], named: namesField(byField[f.name], f.label) }));
  const rest = Object.keys(byField)
    .filter((k) => !fields.some((f) => f.name === k))
    .map((k) => ({ id: k, label: k, message: byField[k] }));
  return { ok: false, byField, list: [...known, ...rest] };
}
