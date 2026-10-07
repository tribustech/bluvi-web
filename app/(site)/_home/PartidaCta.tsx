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
 * to the bottom (`mt-auto`). The banner always spans Acasă's main column, and lays out by the room
 * that column has (it is a size container, T5 DashboardLayout): from 672px of column (@2xl — the
 * 768 tablet's 704, 1280's 872, 1440's 712 and up) one row (BANNER_ROW): the copy (capped at
 * 30rem) and the actions right after it, 32 apart — never the action pinned to the far edge of a
 * 1016px column with a void between them; narrower (a phone) the copy over the actions. The
 * action is the kit Button on a coloured ground (outline: surface fill, accent-ink label), with the
 * white focus ring dark grounds need (the accent outline is 1.8:1 on accent-ink).
 */
export const BANNER = 'relative isolate flex flex-col gap-3 overflow-hidden rounded-bento p-4 xl:p-4.5';
/** ≥672px of column: one row — the copy block (BANNER_TEXT), then the actions (BANNER_ACTIONS) beside it. */
export const BANNER_ROW = '@2xl:flex-row @2xl:items-center @2xl:justify-start @2xl:gap-8';
export const BANNER_TEXT = 'flex flex-col gap-3 @2xl:max-w-120';
export const BANNER_ACTIONS = 'mt-auto pt-1 @2xl:mt-0 @2xl:shrink-0 @2xl:pt-0';
export const BANNER_COPY = 'max-w-xs t-body @2xl:max-w-120';
export const ON_DARK_FOCUS = 'focus-visible:outline-on-accent';

/**
 * fish features/partide/components/community/NoActiveCta.tsx — «Ești la pescuit?» hero: indigo
 * ground, wave strokes bottom-right, «Începe o partidă» and a quiet text link «Intră cu cod».
 * Signed out, both routes go to sign-in (fish). The page's one glowing card (Fundații §04).
 */
export function PartidaCta({
  signedIn,
  layout,
  className,
  links,
}: {
  signedIn: boolean;
  layout: 'mobile' | 'desktop';
  className?: string;
  /**
   * The two targets, when the caller decides them (the Partide hub, lib/partide-pages: null while
   * that page is not on the web — the action is left out). Acasă's defaults otherwise.
   */
  links?: { start: string | null; join: string | null };
}) {
  const start = links ? links.start : signedIn ? homeLinks.partidaStart : homeLinks.signIn;
  const join = links ? links.join : signedIn ? homeLinks.partidaJoin : homeLinks.signIn;
  return (
    <section aria-labelledby={`acasa-partida-cta-${layout}`} className={cn(BANNER, BANNER_ROW, 'bg-accent-ink text-on-accent shadow-glow', className)}>
      <Waves />
      <Copy layout={layout} />
      {start || join ? (
        <div className={cn(BANNER_ACTIONS, 'flex flex-wrap items-center gap-x-4 gap-y-2')}>
          {start ? (
            <ButtonLink href={start} variant="outline" icon={<FishingRodIcon size={20} />} className={ON_DARK_FOCUS}>
              Începe o partidă
            </ButtonLink>
          ) : null}
          {join ? (
            <Link
              href={join}
              // In the row layout the waves sit behind the right-aligned actions: the link carries the
              // banner's own fill there, so its underlined text never lies on the strokes.
              className={cn(
                'inline-flex min-h-11 items-center rounded-control t-body-strong underline underline-offset-2 @2xl:bg-accent-ink @2xl:px-2',
                ON_DARK_FOCUS,
              )}
            >
              Intră cu cod
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The hero's box while the session is read: same spec, no live links (a guest link clicked by a
 * signed-in viewer would send them to sign-in). `actions` false: the loaded card will have no
 * action row (the caller's `links` are both null), so neither does its skeleton — no shift.
 */
export function PartidaCtaSkeleton({ layout, className, actions = true }: { layout: 'mobile' | 'desktop'; className?: string; actions?: boolean }) {
  return (
    <section aria-labelledby={`acasa-partida-cta-${layout}`} aria-busy className={cn(BANNER, BANNER_ROW, 'bg-accent-ink text-on-accent shadow-glow', className)}>
      <Waves />
      <Copy layout={layout} />
      {/* The loaded action row's own box (flex-wrap, the same gaps, the link's 44px line), so the
          row is as tall as the real one wherever it wraps. */}
      {actions ? (
        <div aria-hidden className={cn(BANNER_ACTIONS, 'flex flex-wrap items-center gap-x-4 gap-y-2')}>
          <span className="h-12 w-48 rounded-control bg-on-accent/20 xl:h-10" />
          <span className="flex min-h-11 items-center @2xl:px-2">
            <span className="h-5 w-24 rounded-full bg-on-accent/20" />
          </span>
        </div>
      ) : null}
    </section>
  );
}

function Copy({ layout }: { layout: 'mobile' | 'desktop' }) {
  return (
    <div className={BANNER_TEXT}>
      <h2 id={`acasa-partida-cta-${layout}`} className="t-heading">
        Ești la pescuit?
      </h2>
      <p className={BANNER_COPY}>
        Capturi, lansete și cronometre — totul notat într-o singură partidă.
      </p>
    </div>
  );
}

/**
 * The wave strokes, top-right at every width: in the stacked layout beside the title, where the
 * full-width action row never passes; in the row layout behind the right-aligned actions, which
 * cover them with their own fill (the button's, and the «Intră cu cod» link's banner-coloured box).
 */
function Waves() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 160"
      className="pointer-events-none absolute -top-6 -right-8 z-behind h-auto w-36 opacity-20"
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
