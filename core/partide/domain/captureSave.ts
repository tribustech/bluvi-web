/**
 * The capture flow's pure save semantics. Ported from fish:
 *  - `features/partide/scenes/captureSave.ts#decideCaptureSave` — the spec §2.4 matrix;
 *  - `features/partide/scenes/captureDetail.ts#buildCaptureDetails` — form → log / resolve details;
 *  - `features/partide/domain/hooks.ts#buildEvent` / `#buildRuntimeMetaPatch` — the event a rod
 *    cycle's resolve emits and the runtime patch it persists (applyRodResult's pure halves);
 *  - `app/(app)/partide/captura.tsx` — MAX_WEIGHT_KG, clampWeight, applyTimePick.
 * The hooks' atom reads/writes, uuid minting, clocks, alerts and navigation are the caller's.
 */
import { anchorCoord } from './castGeometry';
import type { LogCaptureDetail } from './captureEdits';
import { laneForRod } from './derivedLane';
import type { RodEffect } from './rodCycle';
import { effectivePhase } from './rodPhase';
import type { AlarmSound, Lane, LocalEvent, LocalRod, LocalSession, RodRuntime, TargetSpecies } from './types';

/**
 * Hard ceiling on a logged catch, in kilograms. Mirrors `MAX_WEIGHT_KG` in the CMS
 * (`src/api/session-event/controllers/session-event.ts`), which rejects anything above it with
 * `PARTIDA:WEIGHT_OUT_OF_RANGE` — keep the two in step. A bad value here is permanent: it becomes
 * the session record and is summed into venue, community and profile aggregates.
 */
export const MAX_WEIGHT_KG = 60;

/** fish captura.tsx — the steppers' clamp: 0,1 kg … 60 kg, three decimals. */
export const clampWeight = (n: number): number => Math.min(MAX_WEIGHT_KG, Math.max(0.1, Math.round(n * 1000) / 1000));

/**
 * Applies a picked HH:MM onto `baseMs`'s calendar day; a result in the future rolls back 24h (an
 * overnight partidă: "23:40" picked at 01:00 means yesterday). fish captura.tsx#applyTimePick.
 */
export function applyTimePick(baseMs: number, picked: { hours: number; minutes: number }, now: number): number {
  const d = new Date(baseMs);
  d.setHours(picked.hours, picked.minutes, 0, 0);
  let ms = d.getTime();
  if (ms > now) ms -= 24 * 60 * 60 * 1000;
  return ms;
}

// ── the save matrix ─────────────────────────────────────────────────────────

export type CaptureDecision = { action: 'log' | 'resolve' | 'ask' };

/**
 * The spec §2.4 matrix, as a pure decision:
 *  - no rod                    → 'log'    (standalone capture)
 *  - rod 'firing' (expired)    → 'resolve' (close the cycle as a capture)
 *  - rod 'fishing' (running)   → 'ask'    (Continuă = log / Oprește = resolve)
 *  - rod 'idle' | 'ready'      → 'log'    (attributed, no cycle transition)
 * fish reads the runtime at `rodIndex - 1` (rods are numbered from 1 in array order).
 */
export function decideCaptureSave(rodIndex: number | null, runtimes: RodRuntime[], now: number): CaptureDecision {
  if (rodIndex == null) return { action: 'log' };
  const runtime = runtimes[rodIndex - 1];
  const phase = runtime ? effectivePhase(runtime, now) : undefined;
  if (phase === 'firing') return { action: 'resolve' };
  if (phase === 'fishing') return { action: 'ask' };
  return { action: 'log' };
}

// ── form → details ──────────────────────────────────────────────────────────

/** fish hooks.ts#ResolveDetail — the outcome payload: capture facts + snapshot overrides + flags. */
export type ResolveDetail = {
  weightKg?: number | null;
  weightEstimated?: boolean;
  species?: string | null;
  speciesId?: string | null;
  photoLocalUri?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  label?: string;
  color?: string;
  bait?: string;
  baitType?: string | null;
  baitSize?: number | null;
  baitFlavor?: string | null;
  lane?: Lane;
  distance?: number;
  alarmSound?: AlarmSound;
  updateRod?: boolean;
  andStop?: boolean;
  occurredAt?: number;
  photoTagUids?: string[] | null;
};

/** fish components/BaitEditor.tsx#BaitValue — the bait shape every bait-editing surface shares. */
export type BaitValue = { bait: string; baitType: string | null; baitSize: number | null; baitFlavor: string | null };

/**
 * The capture screen's form state, distilled to what save needs. `baitEdit === null` = the momeală
 * row was never touched (the rod snapshot's bait applies downstream); a non-null value — even one
 * whose `bait` is `''` — is an EXPLICIT edit that must NOT fall back to the rod.
 */
export type CaptureFormState = {
  rod: (LocalRod & { lane: Lane }) | null;
  weightKg: number | null;
  weightEstimated: boolean;
  species: TargetSpecies;
  baitEdit: BaitValue | null;
  photoLocalUri: string | null;
  coord: { lat: number; lng: number } | null;
  distance?: number | null;
  occurredAtMs?: number | null;
  photoTagUids?: string[] | null;
};

export type CaptureDetails = { log: LogCaptureDetail; resolve: ResolveDetail };

/**
 * fish captureDetail.ts#buildCaptureDetails. Precedence (spec §2/§3): the pin overrides the rod's
 * lat/lng; explicit bait fields override the rod snapshot; lane/distance always snapshot the rod
 * when one is selected. The rod is NEVER written from a catch (`updateRod` unset).
 */
export function buildCaptureDetails(form: CaptureFormState): CaptureDetails {
  const { rod, weightKg, species, baitEdit, photoLocalUri, coord } = form;
  // A weightless catch is never "estimated", it simply has no weight.
  const weightEstimated = weightKg == null ? false : form.weightEstimated;
  const photoTagUids = form.photoTagUids ?? null;
  const lat = coord?.lat ?? null;
  const lng = coord?.lng ?? null;
  // Notes input removed from the capture screen 2026-07-24 (write-only field — no display surface).
  const notes = null;
  const baitFields = baitEdit ? { bait: baitEdit.bait, baitType: baitEdit.baitType, baitSize: baitEdit.baitSize, baitFlavor: baitEdit.baitFlavor } : {};
  const timeFields = form.occurredAtMs != null ? { occurredAt: form.occurredAtMs } : {};
  const distanceFields = form.distance != null ? { distance: form.distance } : {};

  const log: LogCaptureDetail = {
    weightKg,
    weightEstimated,
    species: species.name,
    speciesId: species.id,
    photoLocalUri,
    photoTagUids,
    notes,
    lat,
    lng,
    ...baitFields,
    ...timeFields,
    ...distanceFields,
    rod: rod
      ? {
          index: rod.index,
          label: rod.label,
          color: rod.color,
          bait: rod.bait,
          baitType: rod.baitType,
          baitSize: rod.baitSize,
          baitFlavor: rod.baitFlavor,
          lane: rod.lane,
          distance: rod.distance,
        }
      : null,
  };

  const resolve: ResolveDetail = {
    weightKg,
    weightEstimated,
    species: species.name,
    speciesId: species.id,
    photoLocalUri,
    photoTagUids,
    notes,
    lat,
    lng,
    ...baitFields,
    ...timeFields,
    ...distanceFields,
  };

  return { log, resolve };
}

// ── rod-cycle resolve (applyRodResult's pure halves) ────────────────────────

const ov = <T>(value: T | undefined, fallback: T): T => (value !== undefined ? value : fallback);

/** fish hooks.ts#buildEvent — the catch a resolve's `emitEvent` effect writes. */
export function buildEvent(
  session: Pick<LocalSession, 'clientId' | 'rods' | 'anchorLat' | 'anchorLng'>,
  rod: LocalRod,
  eff: Extract<RodEffect, { type: 'emitEvent' }>,
  detail: ResolveDetail | undefined,
  clientId: string,
  now: number,
): LocalEvent {
  const d = detail ?? {};
  const hasPhoto = !!d.photoLocalUri;
  return {
    clientId,
    serverId: null,
    serverNumericId: null,
    syncStatus: 'pending',
    clientUpdatedAt: now,
    sessionClientId: session.clientId,
    outcome: eff.outcome,
    rodIndex: rod.index,
    rodLabel: ov(d.label, rod.label),
    rodColor: ov(d.color, rod.color),
    bait: ov(d.bait, rod.bait),
    baitType: ov(d.baitType, rod.baitType),
    baitSize: ov(d.baitSize, rod.baitSize),
    baitFlavor: ov(d.baitFlavor, rod.baitFlavor),
    // Lane is DERIVED for map-placed rods (relative to the swim's mean cast bearing) — the stored
    // rod.lane is only honest for schematic placements.
    lane: ov(d.lane, laneForRod(session.rods ?? [], rod, anchorCoord(session.anchorLat, session.anchorLng))),
    distance: ov(d.distance, rod.distance),
    lat: ov(d.lat, null),
    lng: ov(d.lng, null),
    weightKg: ov(d.weightKg, null),
    weightEstimated: ov(d.weightEstimated, false),
    species: ov(d.species, null),
    speciesId: ov(d.speciesId, null),
    photoLocalUri: ov(d.photoLocalUri, null),
    photoUploadStatus: hasPhoto ? 'pending' : 'none',
    photoUrl: null,
    photoTagUids: ov(d.photoTagUids, null),
    notes: ov(d.notes, null),
    occurredAt: ov(d.occurredAt, eff.occurredAt),
  };
}

/**
 * fish hooks.ts#buildRuntimeMetaPatch — the meta patch for a runtime transition, or null when
 * nothing should be persisted: 'firing' is derived (never stored), and an unchanged runtime must
 * not burn a write. Carries `changedRodIndex` so the write sends ONLY this rod.
 */
export function buildRuntimeMetaPatch(
  s: Pick<LocalSession, 'rods' | 'rodRuntimes'>,
  rodIndex: number,
  next: RodRuntime,
): { rods: LocalRod[]; rodRuntimes: RodRuntime[]; changedRodIndex: number } | null {
  const i = s.rods.findIndex(r => r.index === rodIndex);
  if (i < 0) return null;
  if (next.phase === 'firing') return null;
  const prev = s.rodRuntimes[i] ?? { phase: 'idle', endEpoch: null };
  if (prev.phase === next.phase && prev.endEpoch === next.endEpoch) return null;
  const rodRuntimes = s.rodRuntimes.slice();
  rodRuntimes[i] = next;
  return { rods: s.rods, rodRuntimes, changedRodIndex: rodIndex };
}
