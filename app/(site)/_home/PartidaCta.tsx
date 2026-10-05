import Link from 'next/link';
import { FishingRodIcon } from '@/components/icons/brand';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { homeLinks } from './links';

/**
 * The coloured banners of Acasă (this, LakeRequestBanner, the raffle) share one spec: the hero step
 * of the radius scale (rounded-bento, Fundații: 20 for bento and hero — the rail cards around them
 * are 16), p-4 / 4.5 from 1280, a t-heading heading (the T5 card-section step: card-contained h2s
 * are t-heading, plain section titles t-title2 — the ground, indigo or photo, carries the emphasis),
 * t-body copy capped at a short reading measure (20rem, ~36 characters), and one action row pinned
 * to the bottom (`mt-auto`) — so beside the taller photo banner the extra height falls between the
 * copy and the actions, where the waves fill it. From 768 to 1280 the banner spans the whole
 * stacked column, so it lays out as one row (BANNER_ROW): copy left, actions right, centred. The
 * action is the kit Button on a coloured ground (outline: surface fill, accent-ink label), with the
 * white focus ring dark grounds need (the accent outline is 1.8:1 on accent-ink).
 */
export const BANNER = 'relative isolate flex flex-col gap-3 overflow-hidden rounded-bento p-4 xl:p-4.5';
/** md..xl: one row — the copy block (BANNER_TEXT) left, the actions (BANNER_ACTIONS) right. */
export const BANNER_ROW = 'md:max-xl:flex-row md:max-xl:items-center md:max-xl:justify-between md:max-xl:gap-6';
export const BANNER_TEXT = 'flex flex-col gap-3 md:max-xl:max-w-90';
export const BANNER_ACTIONS = 'mt-auto pt-1 md:max-xl:mt-0 md:max-xl:shrink-0 md:max-xl:pt-0';
export const BANNER_COPY = 'max-w-xs t-body';
export const ON_DARK_FOCUS = 'focus-visible:outline-on-accent';

/**
 * fish features/partide/components/community/NoActiveCta.tsx — «Ești la pescuit?» hero: indigo
 * ground, wave strokes bottom-right, «Începe o partidă» and a quiet text link «Intră cu cod».
 * Signed out, both routes go to sign-in (fish). The page's one glowing card (Fundații §04).
 */
export function PartidaCta({ signedIn, layout, className }: { signedIn: boolean; layout: 'mobile' | 'desktop'; className?: string }) {
  return (
    <section aria-labelledby={`acasa-partida-cta-${layout}`} className={cn(BANNER, BANNER_ROW, 'bg-accent-ink text-on-accent shadow-glow', className)}>
      <Waves />
      <Copy layout={layout} />
      <div className={cn(BANNER_ACTIONS, 'flex flex-wrap items-center gap-x-4 gap-y-2')}>
        <ButtonLink
          href={signedIn ? homeLinks.partidaStart : homeLinks.signIn}
          variant="outline"
          icon={<FishingRodIcon size={20} />}
          className={ON_DARK_FOCUS}
        >
          Începe o partidă
        </ButtonLink>
        <Link
          href={signedIn ? homeLinks.partidaJoin : homeLinks.signIn}
          className={cn('inline-flex min-h-11 items-center rounded-control t-body-strong underline underline-offset-2', ON_DARK_FOCUS)}
        >
          Intră cu cod
        </Link>
      </div>
    </section>
  );
}

/**
 * The hero's box while the session is read: same spec, no live links (a guest link clicked by a
 * signed-in viewer would send them to sign-in).
 */
export function PartidaCtaSkeleton({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  return (
    <section aria-labelledby={`acasa-partida-cta-${layout}`} aria-busy className={cn(BANNER, BANNER_ROW, 'bg-accent-ink text-on-accent shadow-glow', className)}>
      <Waves />
      <Copy layout={layout} />
      <div aria-hidden className={cn(BANNER_ACTIONS, 'flex items-center gap-4')}>
        <span className="h-12 w-48 rounded-control bg-on-accent/20 xl:h-10" />
        <span className="h-5 w-24 rounded-full bg-on-accent/20" />
      </div>
    </section>
  );
}

function Copy({ layout }: { layout: 'mobile' | 'desktop' }) {
  return (
    <div className={BANNER_TEXT}>
      <h2 id={`acasa-partida-cta-${layout}`} className="t-heading">
        Ești la pescuit?
      </h2>
      <p className={BANNER_COPY}>Capturi, lansete și cronometre — totul notat într-o singură partidă.</p>
    </div>
  );
}

/**
 * The wave strokes, top-right at every width: on a phone beside the title, where the full-width
 * action row never passes; from 768 (one row) above the right-aligned actions, which cover them
 * with their own fill; from 1280 (half the main column) clear of the copy's measure and of «Intră
 * cu cod».
 */
function Waves() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 160"
      className="pointer-events-none absolute -top-6 -right-8 z-behind h-auto w-36 opacity-20 xl:top-3 xl:-right-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
    >
      <path d="M10 40 q25 -18 50 0 t50 0 t50 0" />
      <path d="M10 80 q25 -18 50 0 t50 0 t50 0" />
      <path d="M10 120 q25 -18 50 0 t50 0 t50 0" />
    </svg>
  );
}
