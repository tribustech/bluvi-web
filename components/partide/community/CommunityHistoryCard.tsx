'use client';

import { fmtKg, fmtSpan, membersLabel, standSuffix, type CommunityHistorySessionDTO } from '@/core/partide';
import { partideHrefs } from '@/lib/partide-pages';
import { catchesNoun, partidaRange } from '@/lib/partide-community';
import { CardHeader, PartidaCardShell, PhotoStrip, StatStrip } from './card';
import { CardFooter } from './parts';

/**
 * fish features/partide/components/community/CommunityHistoryCard.tsx — card D, a finished public
 * partidă (parity partide.comunitate.c17): «ÎNCHEIATĂ», the members as the title, venue + stand,
 * capturi · kg total · durată, the photo strip, the date range (Romania time) and «Vezi rezumatul».
 * It opens /partide/[documentId] once the web has the partidă page (lib/partide-pages).
 */
export function CommunityHistoryCard({ row }: { row: CommunityHistorySessionDTO }) {
  const href = partideHrefs.partida(row.documentId);
  const photos = row.photos ?? [];
  const duration = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
  return (
    <PartidaCardShell ribbon={{ variant: 'finished', label: 'Încheiată' }} interactive={!!href} testId="history-card">
      <CardHeader
        thumb={{ kind: 'members', members: row.members }}
        title={membersLabel(row.members)}
        href={href}
        meta={{ strong: row.venue.name, text: standSuffix(row.standName ?? null).trimStart() || undefined }}
      />
      <StatStrip
        stats={[
          { value: String(row.catchCount), label: catchesNoun(row.catchCount) },
          { value: row.totalKg == null ? '—' : fmtKg(row.totalKg), label: 'kg total', accent: true },
          { value: fmtSpan(duration), label: 'durată' },
        ]}
      />
      <PhotoStrip photos={photos} total={row.photoCount ?? photos.length} />
      <CardFooter left={<time dateTime={row.startedAt}>{partidaRange(row.startedAt, row.endedAt)}</time>} action={href ? 'Vezi rezumatul' : null} />
    </PartidaCardShell>
  );
}
