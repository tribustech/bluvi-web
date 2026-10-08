'use client';

import { useEffect, useRef } from 'react';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useWizard } from '../context';
import { buildExplanationView, explanationParam, formTypeFor, type ExplanationSectionView, type ExplanationTarget } from './model';

export { explanationParam, parseExplanationParam, type ExplanationTarget } from './model';

/*
 * The ranking explanation over step 3 «Tip clasament» (parity organizer.ranking-explanation c1–c3,
 * organizer.step-ranking c11; fish create-competition/ranking-explanation.tsx — an orphan screen —
 * and step-ranking.tsx's in-page sheet). The frame (WizardScreen) renders it while
 * ?explicatie=<explanationParam(target)> is in the URL.
 *
 * The kit's surface rule, intent `reading` (components/surfaces/rule.ts): <768 a Sheet fitted to its
 * content (draggable handle, like every other sheet), from 768 a wide Dialog (760 px, a ≤ 720 px
 * reading column), body scrolling under the title, «Am înțeles» pinned. X / Escape / scrim close.
 * Opening (and a new target) moves focus to the title (tabIndex -1, no ring: owner rule 8) and
 * starts the body from the top.
 *
 * Closing: an entry the wizard pushed (the step's «Vezi explicația completă», history depth > 0) is
 * left with history.back() — no duplicate step entry, no dead Back; a deep link (the wizard's first
 * entry) drops the param in place (onClose, replace).
 */

/** context.tsx DEPTH_KEY: the depth the wizard stamps on every entry it pushes (0 = its first entry). */
const WIZARD_DEPTH_KEY = 'bluviWizardDepth';

function pushedByWizard(): boolean {
  const d = (window.history.state as Record<string, unknown> | null)?.[WIZARD_DEPTH_KEY];
  return typeof d === 'number' && d > 0;
}

export function RankingExplanationPanel({ target, onClose }: { target: ExplanationTarget; onClose: () => void }) {
  const { values } = useWizard();
  const param = explanationParam(target);
  // The form type only feeds a bare «grila» (and the frame mounts after a draft has hydrated, so
  // it never shows a generic grid rule first); every other target ignores it.
  const view = buildExplanationView(target, formTypeFor(target, values.rankingType));
  const surface = pickSurface('reading', useBreakpoint());
  const body = useRef<HTMLDivElement>(null);

  const close = () => {
    if (pushedByWizard()) window.history.back();
    else onClose();
  };

  // showModal() focuses the first control (the X); the reader starts at the title instead. Only a
  // new ?explicatie= starts again from the top (a draft hydrating / auto-saving does not).
  useEffect(() => {
    const scroller = body.current?.parentElement;
    scroller?.scrollTo({ top: 0 });
    // The sheet's scrolling body holds only text: make it reachable by keyboard (axe
    // scrollable-region-focusable). The dialog's scroller already holds the X.
    if (scroller && surface === 'sheet' && !scroller.hasAttribute('tabindex')) scroller.tabIndex = 0;
    const heading = body.current?.closest('dialog')?.querySelector<HTMLHeadingElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.style.outline = 'none';
    heading.focus({ preventScroll: true });
  }, [param, surface]);

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="reading"
      title={view.title}
      subtitle={view.eyebrow}
      sheetSnap="fit"
      pinnedActions
      actions={
        <Button onClick={close} block={surface === 'sheet'}>
          Am înțeles
        </Button>
      }
    >
      <div ref={body} data-testid="ranking-explanation-body" data-surface={surface} className="flex flex-col gap-7 pt-3">
        {view.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
      </div>
    </ResponsiveSurface>
  );
}

/** One section: its optional heading (a numbered sub-heading «1.2 …» one step smaller), then its paragraphs. */
function Section({ section }: { section: ExplanationSectionView }) {
  const sub = section.level === 2;
  return (
    <section data-testid="ranking-explanation-section" className={cn('flex flex-col gap-2', sub && 'border-l-2 border-hairline pl-4')}>
      {section.heading ? (
        sub ? <h4 className="t-body-strong">{section.heading}</h4> : <h3 className="t-heading">{section.heading}</h3>
      ) : null}
      {section.paragraphs.map((p, i) => (
        <div key={i} className="flex flex-col gap-1">
          {p.label ? <p className="t-body-strong text-ink">{p.label}:</p> : null}
          <p className="t-body whitespace-pre-line text-ink-2">{p.text}</p>
        </div>
      ))}
    </section>
  );
}
