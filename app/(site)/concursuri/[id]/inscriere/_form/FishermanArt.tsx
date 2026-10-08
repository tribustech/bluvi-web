import { cn } from '@/components/ui/cn';

/**
 * The fisherman on the jetty — a static, token-coloured stand-in for fish's looping Lottie
 * (assets/animations/finsherman.json) on the signed-out registration gate (participant.register.c2)
 * and the team disclaimer (participant.team-disclaimer.c1). Every colour is a theme token (fill-* /
 * stroke-* utilities), so it follows light and dark. Decorative: aria-hidden, the heading next to
 * it says what the page is.
 */
export function FishermanArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 200" aria-hidden focusable="false" className={cn('h-auto w-full max-w-80', className)}>
      {/* sky disc and sun */}
      <circle cx="160" cy="112" r="96" className="fill-accent-tint" />
      <circle cx="240" cy="74" r="13" className="fill-medal-gold" opacity="0.85" />
      {/* far shore */}
      <path d="M64 118c22-10 40-14 58-10s34 8 52 2 34-10 56-6 30 10 30 14H64z" className="fill-accent-tint-3" />
      {/* water */}
      <path d="M64 120h196a96 96 0 0 1-196 0z" className="fill-accent-tint-2" />
      <path
        d="M92 142c10-4 18-4 28 0s18 4 28 0M176 152c10-4 18-4 28 0s18 4 28 0M118 168c8-3 14-3 22 0"
        className="stroke-accent"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* jetty */}
      <rect x="40" y="114" width="112" height="9" rx="3" className="fill-navy" />
      <rect x="54" y="122" width="7" height="34" rx="2" className="fill-navy" />
      <rect x="126" y="122" width="7" height="30" rx="2" className="fill-navy" />
      {/* fisherman: stool, legs, body, head, hat */}
      <rect x="92" y="98" width="20" height="16" rx="3" className="fill-indigo-5" />
      <path d="M106 102l18 2 4 12" className="stroke-navy" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M96 100c-2-16 2-28 12-32s16 6 14 20l-4 12z" className="fill-accent" />
      <circle cx="112" cy="58" r="10" className="fill-lavender" />
      <path d="M99 54c2-9 9-13 15-12s11 6 11 12z" className="fill-navy" />
      <rect x="96" y="52" width="32" height="4" rx="2" className="fill-navy" />
      {/* arm and rod */}
      <path d="M116 78l14 6" className="stroke-accent" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M126 86L214 34" className="stroke-ink-2" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* line and float */}
      <path d="M214 34c6 30 6 66 2 96" className="stroke-ink-2" strokeWidth="1.25" fill="none" strokeDasharray="2 3" />
      <circle cx="216" cy="132" r="5" className="fill-live" />
      <path d="M206 140c6-3 14-3 20 0" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}
