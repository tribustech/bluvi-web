import Link from 'next/link';
import { FishingRodIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { homeLinks } from './links';

/**
 * fish features/partide/components/community/NoActiveCta.tsx — «Ești la pescuit?» hero: indigo
 * gradient, wave strokes bottom-right, a solid white pill «Începe o partidă» and a quiet text link
 * «Intră cu cod». Signed out, both routes go to sign-in (fish).
 */
export function PartidaCta({ signedIn, layout, className }: { signedIn: boolean; layout: 'mobile' | 'desktop'; className?: string }) {
  return (
    <section
      aria-labelledby={`acasa-partida-cta-${layout}`}
      className={cn(
        'relative isolate flex flex-col justify-between gap-[15px] overflow-hidden rounded-[18px] bg-linear-120 from-accent-ink via-accent to-indigo-4 px-4 pt-[18px] pb-3.5 text-on-accent shadow-[0_12px_22px_-6px_color-mix(in_srgb,var(--color-accent)_50%,transparent)]',
        className
      )}
    >
      {/* decorative waves, bottom-right */}
      <svg
        aria-hidden
        width="190"
        height="150"
        viewBox="0 0 200 160"
        className="pointer-events-none absolute -right-6 -bottom-[30px] -z-10 opacity-35"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      >
        <path d="M10 40 q25 -18 50 0 t50 0 t50 0" />
        <path d="M10 80 q25 -18 50 0 t50 0 t50 0" />
        <path d="M10 120 q25 -18 50 0 t50 0 t50 0" />
      </svg>
      <div className="flex flex-col gap-[5px]">
        <h2 id={`acasa-partida-cta-${layout}`} className="t-title1 xl:t-title2">
          Ești la pescuit?
        </h2>
        <p className="max-w-[250px] t-caption text-on-accent/85">Capturi, lansete și cronometre — totul notat într-o singură partidă.</p>
      </div>
      <div className="flex items-center gap-[18px]">
        <Link
          href={signedIn ? homeLinks.partidaStart : homeLinks.signIn}
          className="flex items-center gap-[7px] rounded-full bg-surface px-[18px] py-3 t-body-strong text-accent shadow-e2 transition-opacity active:opacity-85"
        >
          <FishingRodIcon size={15} />
          Începe o partidă
        </Link>
        <Link href={signedIn ? homeLinks.partidaJoin : homeLinks.signIn} className="py-3 t-label underline">
          Intră cu cod
        </Link>
      </div>
    </section>
  );
}
