import type { SVGProps } from 'react';

/*
 * The two lucide glyphs fish's ranking bar uses (RankingActionBar: Cântare = lucide HistoryIcon,
 * Chat = lucide MessageCircle), drawn from lucide's own paths (ISC licence) so the phone bar has
 * exactly fish's icons without the whole icon package (ROADMAP §4b.25).
 */

function Lucide({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Lucide {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Lucide>
  );
}

export function MessageCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Lucide {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Lucide>
  );
}
