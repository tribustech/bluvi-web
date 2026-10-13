import { cn } from '@/components/ui/cn';

/**
 * Behind Acasă's hero from 768: a lake's depth chart — the contour lines of a bathymetric map, the
 * one picture every angler reads (where the drop-offs are) — drawn in hairline accent over a soft
 * accent-tint wash that fades into the page. Edge to edge (the shell's overflow-x-clip keeps the
 * full-bleed box from adding a scroll), decorative only.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 left-1/2 z-behind w-screen -translate-x-1/2 overflow-hidden',
        'bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-accent-tint)_0%,var(--color-page)_70%)]',
        className,
      )}
    >
      <svg
        viewBox="0 0 1600 480"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full text-accent opacity-[0.16] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        {/* Left basin: five depth lines, deeper toward the centre. */}
        <path d="M-60 110 C 60 30, 260 20, 380 90 S 520 260, 420 340 S 120 430, 10 380 S -140 190, -60 110 Z" />
        <path d="M-20 140 C 80 70, 240 64, 340 118 S 460 250, 380 312 S 130 386, 40 346 S -100 210, -20 140 Z" />
        <path d="M30 170 C 110 116, 220 112, 296 150 S 392 244, 334 284 S 150 338, 80 310 S -40 226, 30 170 Z" />
        <path d="M84 200 C 140 164, 210 162, 254 186 S 316 236, 282 258 S 170 290, 124 274 S 30 238, 84 200 Z" />
        <path d="M138 224 C 168 206, 204 206, 222 218 S 246 240, 230 248 S 182 262, 160 254 S 112 240, 138 224 Z" />
        {/* Right basin. */}
        <path d="M1180 40 C 1330 -10, 1560 20, 1660 120 S 1700 360, 1560 420 S 1260 450, 1170 360 S 1040 90, 1180 40 Z" />
        <path d="M1210 80 C 1330 40, 1520 64, 1600 146 S 1630 340, 1520 384 S 1290 404, 1214 334 S 1100 120, 1210 80 Z" />
        <path d="M1250 122 C 1340 94, 1480 110, 1540 174 S 1560 316, 1476 346 S 1314 356, 1260 304 S 1170 150, 1250 122 Z" />
        <path d="M1294 164 C 1356 146, 1446 156, 1484 200 S 1496 290, 1440 308 S 1336 312, 1302 278 S 1240 182, 1294 164 Z" />
        <path d="M1340 206 C 1372 196, 1414 202, 1432 224 S 1436 266, 1408 272 S 1356 274, 1340 256 S 1312 214, 1340 206 Z" />
      </svg>
    </div>
  );
}
