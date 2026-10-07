'use client';

import { ClockIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button, ButtonLink } from '@/components/ui/Button';
import { track } from '@/lib/analytics';

/*
 * «Rezervare din scurt» — fish TooSoonSheet (c15, c16). A free slot that starts inside the lake's
 * lead time cannot be requested online (the operator needs time to confirm), so its tap lands here:
 * the reason and, when the lake lists a phone, a direct call. A sheet on the phone, a dialog from
 * 768 (Fundații §07 `info`), over the grid — the selection panel and the selection stay as they are.
 */

/** Romanian hour phrase: «o oră», «12 ore», «24 de ore» (fish hoursRo). */
export const hoursRo = (h: number) => (h === 1 ? 'o oră' : `${h} ${h < 20 ? 'ore' : 'de ore'}`);

export function TooSoonDialog({
  open,
  onClose,
  leadHours,
  phone,
  lakeId,
  lakeName,
}: {
  open: boolean;
  onClose: () => void;
  leadHours: number;
  /** The lake's first contact phone; the call action is hidden without one. */
  phone: string | null;
  lakeId: string;
  lakeName: string;
}) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title="Rezervare din scurt"
      sheetSnap="fit"
      actions={
        <>
          {phone ? (
            <ButtonLink
              href={`tel:${phone}`}
              icon={<PhoneIcon />}
              onClick={() => track('contact_pressed', { contact_type: 'Lake too soon contact', lake_id: lakeId, lake_name: lakeName })}
            >
              Sună administratorul
            </ButtonLink>
          ) : null}
          <Button variant={phone ? 'secondary' : 'primary'} onClick={onClose}>
            Am înțeles
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3" data-testid="too-soon-body">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-fg">
          <ClockIcon className="size-6" />
        </span>
        <p className="t-body text-muted">
          {`Rezervările care încep în mai puțin de ${hoursRo(leadHours)} nu se pot face din aplicație — administratorul are nevoie de timp să confirme. Sună-l direct pentru un loc pe termen scurt.`}
        </p>
      </div>
    </ResponsiveSurface>
  );
}
