import { useId } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The consent banner's illustration (owner 2026-10-12, «fă-l frumos»), drawn here — no assets, no
 * Lottie. Two variants, the owner picks:
 *  - `fish`  — the Bluvi fish nibbling a chocolate-chip cookie, crumbs falling (the default);
 *  - `cookie` — the cookie alone, a bite out of it, crumbs falling, a soft wobble.
 * Motion is CSS on transform / opacity only: a short entrance, then a calm loop that moves for the
 * first quarter of each cycle and rests for the rest. prefers-reduced-motion: no motion at all, the
 * static drawing (every element's resting state is its un-animated one). Decorative: aria-hidden.
 * Colours are the --color-cookie-* tokens (app/globals.css) and the theme's accent tint.
 */
export type CookieArtVariant = 'fish' | 'cookie';

/** Bite circles on a cookie centred at (48, 50), r 31: the top-right edge (mirrored for the fish). */
const BITE: [number, number, number][] = [
  [73.5, 24.5, 9],
  [81, 35, 7.5],
  [64.5, 16.5, 7],
];

/** Chocolate chips: x, y, scale, rotation. Kept clear of the bite. */
const CHIPS: [number, number, number, number][] = [
  [35, 34, 1.15, 0],
  [52, 37, 0.9, 40],
  [33, 53, 0.85, -25],
  [44, 62, 1.2, -15],
  [60, 56, 1.05, 70],
  [53, 72, 0.8, 20],
  [68, 44, 0.7, -40],
  [27, 64, 0.65, 15],
];

/** Speckles of baked texture. */
const SPECKS: [number, number][] = [
  [42, 28],
  [58, 30],
  [27, 43],
  [47, 47],
  [70, 62],
  [38, 72],
  [62, 70],
  [24, 55],
];

const CHIP = 'M-4 -1C-4-3.6-1.6-4.6.6-4.2 3-3.8 4.4-1.8 3.8.8 3.2 3.4.8 4.4-1.4 3.8-3.4 3.2-4 1.6-4-1Z';
const CRUMB = 'M-1.8-1.2C-1-2.2 1-2.2 1.9-1 2.4.2 1.6 1.9.1 2-1.5 2.1-2.4.4-1.8-1.2Z';

const mx = (x: number, mirror: boolean) => (mirror ? 96 - x : x);

function Cookie({ uid, mirror }: { uid: string; mirror: boolean }) {
  const mask = `${uid}-bite`;
  const clip = `${uid}-shape`;
  return (
    <>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="96">
          <rect width="96" height="96" fill="white" />
          {BITE.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={mx(x, mirror)} cy={y} r={r} fill="black" />
          ))}
        </mask>
        <clipPath id={clip}>
          <circle cx="48" cy="50" r="31" />
        </clipPath>
      </defs>
      <g mask={`url(#${mask})`}>
        {/* Baked rim, then the dough a little above it, so the bottom edge reads as golden-brown. */}
        <circle cx="48" cy="50" r="31" className="fill-cookie-edge" />
        <circle cx="48" cy="48.2" r="29.4" className="fill-cookie" />
        <ellipse cx="38" cy="36" rx="15" ry="8.5" transform="rotate(-32 38 36)" className="fill-cookie-light" opacity="0.75" />
        {SPECKS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={mx(x, mirror)} cy={y} r="0.9" className="fill-cookie-edge" opacity="0.55" />
        ))}
        {CHIPS.map(([x, y, s, r]) => (
          <path
            key={`${x}-${y}`}
            d={CHIP}
            transform={`translate(${mx(x, mirror)} ${y}) rotate(${mirror ? -r : r}) scale(${s})`}
            className="fill-cookie-chip"
          />
        ))}
        {/* The bite's broken edge: the bite circles' stroke, inside the cookie only. */}
        <g clipPath={`url(#${clip})`}>
          {BITE.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={mx(x, mirror)} cy={y} r={r + 0.2} fill="none" strokeWidth="3.4" className="stroke-cookie-edge" />
          ))}
        </g>
      </g>
    </>
  );
}

function Crumbs({ at }: { at: [number, number, number][] }) {
  return (
    <>
      {at.map(([x, y, s], i) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d={CRUMB} className={cn('bca-crumb fill-cookie-crumb', `bca-crumb-${i + 1}`)} />
        </g>
      ))}
    </>
  );
}

function Fish() {
  return (
    <g className="bca-fish">
      <path
        className="bca-tail fill-cookie-fish-fin"
        d="M14.5 36C10 31 6.4 28.4 2.6 27.9 3.9 31.4 4.5 33.8 4.5 36 4.5 38.2 3.9 40.6 2.6 44.1 6.4 43.6 10 41 14.5 36Z"
      />
      <path className="fill-cookie-fish-fin" d="M19.5 25C21.4 18 28.4 15 34 18.2 30.6 19.6 28.6 22 28 24.4Z" />
      <path className="fill-cookie-fish" d="M41 36.4C41 27.6 33.6 22 25.6 22 17.8 22 12.4 28.4 12.4 36 12.4 43.6 17.8 50 25.6 50 33.6 50 41 45 41 36.4Z" />
      <ellipse cx="22.5" cy="28.6" rx="6" ry="2.6" transform="rotate(-24 22.5 28.6)" className="fill-cookie-fish-belly" opacity="0.4" />
      <path className="fill-cookie-fish-belly" d="M14.6 40.4C17.6 46.4 22.8 49.6 28.4 49.4 34 49.2 38.6 46 40.2 41.6 32.4 44.4 22.6 44.2 14.6 40.4Z" />
      <path d="M29.6 26.8C26.6 30.6 26.6 39.6 29.8 43.4" fill="none" strokeWidth="1.6" strokeLinecap="round" className="stroke-cookie-fish-fin" opacity="0.55" />
      <path className="bca-fin fill-cookie-fish-fin" d="M23.6 38.4C20.6 40.8 19.6 44.6 20.8 46.6 23.8 45.6 26.2 43 26.8 39.8Z" />
      <circle cx="34" cy="31.4" r="4.6" className="fill-cookie-fish-eye" />
      <circle cx="35.1" cy="32" r="2.5" className="fill-cookie-fish-pupil" />
      <circle cx="36" cy="30.9" r="0.85" className="fill-cookie-fish-eye" />
      <ellipse cx="33.4" cy="39" rx="2.6" ry="1.6" className="fill-cookie-fish-cheek" opacity="0.8" />
      <ellipse cx="40.6" cy="38.4" rx="1.3" ry="1.7" className="bca-mouth fill-cookie-fish-pupil" />
    </g>
  );
}

const STYLE = `
.bca-cookie,.bca-fish,.bca-tail,.bca-fin,.bca-crumb,.bca-bubble{transform-box:fill-box}
.bca-cookie{transform-origin:center;animation:bca-pop .7s cubic-bezier(.34,1.56,.64,1) both}
.bca[data-variant="cookie"] .bca-cookie{animation:bca-pop .7s cubic-bezier(.34,1.56,.64,1) both,bca-wobble 4.8s ease-in-out .9s infinite}
.bca-fish{transform-origin:center;animation:bca-swim .8s cubic-bezier(.22,1,.36,1) both,bca-nibble 3.6s ease-in-out 1s infinite}
.bca-tail{transform-origin:right center;animation:bca-wag 1.2s ease-in-out infinite}
.bca-fin{transform-origin:top right;animation:bca-flap 1.2s ease-in-out .2s infinite}
.bca-mouth{transform-origin:center;animation:bca-chomp 3.6s ease-in-out 1s infinite}
.bca-crumb{transform-origin:center;opacity:1}
.bca[data-variant="fish"] .bca-crumb{animation:bca-fall 3.6s ease-in 1s infinite backwards}
.bca[data-variant="cookie"] .bca-crumb{animation:bca-fall 4.8s ease-in .9s infinite backwards}
.bca[data-variant="fish"] .bca-crumb-2{animation-delay:1.25s}
.bca[data-variant="fish"] .bca-crumb-3{animation-delay:1.5s}
.bca[data-variant="cookie"] .bca-crumb-2{animation-delay:1.15s}
.bca[data-variant="cookie"] .bca-crumb-3{animation-delay:1.4s}
.bca-bubble{transform-origin:center;animation:bca-rise 3.6s ease-out 1s infinite backwards}
.bca-bubble-2{animation-delay:1.5s}
@keyframes bca-pop{0%{opacity:0;transform:scale(.6) rotate(-14deg)}60%{opacity:1}100%{opacity:1;transform:none}}
@keyframes bca-wobble{0%,24%,100%{transform:none}6%{transform:rotate(-5deg)}12%{transform:rotate(4deg)}18%{transform:rotate(-2deg)}}
@keyframes bca-swim{0%{opacity:0;transform:translate(-14px,4px) rotate(-8deg)}100%{opacity:1;transform:none}}
@keyframes bca-nibble{0%,30%,100%{transform:none}8%,22%{transform:translate(2.6px,1px) rotate(3deg)}15%{transform:translate(.4px,0)}}
@keyframes bca-chomp{0%,30%,100%{transform:none}8%,22%{transform:scale(.55)}15%{transform:scale(1.15)}}
@keyframes bca-wag{0%,100%{transform:rotate(0)}50%{transform:rotate(-12deg)}}
@keyframes bca-flap{0%,100%{transform:rotate(0)}50%{transform:rotate(14deg)}}
@keyframes bca-fall{0%{opacity:0;transform:translateY(-4px)}6%{opacity:1}30%{opacity:1;transform:translateY(10px)}36%,100%{opacity:0;transform:translateY(12px)}}
@keyframes bca-rise{0%{opacity:0;transform:translateY(6px)}10%{opacity:.9}40%,100%{opacity:0;transform:translateY(-10px)}}
@media (prefers-reduced-motion:reduce){.bca *{animation:none!important}}
`;

export function CookieArt({ variant, className }: { variant: CookieArtVariant; className?: string }) {
  const uid = `bca${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fish = variant === 'fish';
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" data-variant={variant} className={cn('bca', className)}>
      <style>{STYLE}</style>
      <circle cx="48" cy="48" r="46" className="fill-accent-tint" />
      {fish ? (
        <>
          <g transform="translate(63 59) scale(0.76) translate(-48 -50)">
            <g className="bca-cookie">
              <Cookie uid={uid} mirror />
            </g>
          </g>
          <Crumbs
            at={[
              [38.5, 57, 1],
              [35, 62.5, 0.8],
              [40, 66, 0.7],
            ]}
          />
          <g transform="translate(3.5 4) rotate(10 26 36)">
            <Fish />
          </g>
          <circle cx="48" cy="22" r="2.1" fill="none" strokeWidth="1.2" className="bca-bubble stroke-accent" opacity="0.7" />
          <circle cx="53" cy="15" r="1.4" fill="none" strokeWidth="1.1" className="bca-bubble bca-bubble-2 stroke-accent" opacity="0.6" />
        </>
      ) : (
        <>
          <g className="bca-cookie">
            <Cookie uid={uid} mirror={false} />
          </g>
          <Crumbs
            at={[
              [80, 47, 1.1],
              [86, 53, 0.85],
              [76.5, 54, 0.75],
            ]}
          />
        </>
      )}
    </svg>
  );
}
