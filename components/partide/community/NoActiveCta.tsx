import { PartidaCta, PartidaCtaSkeleton } from '@/app/(site)/_home/PartidaCta';

/**
 * fish features/partide/components/community/NoActiveCta.tsx — «Ești la pescuit?» (parity
 * partide.comunitate.c4): Acasă's hero (_home/PartidaCta: the indigo card, the waves, «Începe o
 * partidă» and «Intră cu cod»), with the Partide hub's targets — each null (left out) while its page
 * is not on the web (lib/partide-pages), a guest's going through sign-in. fish's hero always has
 * both actions: with neither page on the web the card would be a glowing card with nothing to do,
 * so it is not rendered at all (owner rule 4).
 */
export function NoActiveCta({ start, join, layout, className }: { start: string | null; join: string | null; layout: 'mobile' | 'desktop'; className?: string }) {
  if (!start && !join) return null;
  return <PartidaCta signedIn layout={layout} className={className} links={{ start, join }} />;
}

/** The hero's skeleton, with the action row only when the loaded hero will have one. */
export function NoActiveCtaSkeleton({ layout, hasActions }: { layout: 'mobile' | 'desktop'; hasActions: boolean }) {
  return <PartidaCtaSkeleton layout={layout} actions={hasActions} />;
}
