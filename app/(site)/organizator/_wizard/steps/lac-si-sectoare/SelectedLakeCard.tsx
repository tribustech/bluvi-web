'use client';

import { useState } from 'react';
import { formatCount } from '@/core/realtime/chat/format';
import { T4LineBar } from '@/components/templates/T4';

/*
 * fish step-lake-sectors.tsx:199-229 (organizer.step-lake-sectors c6): «Lac selectat», the name,
 * «N standuri disponibile» and the lake's photo. The count is the detail's stands: until the detail
 * is in (the card shows at once from the picked row) the line is a neutral bar, never «0 standuri»
 * (ROADMAP §4b rule 4).
 */

type Props = {
  name: string;
  photo: string | null;
  /** null while the lake's detail (with its stands) is loading. */
  standCount: number | null;
  /** The detail failed: no count line at all (rule 4), the step's notice says why. */
  standsError?: boolean;
};

export function SelectedLakeCard({ name, photo, standCount, standsError = false }: Props) {
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = photo && broken !== photo;
  return (
    <div className="flex items-center gap-4 rounded-card bg-accent-tint p-4 shadow-e0" data-testid="selected-lake">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="t-caption text-accent-ink">Lac selectat</p>
        <p className="t-title2 break-words text-ink">{name}</p>
        {standsError && standCount == null ? null : standCount == null ? (
          <T4LineBar type="t-caption" className="w-32" />
        ) : (
          <p className="t-caption text-ink-2" data-testid="selected-lake-stands">
            {formatCount(standCount, 'stand disponibil', 'standuri disponibile')}
          </p>
        )}
      </div>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- a CMS thumbnail, sized by CSS
        <img
          src={photo}
          alt=""
          onError={() => setBroken(photo)}
          className="h-16 w-22 shrink-0 rounded-control object-cover md:h-20 md:w-28"
          data-testid="selected-lake-photo"
        />
      ) : null}
    </div>
  );
}
