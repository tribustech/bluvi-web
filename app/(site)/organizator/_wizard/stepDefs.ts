import { WIZARD_STEPS, type WizardStep } from '@/lib/routes';

/**
 * The wizard's six steps (organizer.wizard.c1; fish app/(app)/create-competition/_layout.tsx STEPS):
 * the `[pas]` segment, the title the header shows, and the step name fish's analytics / error
 * reports carry (createCompetitionAnalytics.ts deriveCreateCompetitionStep).
 */
export type WizardStepDef = {
  slug: WizardStep;
  title: string;
  analytics: 'basics' | 'config' | 'ranking' | 'lake-sectors' | 'stand-allocation' | 'review';
  /** fish `isEditCompetitionMode && <Button>`: the footer's save button only when editing a published competition. */
  saveOnlyInEdit?: true;
};

export const WIZARD_STEP_DEFS: readonly WizardStepDef[] = [
  { slug: 'detalii', title: 'Detalii de bază', analytics: 'basics' },
  { slug: 'configurare', title: 'Configurare competiție', analytics: 'config' },
  { slug: 'clasament', title: 'Tip clasament', analytics: 'ranking', saveOnlyInEdit: true },
  { slug: 'lac-si-sectoare', title: 'Lac și sectoare', analytics: 'lake-sectors' },
  { slug: 'standuri', title: 'Alocă standuri', analytics: 'stand-allocation' },
  { slug: 'revizuire', title: 'Revizuire', analytics: 'review' },
];

export const WIZARD_STEP_COUNT = WIZARD_STEP_DEFS.length;

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && (WIZARD_STEPS as readonly string[]).includes(value);
}

/** 0-based index of a step (0 for anything unknown). */
export function stepIndex(slug: string | null | undefined): number {
  const i = WIZARD_STEP_DEFS.findIndex(s => s.slug === slug);
  return i >= 0 ? i : 0;
}

/** The step a wizard URL is on: its last path segment when that is a step, else null. */
export function stepFromPath(pathname: string | null | undefined): WizardStep | null {
  const last = (pathname ?? '').split('?')[0].replace(/\/+$/, '').split('/').pop();
  return isWizardStep(last) ? last : null;
}
