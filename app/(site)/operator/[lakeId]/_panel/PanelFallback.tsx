import { routes } from '@/lib/routes';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../_shared/OperatorFrame';
import { PANEL_TITLE } from './model';
import { PanelSpinner } from './PanelSpinner';

/**
 * The panel's first paint (Suspense fallback and loading.tsx), c3: the header — the lake's name and
 * the day still unknown (rule 4: placeholders, never «Balta») — and the centred spinner; no quick
 * actions until there is data. Back: Acasă, the one target that is always safe (_shared/back.ts).
 */
export function PanelFallback() {
  return (
    <OperatorFrame
      title={<OperatorTitleSkeleton />}
      caption={<span className="invisible">Azi</span>}
      back={{ fallbackHref: routes.home() }}
      trail={operatorTrail({ label: PANEL_TITLE })}
    >
      <PanelSpinner />
    </OperatorFrame>
  );
}
