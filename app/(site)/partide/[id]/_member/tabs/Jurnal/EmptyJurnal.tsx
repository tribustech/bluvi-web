import { FishIcon } from '@/components/icons/brand';

/*
 * fish JurnalScene EmptyJurnal (parity partide.partida-jurnal.c7). A truly empty register gets the
 * quiet scene (fish: the fishing-chair animation; here a still drawing of the same moment — a rod
 * over calm water, the float waiting) and fish's two lines; a register emptied only by the filters
 * keeps a plain «no results» note — the cosy scene would read as «nothing happened» when events
 * are merely hidden.
 */

function CalmWater({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" fill="none" aria-hidden className={className}>
      <circle cx="176" cy="38" r="16" className="fill-indigo-1" />
      <path d="M14 104c14-6 28-6 42 0s28 6 42 0 28-6 42 0 28 6 42 0 28-6 44 0" className="stroke-indigo-4" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 124c12-5 24-5 36 0s24 5 36 0 24-5 36 0 24 5 36 0" className="stroke-indigo-2" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 140 128 26" className="stroke-ink-2" strokeWidth="4" strokeLinecap="round" />
      <path d="M128 26c18 14 30 40 34 72" className="stroke-faint" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="162" cy="100" r="6" className="fill-live" />
      <path d="M156 100h12" className="stroke-surface" strokeWidth="2" />
      <path d="M152 112c6-3 14-3 20 0" className="stroke-indigo-4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyJurnal({ hasEvents }: { hasEvents: boolean }) {
  if (hasEvents) {
    return (
      <div data-testid="jurnal-empty-filtered" className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
        <FishIcon aria-hidden className="size-6.5 text-hairline" />
        <p className="t-body-strong text-muted">Niciun rezultat pentru filtrele alese</p>
      </div>
    );
  }
  return (
    <div data-testid="jurnal-empty" className="flex min-h-[52dvh] flex-col items-center justify-center gap-2 px-7 py-10 text-center md:min-h-0 md:py-14">
      <CalmWater className="mb-2 w-56 md:w-64" />
      <h2 className="t-heading text-ink">Liniște pe baltă… deocamdată</h2>
      <p className="max-w-[44ch] t-body text-muted">Tot ce se întâmplă la partidă se strânge aici — capturi, scăpate și trăsături, în ordinea în care le trăiești.</p>
    </div>
  );
}
