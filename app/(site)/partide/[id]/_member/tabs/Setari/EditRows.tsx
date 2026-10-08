'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlagIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { lakeQuery, type LakeDetailStand } from '@/core/lakes';
import type { LocalSession, TargetSpecies } from '@/core/partide';
import type { SessionMetaPatch } from '@/core/realtime/partide';
import { FishIcon } from '@/components/icons/brand';
import { SpeciesPicker } from '@/components/partide/species/SpeciesPicker';
import { StandPicker } from '@/components/partide/stand/StandPicker';
import { useLivePartide } from '../../../../_live';
import { useSiteToast } from '../../../../../_shell/Toast';
import { positionLabel, speciesLabel, standAnchorPatch, standCoordinates } from './model';
import { Group, NavRow } from './parts';

/*
 * «Editează» (fish InfoScene editRows; c5, c6) — a live partidă only:
 *  - «Poziție» opens the adjust map (the frame's MapPointPicker);
 *  - «Specii vizate» opens the species picker and saves `targetSpecies`;
 *  - «Stand», only when the lake has stands («Alege standul» when none): choosing one moves the
 *    anchor to the stand's coordinates (when valid) and sets standId / standName, then — once the
 *    list has closed — opens the adjust map for fine-tuning (fish handleStandSheetDismiss), centred
 *    on the stand itself: the map does not wait for the projection to bring the new anchor back.
 * Writes are fish's: PATCH /feed/sessions/:id through the live repo (never Firestore). Unlike fish
 * (fire and forget), the row shows the chosen value at once and keeps it until the projection
 * agrees; a failed save goes back to the projection's value with an error toast — as «Partidă
 * publică» on the same tab does (rule 4: never show a value that was not saved).
 *
 * The stands are the lake's (GET /feed/lakes/:id, the public cached read fish's useLake makes); a
 * public water, a pin, or a lake whose read failed / has none → no «Stand» row (rule 4).
 */

export const EDIT_ERROR = 'Nu am putut salva modificarea. Încearcă din nou.';

type Coord = { lat: number; lng: number };
type Overlay = Partial<Pick<LocalSession, 'targetSpecies' | 'standId' | 'standName' | 'anchorLat' | 'anchorLng'>>;

export function EditRows({ session, onAdjustPosition }: { session: LocalSession; onAdjustPosition: (center?: Coord) => void }) {
  const live = useLivePartide();
  const toast = useSiteToast();
  const isLake = session.venueType === 'lake' && !!session.lakeId;
  const lake = useQuery(lakeQuery(live.transport, session.lakeId ?? '', { enabled: isLake }));
  const stands = useMemo<LakeDetailStand[]>(() => (isLake ? (lake.data?.stands ?? []) : []), [isLake, lake.data]);

  const [speciesOpen, setSpeciesOpen] = useState(false);
  const [standOpen, setStandOpen] = useState(false);

  // The chosen values until the projection brings them back (or the save fails).
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const projected = `${session.anchorLat},${session.anchorLng}|${session.standId ?? ''}|${session.standName ?? ''}|${session.targetSpecies.map(t => t.name).join(',')}`;
  const [seen, setSeen] = useState(projected);
  if (seen !== projected) {
    setSeen(projected);
    if (!inFlight) setOverlay(null);
  }
  const view: LocalSession = overlay ? { ...session, ...overlay } : session;

  // fish pendingAdjustRef: a stand was picked → the adjust map opens once the list has closed
  // (StandPicker calls onSelect, then onClose), on the stand's own coordinates when it has them.
  const adjustAfterStand = useRef<{ center?: Coord } | null>(null);
  const closeStand = () => {
    setStandOpen(false);
    const next = adjustAfterStand.current;
    if (!next) return;
    adjustAfterStand.current = null;
    onAdjustPosition(next.center);
  };

  const write = async (patch: SessionMetaPatch & Overlay) => {
    setOverlay(o => ({ ...o, ...patch }));
    setInFlight(n => n + 1);
    try {
      const repo = await live.repo();
      await repo.updateMeta(session.clientId, patch);
    } catch (err) {
      console.warn('[partida setări]', err);
      setOverlay(null);
      toast(EDIT_ERROR, 'danger');
    } finally {
      setInFlight(n => n - 1);
    }
  };
  const saveSpecies = (targets: TargetSpecies[]) => void write({ targetSpecies: targets });
  const selectStand = (stand: LakeDetailStand | null) => {
    void write(standAnchorPatch(session, stand));
    if (stand) adjustAfterStand.current = { center: standCoordinates(stand) ?? undefined };
  };

  return (
    <>
      <Group id="setari-editeaza" title="Editează" testId="setari-edit">
        <NavRow icon={<MapPinIcon />} label="Poziție" value={positionLabel(view)} onClick={() => onAdjustPosition()} testId="setari-edit-pozitie" />
        <NavRow icon={<FishIcon />} label="Specii vizate" value={speciesLabel(view) ?? '—'} onClick={() => setSpeciesOpen(true)} testId="setari-edit-specii" />
        {stands.length > 0 ? (
          <NavRow icon={<FlagIcon />} label="Stand" value={view.standName ?? 'Alege standul'} onClick={() => setStandOpen(true)} testId="setari-edit-stand" />
        ) : null}
      </Group>
      <SpeciesPicker open={speciesOpen} initial={view.targetSpecies} onSave={saveSpecies} onClose={() => setSpeciesOpen(false)} />
      <StandPicker open={standOpen} stands={stands} selectedId={view.standId} onSelect={selectStand} onClose={closeStand} />
    </>
  );
}
