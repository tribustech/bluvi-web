import Image from 'next/image';
import Link from 'next/link';
import type { SponsorDashboard } from '@/core/competitions';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { AsideCard, SPONSOR_TILE_GRID } from '../../stiri/_content/ArticleFrame';
import { fillsFrame, ratioOf } from '../../stiri/_content/imageSize';
import { allSponsors } from '../../stiri/_content/load';
import { probeImageSize } from '../../stiri/_content/probe';

/*
 * «Alți sponsori» — the sponsor page's side column (web: fish shows the sponsor alone; the right
 * track of T3 holds the way on). Acasă's sponsor list (the same cached read, tag `sponsors`)
 * without the open one, as Acasă's logo tiles: the 8:5 frame, landscape artwork from 4:3 to 2:1
 * filling it edge to edge, a square / tall logo contained with air (the ratio is read on the
 * server — probe.ts — so the tile never swaps fit after paint). On this WHITE card a white tile
 * has no edge, so (unlike Acasă's grid on the grey page) a contained logo sits on the page ground,
 * and the hairline is drawn OVER the picture (an inset shadow on the link itself paints under its
 * child image, which is why a filling white artwork lost its edge).
 * Tiles: two per row in the 1280+ rail; ~144px auto-fill while the card spans the page (768–1279),
 * so the list stays quieter than the sponsor's own logo above it.
 * Kit gap: Acasă's SponsorTile (app/(site)/_home/SponsorsSection.tsx) — one kit card.
 *
 * Its own async slot inside a <Suspense>: the sponsor never waits for the list. Nothing else to
 * show (or the read failed): the card stays with the way on to Acasă, where all the sponsors are.
 */
export function otherSponsors(all: SponsorDashboard[] | null, currentId: string, max = 6): SponsorDashboard[] {
  return (all ?? []).filter((s) => s.documentId !== currentId).slice(0, max);
}

type Tile = { sponsor: SponsorDashboard; src: string | null; fills: boolean };

export async function OtherSponsorsSlot({ currentId }: { currentId: string }) {
  const others = otherSponsors(await allSponsors(), currentId);
  const tiles: Tile[] = await Promise.all(
    others.map(async (s) => {
      const src = s.image?.smallUrl ?? s.image?.url ?? null;
      return { sponsor: s, src, fills: src ? fillsFrame(ratioOf(await probeImageSize(src))) : false };
    }),
  );
  return <OtherSponsors tiles={tiles} />;
}

export function OtherSponsors({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) {
    return (
      <AsideCard title="Alți sponsori">
        <p className="t-body text-muted">
          Toți sponsorii Bluvi sunt pe{' '}
          <Link href={routes.home()} className="rounded-control t-body-strong text-accent-ink underline-offset-2 hover:underline">
            pagina principală
          </Link>
          .
        </p>
      </AsideCard>
    );
  }
  return (
    <AsideCard title="Alți sponsori">
      <ul className={SPONSOR_TILE_GRID}>
        {tiles.map(({ sponsor: s, src, fills }) => (
          <li key={s.documentId}>
            <Link
              href={routes.sponsor(s.documentId)}
              className={cn(
                'relative flex aspect-8/5 w-full items-center justify-center overflow-hidden rounded-card transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast hover:shadow-e2 active:opacity-70',
                src && fills ? 'bg-surface' : 'bg-page',
              )}
            >
              {src ? (
                <Image src={src} alt={s.name} fill sizes="180px" className={cn(fills ? 'object-cover' : 'object-contain p-3')} />
              ) : (
                <span className="p-2 text-center t-body-strong text-ink">{s.name}</span>
              )}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-card shadow-e0" />
            </Link>
          </li>
        ))}
      </ul>
    </AsideCard>
  );
}
