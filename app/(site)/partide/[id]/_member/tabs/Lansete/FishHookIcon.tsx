import type { SVGProps } from 'react';

/** fish components/FishHookIcon — the bait line and the «fără trăsătură» scene. Stroke in currentColor, decorative. */
export function FishHookIcon({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...props}>
      <circle cx="15" cy="4" r="2" />
      <path d="M15 6v9a6 6 0 0 1-12 0v-3l3 3" />
    </svg>
  );
}
