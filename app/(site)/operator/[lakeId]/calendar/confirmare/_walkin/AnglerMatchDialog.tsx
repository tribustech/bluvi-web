'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { MatchedUser } from './model';
import { ReputationLine } from './ReputationLine';

/*
 * The typed number belongs to an app account — fish features/lakes/booking/AnglerMatchSheet.tsx
 * (c11): linking is the operator's call, so it arrives as an explicit question (avatar, username,
 * the number as typed — the lookup does not carry it back —, the reputation line) rather than an
 * inline toggle missed while typing. A sheet on a phone, an alert dialog from 768
 * (ResponsiveSurface «decision»): focus is held inside and returns to the field. «Leagă contul» /
 * «Nu, rezervare separată»; Escape (or the sheet's dismiss) counts as not linking — the screen
 * records the answer for this number, so it is not asked again for it.
 */
export function AnglerMatchDialog({
  open,
  user,
  phone,
  onLink,
  onSkip,
}: {
  open: boolean;
  user: MatchedUser | null;
  phone: string;
  onLink: () => void;
  /** «Nu, rezervare separată», Escape, the sheet's dismiss. */
  onSkip: () => void;
}) {
  const name = user?.username ?? 'Cont existent';
  return (
    <ResponsiveSurface
      open={open}
      onClose={onSkip}
      intent="decision"
      title="Cont Bluvi găsit"
      subtitle="Numărul introdus aparține unui cont existent. Legăm rezervarea de acest cont?"
      sheetSnap="fit"
      actions={
        <div className="flex w-full flex-col gap-2.5 md:flex-row-reverse">
          <Button className="md:flex-1" onClick={onLink} data-testid="angler-match-link">
            Leagă contul
          </Button>
          <Button variant="outline" className="md:flex-1" onClick={onSkip} data-testid="angler-match-skip">
            Nu, rezervare separată
          </Button>
        </div>
      }
    >
      {open ? (
        <div data-testid="angler-match" className="mt-2 flex items-center gap-3.5 rounded-card bg-page p-3.5">
          <Avatar name={name} src={user?.avatar} size={64} shape="square" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="t-title2 truncate text-ink">{name}</p>
            <p className="t-body text-muted tabular-nums" data-testid="angler-match-phone">
              {phone}
            </p>
            <ReputationLine userId={user?.documentId} />
          </div>
        </div>
      ) : null}
    </ResponsiveSurface>
  );
}
