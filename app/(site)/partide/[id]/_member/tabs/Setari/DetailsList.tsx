import type { LocalSession } from '@/core/partide';
import { sessionSubtitle } from '@/core/partide';
import { venueName } from '../../model';
import { detailRows } from './model';
import { FactRow, Group } from './parts';

/*
 * «Detalii» (fish InfoScene readRows; c4): «Baltă» (the venue name over its subtitle), then the
 * timing facts — live and ended differ —, «Reper» when set, and for a read-only partidă the
 * settings themselves (Poziție, Specii vizate, Stand).
 */
export function DetailsList({ session, isEnded, readOnly }: { session: LocalSession; isEnded: boolean; readOnly: boolean }) {
  return (
    <Group id="setari-detalii" title="Detalii" testId="setari-details">
      <FactRow label="Baltă" value={venueName(session)} sub={sessionSubtitle(session)} testId="setari-detail-row" />
      {detailRows(session, isEnded, readOnly).map(row => (
        <FactRow key={row.label} label={row.label} value={row.value} testId="setari-detail-row" />
      ))}
    </Group>
  );
}
