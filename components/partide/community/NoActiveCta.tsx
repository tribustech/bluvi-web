import { PartidaCta, PartidaCtaSkeleton } from '@/app/(site)/_home/PartidaCta';

/**
 * fish features/partide/components/community/NoActiveCta.tsx — «Ești la pescuit?» (parity
 * partide.comunitate.c4): Acasă's hero (_home/PartidaCta: the indigo card, the waves). fish's
 * «Începe o partidă» / «Intră cu cod» are app-only on web (owner 2026-10-08, ROADMAP §4b rule 21):
 * the hero hands over to the app («Deschide în aplicația Bluvi», the store links from 1280).
 */
export function NoActiveCta({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  return <PartidaCta layout={layout} className={className} />;
}

/** The hero's skeleton while the viewer is read. */
export function NoActiveCtaSkeleton({ layout }: { layout: 'mobile' | 'desktop' }) {
  return <PartidaCtaSkeleton layout={layout} />;
}
