import type { CompetitionDetail } from '@/core/competitions';
import type { AllocateStandsToSectorsRequest } from '@/core/organizer';
import { paletteLetter, sectorColorMap } from '@/components/ranking/sector';

/*
 * «Alocarea standurilor pe sectoare» (parity organizer.sectors; fish
 * app/(app)/configure/sectors/[competitionId].tsx) — the pure part: slots, the picker's options and
 * the request body. The screen keeps one `Slots` value (sector documentId → the stand documentId in
 * each slot, null = empty «-»).
 */

/** sector documentId → one entry per slot: a stand documentId, or null (an empty slot). */
export type Slots = Record<string, (string | null)[]>;

/** c3: only a competition that has not started yet may change its sectors (fish isEditingEnabled). */
export const isEditable = (c: Pick<CompetitionDetail, 'competitionStatus'>) => c.competitionStatus === 'notStarted';

/**
 * c4: «Nr. max standuri per sector» = ceil(participantsLimit / sectors), 1 when either is unknown
 * (fish nrOfStandsPerSector).
 */
export function standsPerSector(c: Pick<CompetitionDetail, 'participantsLimit' | 'sectors'>): number {
  if (!c.participantsLimit || c.sectors.length === 0) return 1;
  return Math.ceil(c.participantsLimit / c.sectors.length);
}

/**
 * c5: per sector that many slots, prefilled with the sector's current stands in order (fish
 * getFormDefaultValues: `<sector>-position-<i>` = stands[i]). fish keeps a stand beyond the slot
 * count in the form (it is saved again) but draws no slot for it; the web draws one, so nothing the
 * request sends is invisible — a sector never has fewer slots than stands.
 */
export function initialSlots(c: Pick<CompetitionDetail, 'participantsLimit' | 'sectors'>): Slots {
  const n = standsPerSector(c);
  return Object.fromEntries(
    c.sectors.map((s) => [
      s.documentId,
      Array.from({ length: Math.max(n, s.stands.length) }, (_, i) => s.stands[i]?.documentId ?? null),
    ]),
  );
}

/** Every stand placed in any slot (fish isStandAllocated). */
export function placedStands(slots: Slots): Set<string> {
  return new Set(Object.values(slots).flat().filter((v): v is string => v !== null));
}

export const setSlot = (slots: Slots, sectorId: string, index: number, standId: string | null): Slots => ({
  ...slots,
  [sectorId]: (slots[sectorId] ?? []).map((v, i) => (i === index ? standId : v)),
});

/**
 * The organizer's changes as a diff over the competition: `${sectorId}:${index}` → the stand placed
 * there (null = emptied). Applied over initialSlots(competition) on every render, so a refetch
 * (the header's refresh, a focus refetch, a co-editor's allocation, a new limit or a sector added in
 * the wizard) shows the server's data under the edits: a new sector keeps its server stands, a new
 * limit its slot count, and an edit whose sector or slot is gone is dropped.
 */
export type SlotEdits = Readonly<Record<string, string | null>>;

const editKey = (sectorId: string, index: number) => `${sectorId}:${index}`;

export function applyEdits(base: Slots, edits: SlotEdits): Slots {
  const keys = Object.keys(edits);
  if (keys.length === 0) return base;
  return Object.fromEntries(
    Object.entries(base).map(([sectorId, list]) => [
      sectorId,
      list.map((v, i) => {
        const k = editKey(sectorId, i);
        return k in edits ? (edits[k] ?? null) : v;
      }),
    ]),
  );
}

/** One slot changed: an edit back to the server's value is no edit at all (the page is clean again). */
export function withEdit(base: Slots, edits: SlotEdits, sectorId: string, index: number, standId: string | null): SlotEdits {
  const k = editKey(sectorId, index);
  const next = { ...edits };
  if ((base[sectorId]?.[index] ?? null) === standId) delete next[k];
  else next[k] = standId;
  return next;
}

export const isDirty = (initial: Slots, current: Slots) => JSON.stringify(initial) !== JSON.stringify(current);

export type StandOption = { standId: string; name: string; disabled: boolean };

/**
 * c6: the picker lists every lake stand in the lake's order; a stand already placed in any slot is
 * disabled (fish sheetOptions).
 */
export function standOptions(c: Pick<CompetitionDetail, 'lake'>, slots: Slots): StandOption[] {
  const placed = placedStands(slots);
  return (c.lake?.stands ?? []).map((s) => ({ standId: s.documentId, name: s.name, disabled: placed.has(s.documentId) }));
}

/**
 * A stand's name for a slot: the lake's stand (fish standsMap), else the sector's own copy (a stand
 * no longer on the lake list is still named, never shown as an empty «-»).
 */
export function standNames(c: Pick<CompetitionDetail, 'lake' | 'sectors'>): Map<string, string> {
  const names = new Map<string, string>();
  for (const s of c.sectors) for (const st of s.stands) names.set(st.documentId, st.name);
  for (const st of c.lake?.stands ?? []) names.set(st.documentId, st.name);
  return names;
}

/**
 * c8: { allocations: { sectorId: [standIds] } } — every sector present (an emptied sector sends []),
 * the empty slots skipped, the slot order kept (fish onSubmit).
 */
export function allocationsBody(c: Pick<CompetitionDetail, 'sectors'>, slots: Slots): AllocateStandsToSectorsRequest {
  return {
    allocations: Object.fromEntries(
      c.sectors.map((s) => [s.documentId, (slots[s.documentId] ?? []).filter((v): v is string => v !== null)]),
    ),
  };
}

/** The sector's colour as the ranking hands it out (fish getColorsBySector, by index of the sorted names). */
export function sectorPalette(c: Pick<CompetitionDetail, 'sectors'>): Map<string, { color: string; letter: string | null }> {
  const colors = sectorColorMap(c.sectors.map((s) => s.name));
  return new Map(
    c.sectors.map((s) => {
      const color = colors[s.name] ?? 'var(--color-muted)';
      return [s.documentId, { color, letter: paletteLetter(color) }];
    }),
  );
}

export const SAVED_MESSAGE = 'Standurile au fost alocate cu succes!';
const FALLBACK_ERROR = 'Nu am putut salva alocarea. Încearcă din nou.';

/** c8: an error toasts the server's message (fish showErrorToast(error.message)). */
export function saveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message || FALLBACK_ERROR;
}
