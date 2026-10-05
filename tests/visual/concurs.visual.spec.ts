import { captureRoute } from './capture';

/*
 * Concurs · Clasament. The completed local competition only: a live one changes between runs
 * (weighings, «Live» timers), so it belongs in e2e, not in a pixel baseline.
 * Override with VISUAL_COMPETITION_ID.
 */
const ID = process.env.VISUAL_COMPETITION_ID ?? 'uxxie29m6820wrpdv45w0m7q';

captureRoute({
  name: 'concurs-clasament',
  path: `/concursuri/${ID}`,
  states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }],
});
