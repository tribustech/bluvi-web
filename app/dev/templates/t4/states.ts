/** Every state the T4 demo can be forced into (`?state=`). */
export const DEMO_STATES = [
  { key: 'default', label: 'Implicit', hint: 'Date reale, pasul 1' },
  { key: 'signed-out', label: 'Neautentificat', hint: 'Fluxul cere cont' },
  { key: 'empty', label: 'Gol', hint: 'Rezervări oprite' },
  { key: 'no-availability', label: 'Fără locuri', hint: 'Nicio disponibilitate' },
  { key: 'loading', label: 'Se încarcă', hint: 'Schelet' },
  { key: 'error', label: 'Eroare', hint: 'Disponibilitatea nu a venit' },
  { key: 'invalid', label: 'Validare', hint: 'Pasul 1 refuzat' },
  { key: 'too-soon', label: 'Prea curând', hint: 'Azi / mâine: doar telefonic' },
  { key: 'quoting', label: 'Se calculează', hint: 'Selecție făcută, prețul vine' },
  { key: 'quote-error', label: 'Preț eșuat', hint: 'Cererea de preț a căzut' },
  { key: 'extras', label: 'Pasul 2', hint: 'Extra, preț live' },
  { key: 'review', label: 'Rezumat', hint: 'Pasul 3, contact' },
  { key: 'contact-invalid', label: 'Contact invalid', hint: 'Pasul 3 refuzat' },
  { key: 'refusal', label: 'Preț refuzat', hint: 'Refuzul serverului' },
  { key: 'draft', label: 'Ciornă', hint: 'Reluare + salvare automată' },
  { key: 'save-error', label: 'Salvare eșuată', hint: 'Autosave cu eroare' },
  { key: 'submitting', label: 'Se trimite', hint: 'Acțiune în curs' },
  { key: 'submit-error', label: 'Trimitere eșuată', hint: 'Serverul nu a răspuns' },
  { key: 'price-changed', label: 'Preț schimbat', hint: '409 PRICE_CHANGED: rămâi, preț recalculat' },
  { key: 'stand-taken', label: 'Stand ocupat', hint: 'STAND_TAKEN: înapoi la pasul 1, stand golit' },
  { key: 'unknown-error', label: 'Eroare necunoscută', hint: 'Cod necunoscut la trimitere' },
  { key: 'done', label: 'Trimis', hint: 'Confirmare' },
] as const;

export type DemoState = (typeof DEMO_STATES)[number]['key'];

/** The flow's steps (`?step=`). */
export const STEP_IDS = ['interval', 'extras', 'confirm'] as const;
export type StepId = (typeof STEP_IDS)[number];

/**
 * What the URL says about the flow (BookingDemo mirrors its step and selection there): the step,
 * then the selection — day (lake-local yyyy-mm-dd), start (hh:mm), hours, stand (documentId),
 * extras (comma-separated keys). A reload or a shared link resumes the flow; Back walks the steps.
 * `sent`: the booking was sent (the real screen: its id) — the outcome, never a step again.
 */
export type FlowParams = {
  step?: StepId;
  day?: string;
  start?: string;
  hours?: number;
  stand?: string;
  extras?: string[];
  sent?: string;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function readFlowParams(sp: Raw | URLSearchParams): FlowParams {
  const get = (k: string) => (sp instanceof URLSearchParams ? (sp.get(k) ?? undefined) : one(sp[k]));
  const step = get('step');
  const day = get('day');
  const start = get('start');
  const hours = Number(get('hours'));
  const extras = get('extras');
  return {
    step: STEP_IDS.includes(step as StepId) ? (step as StepId) : undefined,
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined,
    start: start && /^\d{2}:\d{2}$/.test(start) ? start : undefined,
    hours: Number.isFinite(hours) && hours > 0 ? hours : undefined,
    stand: get('stand'),
    extras: extras ? extras.split(',').filter(Boolean) : undefined,
    sent: get('sent'),
  };
}
