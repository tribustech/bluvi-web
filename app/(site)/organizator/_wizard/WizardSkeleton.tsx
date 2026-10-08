import { T4SectionSkeleton, T4Skeleton, type T4Back } from '@/components/templates/T4';
import { WIZARD_STEP_COUNT, WIZARD_STEP_DEFS, stepIndex } from './stepDefs';

/**
 * The wizard while its draft / competition (and its lake) loads (organizer.wizard.c25; fish
 * DraftLoadingSkeleton: the name field, the banner, the description, the dates, the rewards). The
 * real header (the step title, «Pasul N din 6» from the URL), grey bars for the progress, the
 * summary column's shape from 1280 and the action bar as it will render.
 */
export function WizardSkeleton({ step, eyebrow, back }: { step?: string; eyebrow?: string; back?: T4Back }) {
  // Without a step (the route's static shell cannot read the URL): the template's «Se încarcă…».
  const def = step ? WIZARD_STEP_DEFS[stepIndex(step)] : null;
  return (
    <div data-testid="wizard-skeleton">
      <T4Skeleton
        eyebrow={eyebrow}
        title={def?.title}
        back={back}
        steps={WIZARD_STEP_COUNT}
        current={step ? stepIndex(step) + 1 : 1}
        primaryLabel={def?.slug === 'revizuire' ? 'Publică competiția' : 'Următorul pas'}
        priceRows={0}
        railHelp={1}
      >
        <T4SectionSkeleton fields={2} helpers={[0]} />
        <T4SectionSkeleton fields={1} />
        <T4SectionSkeleton fields={2} columns={2} />
      </T4Skeleton>
    </div>
  );
}
