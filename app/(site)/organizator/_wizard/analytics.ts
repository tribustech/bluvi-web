import { track } from '@/lib/analytics';
import { captureException, captureMessage } from '@/lib/observability/report';
import type { WizardStepDef } from './stepDefs';

/*
 * organizer.b.wizard-analytics — fish helpers/createCompetitionAnalytics.ts, same event names and
 * params, through the site's one channel (lib/analytics `track`). fish's Sentry calls
 * (captureCreateCompetitionError / captureOperationTimeout, tag feature_area=create_competition)
 * go to Sentry with the same tags (lib/observability/report: a no-op while it is off) and stay in
 * the console.
 */

export type WizardAnalyticsStep = WizardStepDef['analytics'] | 'unknown';
export type PublishFailReason = 'api_error' | 'timeout' | 'validation';

/** fish Sentry tag set while the wizard is mounted (_layout.tsx:752). */
export const WIZARD_FEATURE_AREA = 'create_competition';

export function logCreateCompetitionStarted(params: { is_editing_draft: boolean }) {
  track('create_competition_started', params);
}

/** fish CannotEditCompetitionSheet «Apelează»: contact_pressed «Bluvi cannot edit contact». */
export function logCannotEditContact() {
  track('contact_pressed', { contact_type: 'Bluvi cannot edit contact' });
}

export function logCreateCompetitionDraftSaved(params: { is_first_save: boolean; step: WizardAnalyticsStep }) {
  track('create_competition_draft_saved', params);
}

export function logCreateCompetitionPublishAttempted(params: { draft_id: string | null }) {
  track('create_competition_publish_attempted', { draft_id: params.draft_id ?? 'none' });
}

export function logCreateCompetitionPublishSucceeded(params: { competition_id: string; ranking_type: string }) {
  track('create_competition_publish_succeeded', params);
}

export function logCreateCompetitionPublishFailed(params: { reason: PublishFailReason; draft_id: string | null }) {
  track('create_competition_publish_failed', { reason: params.reason, draft_id: params.draft_id ?? 'none' });
}

type ErrorContext = { step: WizardAnalyticsStep; draft_id: string | null; ranking_type?: string };

/** fish captureCreateCompetitionError (Sentry exception, tags feature / action). */
export function captureCreateCompetitionError(error: unknown, context: { action: 'save_draft' | 'publish_draft' | 'delete_draft' } & ErrorContext) {
  const tags = { feature: 'create_competition', feature_area: WIZARD_FEATURE_AREA, action: context.action };
  console.warn('[create_competition]', { tags, extra: context }, error);
  captureException(error, { tags, extra: context });
}

/** fish captureOperationTimeout (Sentry warning message). */
export function captureOperationTimeout(mode: 'save' | 'publish' | 'delete', context: ErrorContext) {
  const message = `Create competition ${mode} timed out`;
  const tags = { feature: 'create_competition', feature_area: WIZARD_FEATURE_AREA, action: `${mode}_timeout` };
  console.warn(`[create_competition] ${message}`, { tags, extra: context });
  captureMessage(message, { level: 'warning', tags, extra: context });
}
