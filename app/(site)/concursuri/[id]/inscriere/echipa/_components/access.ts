import { getDisplayedDate, registrationAction, type CompetitionWithMyStatus } from '@/core/competitions';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * What the disclaimer does for this viewer and this competition (parity participant.team-disclaimer
 * c6), decided once the competition and the viewer's own registration are known:
 *  - closed: the viewer cannot register (fish NormalUserSheetItems disables «Înscrie-te» and says
 *    why — core registrationAction `disabled` / `reason`: rejected, the deadline passed, the limit
 *    reached, started; plus a draft / completed / cancelled competition, which fish never offers):
 *    the reason and the way back, never the copy and an active «Am înțeles» to the form;
 *  - sendOn: an open action that is not a NEW team entry (a single competition, a pending /
 *    approved entry being edited): replaced by the registration form;
 *  - show: the disclaimer.
 */
export type DisclaimerAccess =
  | { kind: 'closed'; title: string; reason: string }
  | { kind: 'sendOn' }
  | { kind: 'show' };

type Input = Parameters<typeof registrationAction>[0];

/** The competition itself no longer (or not yet) takes entries — fish hides the action there. */
const STATUS_REASON: Record<string, string> = {
  draft: 'Înscrierile nu sunt deschise încă.',
  completed: 'Concursul s-a încheiat.',
  cancelled: 'Concursul a fost anulat.',
};

export function disclaimerAccess(c: Input, viewerId: string, now: Date): DisclaimerAccess {
  const action = registrationAction(c, viewerId, now);
  const editing = action.label === 'Modifică înscrierea';
  const title = editing ? 'Înscrierea nu mai poate fi modificată' : 'Înscrierea nu este disponibilă';
  const statusReason = STATUS_REASON[c.competitionStatus];
  if (statusReason) return { kind: 'closed', title, reason: statusReason };
  if (action.disabled) return { kind: 'closed', title, reason: action.reason ?? 'Termenul pentru înscriere a expirat' };
  return action.target === 'teamDisclaimer' ? { kind: 'show' } : { kind: 'sendOn' };
}

export type Fact = { label: string; value: string };

/** The competition's facts for the summary card — only the parts that are known (owner rule 4). */
export function competitionFacts(
  c: Pick<CompetitionWithMyStatus, 'lake' | 'startDate' | 'endDate' | 'teamParticipants'>,
  now: Date = new Date(),
): Fact[] {
  const facts: Fact[] = [];
  if (c.lake?.name) facts.push({ label: 'Baltă', value: c.lake.name });
  const dates = Number.isNaN(new Date(c.startDate).getTime()) ? null : getDisplayedDate(c.startDate, c.endDate, now);
  if (dates) facts.push({ label: 'Perioada', value: dates });
  if (c.teamParticipants && c.teamParticipants > 1) {
    facts.push({ label: 'Echipa', value: `până la ${formatCount(c.teamParticipants, 'pescar', 'pescari')}` });
  }
  return facts;
}
