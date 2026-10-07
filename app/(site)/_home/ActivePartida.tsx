import {
  ActivePartidaCard as SharedCard,
  ActivePartidaDock as SharedDock,
  type ActivePartidaCardProps,
  type ActivePartidaProps,
} from '@/components/partide/ActivePartidaDock';
import { partideHrefs } from '@/lib/partide-pages';

/*
 * The live-partidă dock and the desktop card, promoted to components/partide (shared with the
 * Partide hub, parity partide.b.active-dock-global). Acasă's copies add the capture target: fish's
 * «Captură» opens the free-capture flow (home.acasa.c22, app/(app)/(tabs)/index.tsx:130-137), here
 * /partide/[id]/captura through lib/partide-pages `capture` — the partidă page while that flow is
 * not on the web (the shared dock's own fallback), never a dead link.
 */

export function ActivePartidaDock(props: ActivePartidaProps) {
  return <SharedDock captureHref={partideHrefs.capture(props.session.documentId)} {...props} />;
}

export function ActivePartidaCard(props: ActivePartidaCardProps) {
  return <SharedCard captureHref={partideHrefs.capture(props.session.documentId)} {...props} />;
}
