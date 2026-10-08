'use client';

import { useId, useRef, useState } from 'react';
import { SettingsSwitch } from '@/components/account/settings/SwitchRow';
import { cn } from '@/components/ui/cn';
import type { LocalSession } from '@/core/partide';
import { useSiteToast } from '../../../../../_shell/Toast';
import { useLivePartide } from '../../../../_live';
import { CARD } from './parts';

/*
 * «Partidă publică» (fish InfoScene; c8): a switch while the partidă is live, the read-only
 * «Publică» / «Privată» once it ended.
 *
 * Turning it OFF is the privacy opt-out (docs/domain/lakes-and-social.md invariant 14): the CMS
 * purges the edge synchronously and FAILS the PATCH when Cloudflare does, so the write is awaited
 * here, never fired and forgotten — the switch shows the new value at once (aria-busy, «Se
 * salvează…»), and on failure goes back to the projection's value with an error toast. A success
 * keeps the new value until the realtime projection agrees (no flicker back meanwhile). One write at
 * a time: a click while one is in flight is ignored.
 *
 * Web: the switch is the owner's — the CMS answers PARTIDA:OWNER_ONLY to anyone else
 * (controllers/fishing-session.ts OWNER_ONLY_PATCH_FIELDS); fish shows a member a switch whose write
 * always fails silently. A member reads «Publică» / «Privată» instead.
 */

export const VISIBILITY_ERROR = 'Nu am putut schimba vizibilitatea partidei. Încearcă din nou.';

export function PublicSwitch({ session, editable }: { session: LocalSession; editable: boolean }) {
  const live = useLivePartide();
  const toast = useSiteToast();
  const labelId = useId();
  const helperId = useId();
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const shown = wanted ?? session.visibleOnProfile;

  // A new value from the projection (the saved one caught up, or another device changed it): it
  // wins over the local one — adjusted during render, not in an effect.
  const [seen, setSeen] = useState(session.visibleOnProfile);
  if (seen !== session.visibleOnProfile) {
    setSeen(session.visibleOnProfile);
    if (!pending) setWanted(null);
  }

  const onChange = async (next: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setWanted(next);
    setPending(true);
    try {
      const repo = await live.repo();
      await repo.updateMeta(session.clientId, { visibleOnProfile: next });
    } catch (err) {
      console.warn('[partida visibility]', err);
      setWanted(null);
      toast(VISIBILITY_ERROR, 'danger');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <div data-testid="setari-public" className={cn(CARD, 'flex items-center gap-4 px-4 py-3.5')}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {editable ? (
          <label id={labelId} htmlFor={`${labelId}-switch`} className="cursor-pointer t-body-strong text-ink">
            Partidă publică
          </label>
        ) : (
          <span className="t-body-strong text-ink">Partidă publică</span>
        )}
        <p id={helperId} className="t-caption text-muted">
          Vizibilă în comunitate și pe profil — ceilalți văd doar capturile, nu locul exact sau alte detalii.
        </p>
        {pending ? (
          <p role="status" className="t-caption text-accent-ink">
            Se salvează…
          </p>
        ) : null}
      </div>
      {editable ? (
        <SettingsSwitch id={`${labelId}-switch`} checked={shown} busy={pending} onChange={v => void onChange(v)} describedBy={helperId} />
      ) : (
        <span data-testid="setari-public-value" className="shrink-0 t-label text-muted">
          {session.visibleOnProfile ? 'Publică' : 'Privată'}
        </span>
      )}
    </div>
  );
}
