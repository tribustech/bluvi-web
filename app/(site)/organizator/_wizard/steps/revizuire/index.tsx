'use client';

import { useMemo, type ReactNode } from 'react';
import { IdentificationIcon, MapIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { T4ErrorSummary, T4Notice, type T4FieldError } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { useWizard } from '../../context';
import { buildReview, type ReviewSectionId } from './model';
import { ReviewSection, rowId } from './ReviewSection';

/**
 * Step «Revizuire» (parity organizer.step-review c1–c12; fish
 * app/(app)/create-competition/step-review.tsx). Four cards — Detalii de bază, Configurare,
 * Clasament, Lac și sectoare — each with «Editează» back to its step (red «Completează» while it
 * has an error), «Lipsește» for a missing value, the notes and the capacity warning. Above them
 * either the list of what still blocks publishing (T4ErrorSummary, shown on arrival so it never
 * steals focus; each line focuses its row) or a short «ready» notice. The frame (../../WizardScreen.tsx) owns the footer: «Publică
 * competiția» (or «Salvează modificările» when editing), disabled on the same errors
 * (../../model reviewErrors + the schema) and while an operation runs, spinning while it publishes
 * (c11, c12) — docked under the summary from 1280.
 *
 * Layout: one column on a phone; from a ~672px wide step column (a container query: the tablet,
 * and 1440+ beside the rail and the summary) the cards pair up two by two, the same height per
 * row (bento), the sectors as coloured tiles.
 */

const ICONS: Record<ReviewSectionId, ReactNode> = {
  basics: <IdentificationIcon />,
  config: <UserGroupIcon />,
  ranking: <TrophyIcon />,
  lakeSectors: <MapIcon />,
};

export function StepRevizuire() {
  const w = useWizard();
  const { values } = w;
  const lakeDetail = w.lake.data && w.lake.data.documentId === values.lake ? w.lake.data : null;
  // null: still loading (a neutral bar); undefined: could not be read (fish «Selectat»).
  const lakeName = lakeDetail ? lakeDetail.name : w.lake.error ? undefined : values.lake ? null : undefined;

  const review = useMemo(() => buildReview({ values, lakeName }), [values, lakeName]);

  // One line per problem; each link scrolls to (and focuses) its row in the card below.
  const problems: T4FieldError[] = review.problems.map((p) => ({ id: rowId(p.key), label: p.text, message: p.text, named: true }));

  return (
    <div data-testid="step-review" className="@container flex flex-col gap-4 md:gap-5">
      {review.hasAnyError ? (
        <T4ErrorSummary errors={problems} attempt={0} />
      ) : review.capacity ? (
        // Fewer stands than places: publishable, but not «all done» (fish shows no success banner).
        <T4Notice
          tone="warning"
          title="Poți publica, dar nu toți participanții vor avea stand"
          role="status"
          actions={
            <Button variant="secondary" size="compact" disabled={w.busy} onClick={() => w.goTo('standuri')}>
              Alocă standuri
            </Button>
          }
        >
          Alocă mai multe standuri sau scade numărul de locuri, apoi revino aici.
        </T4Notice>
      ) : (
        <T4Notice tone="success" title="Totul este completat" role="status">
          {w.mode === 'edit'
            ? 'Verifică detaliile de mai jos, apoi salvează modificările.'
            : 'Verifică detaliile de mai jos, apoi publică competiția.'}
        </T4Notice>
      )}
      <div className="grid gap-4 md:gap-5 @2xl:grid-cols-2">
        {review.sections.map((s) => (
          <ReviewSection
            key={s.id}
            section={s}
            icon={ICONS[s.id]}
            busy={w.busy}
            onEdit={() => w.goTo(s.step)}
          />
        ))}
      </div>
    </div>
  );
}
