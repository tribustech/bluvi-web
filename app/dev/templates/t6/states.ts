/** The demo's ?state= values (shared by the server page and the client switcher). */
export type DemoState =
  | ''
  | 'signed-out'
  | 'empty'
  | 'loading'
  | 'loading-add'
  | 'slow'
  | 'error'
  | 'nc'
  | 'weighed'
  | 'add'
  | 'invalid'
  | 'confirmed'
  | 'readonly';

export const STATES: { value: DemoState; label: string }[] = [
  { value: '', label: 'Implicit' },
  { value: 'signed-out', label: 'Neautentificat' },
  { value: 'empty', label: 'Gol' },
  { value: 'loading', label: 'Se încarcă' },
  { value: 'loading-add', label: 'Se încarcă standul' },
  { value: 'slow', label: 'CMS lent' },
  { value: 'error', label: 'Eroare' },
  { value: 'nc', label: 'Campionat național' },
  { value: 'weighed', label: 'Cu cântăriri' },
  { value: 'add', label: 'Adaugă captură' },
  { value: 'invalid', label: 'Date greșite' },
  { value: 'confirmed', label: 'Confirmare' },
  { value: 'readonly', label: 'Doar citire' },
];

/** States that open step 2 (a stand). */
export const STEP2_STATES: DemoState[] = ['add', 'invalid', 'confirmed', 'readonly'];

/** States that preview the open scale whatever the viewer's role (signed in only). */
export const PREVIEW_STATES: DemoState[] = ['add', 'invalid', 'confirmed'];

/** Whether a URL opens step 2, so loading shows step 2's skeleton (read on the client too). */
export const isStepTwo = (state: string | null, stand: string | null) =>
  Boolean(stand) || state === 'loading-add' || STEP2_STATES.includes((state ?? '') as DemoState);

/**
 * Step 2's h1 when the viewer cannot weigh there (signed out, no role, not started, finished): the
 * step is titled by what it shows, never by the action it refuses («Adaugă captură»).
 */
export const READ_ONLY_TITLE = 'Cântăririle standului';
