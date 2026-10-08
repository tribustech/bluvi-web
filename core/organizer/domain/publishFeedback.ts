/*
 * The wizard's long-operation feedback — fish helpers/createCompetitionPublishFeedback.ts (publish
 * stages, the rotating jokes, the 60 s budget) and helpers/createCompetitionTimeoutRecovery.ts (what
 * the progress dialog becomes when a save / publish / delete gets no answer in time). Pure.
 *
 * fish's recovery carries an expo-router path; core cannot know the web's URLs, so the destination
 * is a tagged target the screen turns into a route (organizer panel, or the competition page).
 */

/** fish `OPERATION_TIMEOUT_MS`: a save, publish or delete with no answer after 60 s turns into the recovery notice. */
export const OPERATION_TIMEOUT_MS = 60_000;

/** fish `getCreateCompetitionPublishJoke` rotation period (CreateCompetitionContext startJokeRotation). */
export const PUBLISH_JOKE_INTERVAL_MS = 3_500;

/** fish `OPERATION_COMPLETION_DELAY_MS`: the bar rests at 100 % this long before the flow leaves. */
export const OPERATION_COMPLETION_DELAY_MS = 900;

export type CreateCompetitionPublishStage = 'draft' | 'banner' | 'publish';

const CREATE_COMPETITION_PUBLISH_STATUS: Record<CreateCompetitionPublishStage, string> = {
  draft: 'Pregătim competiția...',
  banner: 'Încărcăm banner-ul competiției...',
  publish: 'Publicăm competiția...',
};

export const CREATE_COMPETITION_PUBLISH_JOKES: readonly string[] = [
  'Aruncăm nada potrivită...',
  'Mai așteptăm puțin, pare că trage ceva mare.',
  'Verificăm dacă banner-ul a prins bine în cârlig.',
  'Ținem firul întins până confirmă serverul.',
];

export function getCreateCompetitionPublishStatus(stage: CreateCompetitionPublishStage): string {
  return CREATE_COMPETITION_PUBLISH_STATUS[stage];
}

/** The joke for rotation step `index` (wraps; negative indexes wrap too). */
export function getCreateCompetitionPublishJoke(index: number): string {
  const n = CREATE_COMPETITION_PUBLISH_JOKES.length;
  if (n === 0) return '';
  return CREATE_COMPETITION_PUBLISH_JOKES[((index % n) + n) % n];
}

/* ------------------------------------------------------------------ */
/* Progress dialog copy — fish create-competition/_layout.tsx          */
/* ------------------------------------------------------------------ */

export type OperationMode = 'save' | 'publish' | 'delete';

/** The status line each operation starts with (fish setOperationFeedback statusText). */
export function getOperationStatusText(mode: OperationMode): string {
  if (mode === 'publish') return getCreateCompetitionPublishStatus('draft');
  if (mode === 'delete') return 'Ștergere în curs...';
  return 'Salvare în curs...';
}

/**
 * The caption under the bar (fish _layout.tsx:637-643): delete and save have a fixed line, publish
 * shows the current joke.
 */
export function getOperationCaption(mode: OperationMode, jokeText: string): string {
  if (mode === 'delete') return 'Te rugăm să aștepți până finalizăm ștergerea ciornei.';
  if (mode === 'publish') return jokeText;
  return 'Te rugăm să aștepți până finalizăm actualizarea competiției.';
}

/* ------------------------------------------------------------------ */
/* Timeout recovery — fish helpers/createCompetitionTimeoutRecovery.ts */
/* ------------------------------------------------------------------ */

export type TimeoutRecoveryContext = {
  mode: OperationMode;
  draftId: string | null;
  competitionId: string | null;
};

/** Where «Verifică …» leads: the organizer panel, or the edited competition's page. */
export type TimeoutRecoveryDestination = { kind: 'organizer' } | { kind: 'competition'; competitionId: string };

export type TimeoutRecovery = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryDestination: TimeoutRecoveryDestination;
};

export function buildTimeoutRecovery(ctx: TimeoutRecoveryContext): TimeoutRecovery {
  if (ctx.mode === 'publish') {
    return {
      title: 'Publicarea durează mai mult decât estimăm',
      description: 'Nu putem decide dacă s-a finalizat crearea competiției. Verifică în lista de competiții în câteva secunde.',
      primaryLabel: 'Verifică lista',
      primaryDestination: { kind: 'organizer' },
    };
  }

  if (ctx.mode === 'delete') {
    return {
      title: 'Nu putem confirma ștergerea',
      description: 'Conexiunea a durat prea mult. Ciorna poate să fi fost ștearsă sau nu. Verifică în lista de competiții.',
      primaryLabel: 'Verifică lista',
      primaryDestination: { kind: 'organizer' },
    };
  }

  if (ctx.competitionId) {
    return {
      title: 'Nu putem confirma salvarea',
      description:
        'Conexiunea a durat prea mult. Modificările pot fi salvate sau nu. Verifică competiția pentru a vedea starea curentă.',
      primaryLabel: 'Verifică competiția',
      primaryDestination: { kind: 'competition', competitionId: ctx.competitionId },
    };
  }

  return {
    title: 'Nu putem confirma salvarea',
    description: 'Conexiunea a durat prea mult. Verifică în lista de competiții dacă ciorna a fost salvată.',
    primaryLabel: 'Verifică lista',
    primaryDestination: { kind: 'organizer' },
  };
}

/* ------------------------------------------------------------------ */
/* Edit refusals — fish CreateCompetitionContext.tsx persistCompetitionEdit */
/* ------------------------------------------------------------------ */

/** The edit needs an explicit «Salvează oricum» (resubmitted with confirmRiskChanges). */
export const EDIT_RISK_CONFIRMATION_CODE = 'ORGANIZER:EDIT_RISK_CONFIRMATION_REQUIRED';

/** CMS codes that refuse an edit until the organizer changes the data: «Modificări necesare». */
export const EDIT_BLOCKING_VALIDATION_CODES: ReadonlySet<string> = new Set([
  'ORGANIZER:PARTICIPANTS_LIMIT_EXCEEDS_LAKE_STANDS',
  'ORGANIZER:SECTORS_REQUIRED_FOR_UPDATE',
  'ORGANIZER:INVALID_SECTOR_PAYLOAD',
  'ORGANIZER:DUPLICATE_SECTOR_NAMES',
  'ORGANIZER:STAND_ALLOCATIONS_INVALID_FORMAT',
  'ORGANIZER:STAND_ALLOCATIONS_INVALID_SECTOR',
  'ORGANIZER:STAND_ALLOCATIONS_INVALID_STAND',
  'ORGANIZER:DUPLICATE_STAND_ALLOCATION',
  'ORGANIZER:INVALID_PARTICIPANTS_LIMIT',
]);

/** «Modificări necesare» body when the CMS sent no message (fish _layout.tsx:562). */
export const EDIT_BLOCKING_FALLBACK_MESSAGE = 'Datele introduse nu sunt valide pentru salvare.';

/** fish Context: a save refused while offline (save, publish, delete). */
export const OFFLINE_ACTION_MESSAGE = 'Nu ai conexiune la internet. Conectează-te și încearcă din nou.';

/** fish Context `handlePublish` catch fallback. */
export const PUBLISH_FAILED_FALLBACK_MESSAGE = 'A apărut o eroare la publicarea competiției.';

/** fish Context `deleteDraftAndExit` catch fallback. */
export const DELETE_FAILED_FALLBACK_MESSAGE = 'A apărut o eroare la ștergerea ciornei.';

/** fish Context `persistCompetitionEdit` catch fallback. */
export const SAVE_FAILED_FALLBACK_MESSAGE = 'A apărut o eroare la salvare.';

/** fish Context `persistCompetitionEdit` success toasts. */
export function getEditSavedMessage(allocationsReset: boolean | undefined): string {
  return allocationsReset
    ? 'Alocările pe standuri au fost resetate și trebuie refăcute.'
    : 'Modificările au fost salvate cu succes.';
}

/** fish Context `isEditMode ? 'Salvează modificările' : 'Salvează și ieși'`. */
export function getSaveActionLabel(isEditMode: boolean): string {
  return isEditMode ? 'Salvează modificările' : 'Salvează și ieși';
}
