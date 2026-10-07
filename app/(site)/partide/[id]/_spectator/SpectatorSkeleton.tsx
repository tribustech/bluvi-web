import { DetailBand, DetailHeader, DetailPage, photoHeroHeight } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { BODY_GRID, MAIN_COLUMN, SIDE_COLUMN } from './layout';

/*
 * The partidă's loading state (fish SpectatorPartidaSkeleton; parity partide.spectator states
 * «loading / checking ownership»): the loaded page's own shape in grey — the photo hero (phone:
 * first, 300px; from 768 the grid under the title row), the title row with its pill and meta, then
 * the total card, the tiles and the lists, in the same columns — so nothing jumps when it lands
 * (ROADMAP §5: CLS < 0.05). One status line for screen readers, and an <h1>.
 */

const BONE = 'animate-shimmer';

function Word({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative inline-block align-top', className)}>
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 rounded-full', BONE)} />
    </span>
  );
}

function Card({ className }: { className: string }) {
  return <span aria-hidden className={cn('block md:rounded-card', BONE, className)} />;
}

export function SpectatorSkeleton() {
  return (
    <div aria-busy="true" data-testid="partida-skeleton">
      <p role="status" className="sr-only">
        Se încarcă partida…
      </p>
      <DetailPage phoneGround="page">
        <DetailBand hairline={false}>
          <DetailHeader
            className="md:pt-5"
            title={
              <>
                <span className="sr-only">Partidă</span>
                <Word className="w-48 md:w-80" />
              </>
            }
            eyebrow={<Word className="w-20" />}
            meta={[<Word key="m" className="w-44" />]}
            badges={<span aria-hidden className={cn('block h-6.5 w-36 rounded-full', BONE)} />}
            actions={
              <>
                <span aria-hidden className={cn('block h-12 w-12 rounded-control xl:h-10 xl:w-32', BONE)} />
                <span aria-hidden className={cn('block h-12 w-36 rounded-control xl:h-10', BONE)} />
              </>
            }
          />
          <div data-t3="photo" className="relative max-md:-order-1 md:mx-6 md:mb-6 xl:mx-8">
            <span aria-hidden className={cn('block md:rounded-card', photoHeroHeight(5), BONE)} />
          </div>
        </DetailBand>
        <div className={BODY_GRID}>
          <div className={MAIN_COLUMN}>
            <Card className="mx-4 h-50 rounded-bento md:mx-0 md:rounded-bento" />
            <div className="grid grid-cols-3 gap-2 px-4 min-[1024px]:hidden md:px-0">
              {[0, 1, 2].map(i => (
                <Card key={i} className="h-28 rounded-bento md:rounded-bento" />
              ))}
            </div>
            <Card className="h-56" />
            <Card className="h-80" />
          </div>
          <div className={cn(SIDE_COLUMN, 'max-[1023px]:hidden')}>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => (
                <Card key={i} className="h-28 rounded-bento md:rounded-bento" />
              ))}
            </div>
            <Card className="h-64" />
            <Card className="h-20" />
          </div>
        </div>
      </DetailPage>
    </div>
  );
}
