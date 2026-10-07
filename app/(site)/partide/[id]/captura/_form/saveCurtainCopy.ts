/**
 * Copy shown on the full-page save curtain, one line at a time (fish
 * features/partide/helpers/saveCurtainCopy.ts). Deliberately anglerish rather than technical — the
 * wait is real, so it may as well be enjoyable. Order matters: they read as a sequence of things
 * being done.
 */
export type SaveCurtainFlow = 'rod' | 'catch' | 'catchEdit';

const ROD_MESSAGES = ['Așezăm lanseta pe rodpod…', 'Mai avem de pus swinger-ul…', 'Verificăm că merge avertizorul…'];

const CATCH_EDIT_MESSAGES = ['Actualizăm captura…', 'Punem la loc în jurnal…'];

export function saveCurtainMessages(flow: SaveCurtainFlow, opts: { hasPhoto?: boolean } = {}): string[] {
  if (flow === 'rod') return ROD_MESSAGES;
  if (flow === 'catchEdit') return CATCH_EDIT_MESSAGES;
  // The photo line only earns its place when a photo is actually attached.
  return ['Punem peștele pe cântar…', ...(opts.hasPhoto ? ['Pregătim poza pentru album…'] : []), 'Notăm captura în jurnal…'];
}
