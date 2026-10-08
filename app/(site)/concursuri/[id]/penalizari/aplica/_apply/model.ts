import type { CompetitionWithMyStatus, PenaltyAction, Registration } from '@/core/competitions';
import { findSectorForStand, penaltyFormSchema, type PenaltyFormValues } from '@/core/organizer';
import { isApiError } from '@/core/transport';
import { canPickPenaltyStand } from '../../stand/_select/target';

/*
 * The pure part of «Aplică penalizare» (parity organizer.penalties-apply; fish
 * app/(app)/penalties/[competitionId]/apply.tsx). The screen renders what these decide.
 */

export type ActionTone = 'warning' | 'danger';

/** fish apply.tsx:28-52 ACTION_OPTIONS — labels, descriptions and the card colour (yellow / red). */
export const ACTION_OPTIONS: { value: PenaltyAction; label: string; description: string; tone: ActionTone }[] = [
  { value: 'WARNING', label: 'Avertisment', description: 'Doar pentru istoric. Nu modifică clasamentul.', tone: 'warning' },
  {
    value: 'DEDUCT_TOTAL_WEIGHT',
    label: 'Penalizare greutate',
    description: 'Scade o cantitate (kg) din greutatea totală a echipei. Capturile rămân intacte.',
    tone: 'warning',
  },
  { value: 'ELIMINATE', label: 'Eliminare', description: 'Echipa este forțată pe ultimul loc în clasament.', tone: 'danger' },
];

export const actionOption = (action: PenaltyAction) => ACTION_OPTIONS.find((o) => o.value === action) ?? ACTION_OPTIONS[0];

export const EMPTY_FORM: PenaltyFormValues = { action: 'WARNING', value: '', reason: '' };

export const ALREADY_ELIMINATED = 'PENALTY:ALREADY_ELIMINATED';
export const ALREADY_ELIMINATED_MESSAGE =
  'Această echipă este deja eliminată. Revocă eliminarea pentru a aplica o nouă penalizare.';
export const APPLY_FAILED_MESSAGE = 'Penalizarea nu a putut fi aplicată. Te rugăm să reîncerci.';
export const APPLIED_MESSAGE = 'Penalizarea a fost aplicată';

/**
 * Where the page goes once its reads are in (fish apply.tsx:126-151):
 * - a ranking type without penalties, or a competition that is not running → the hub (fish dismissTo
 *   the hub; the CMS refuses a penalty outside `started`, PENALTY:INVALID_COMPETITION_STATUS, and the
 *   stand picker gates the same way — canPickPenaltyStand);
 * - no `inscriere` in the URL, a registration the competition does not have, or one not on an allocated
 *   stand of a sector → back, i.e. the stand picker the form is opened from (fish router.back(); fish
 *   never shows the form for a registration without a sector stand);
 * - otherwise the form. `loading` while either read is still out.
 */
export function resolveApplyTarget({
  competition,
  registrations,
  registrationId,
}: {
  competition: Pick<CompetitionWithMyStatus, 'rankingType' | 'competitionStatus' | 'sectors'> | undefined;
  registrations: Registration[] | undefined;
  registrationId: string | null | undefined;
}): 'loading' | 'ready' | 'back' | 'hub' {
  if (competition && !canPickPenaltyStand(competition)) return 'hub';
  if (!registrationId) return 'back';
  if (!competition || !registrations) return 'loading';
  const registration = registrations.find((r) => r.documentId === registrationId);
  const standId = registration?.stand?.documentId;
  if (!standId || !findSectorForStand(competition.sectors ?? [], standId)) return 'back';
  return 'ready';
}

export type Subject = { title: string; line: string; people: string[] };

/**
 * c1 (fish apply.tsx:229-257): «Sector X, Stand N»; «Echipa <nume>» on a team competition, else the
 * guest or the (first) participant; a team's members as bullets. Only called on a registration
 * resolveApplyTarget let through, i.e. one on a stand of a sector.
 */
export function subjectOf(
  competition: Pick<CompetitionWithMyStatus, 'competitionType' | 'sectors'>,
  registration: Registration,
): Subject {
  const isTeam = competition.competitionType === 'team';
  const stand = registration.stand;
  const sector = stand ? findSectorForStand(competition.sectors ?? [], stand.documentId) : undefined;
  const title = sector && stand ? `Sector ${sector.name}, Stand ${stand.name}` : '';
  const line =
    isTeam && registration.teamName
      ? `Echipa ${registration.teamName}`
      : (registration.guestName ?? registration.participants?.[0]?.username ?? '—');
  const people = isTeam ? (registration.participants ?? []).map((p) => p.username ?? '').filter(Boolean) : [];
  return { title, line, people };
}

export type FormErrors = Partial<Record<'value' | 'reason', string>>;

/** The schema's messages per field (fish zodResolver): value only matters for a weight penalty. */
export function validatePenalty(values: PenaltyFormValues): FormErrors {
  const parsed = penaltyFormSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: FormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if ((key === 'value' || key === 'reason') && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** A change was made: a different action, a weight or a reason typed (the leave guard). */
export const isDirty = (v: PenaltyFormValues) => v.action !== 'WARNING' || (v.value ?? '').trim() !== '' || v.reason.trim() !== '';

/** «1,5» for a valid positive weight (comma or dot typed), else null — the summary's number. */
export function penaltyKg(value: string | undefined): string | null {
  const n = parseFloat((value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 3, useGrouping: false }).format(n);
}

/**
 * c7 (fish apply.tsx:196-204): PENALTY:ALREADY_ELIMINATED sits under «Tip penalizare»; any other
 * failure is a toast. A CMS error that carries a bluCode brings its own Romanian message (fish shows
 * error.message); everything else — which the transport only knows as «eroare necunoscută» — gets
 * the screen's own «Penalizarea nu a putut fi aplicată…» (fish's fallback copy).
 */
export function applyErrorOutcome(error: unknown): { inline: string } | { toast: string } {
  if (isApiError(error) && error.bluCode === ALREADY_ELIMINATED) return { inline: ALREADY_ELIMINATED_MESSAGE };
  if (isApiError(error) && error.bluCode && error.message) return { toast: error.message };
  return { toast: APPLY_FAILED_MESSAGE };
}
