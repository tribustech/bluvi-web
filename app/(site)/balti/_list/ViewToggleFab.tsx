import Link from 'next/link';
import { ListBulletIcon, MapIcon } from '@heroicons/react/24/outline';
import { T2_FLOATING_BUTTON } from '@/components/templates/T2';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/**
 * The floating list ↔ map switch (fish's floating map button, lakes.home.c23), the same pill in the
 * same place on both views (owner 2026-10-13: «Arată lista» was elsewhere — now going list ↔ map
 * moves nothing): bottom centre, above the phone's tab bar and the consent banner. From 768 it is
 * bigger (56 high, the heading step, a deeper shadow) on accent-ink — white on the accent is under
 * AA at this size. The list shows «Arată harta» (the all-lakes map), the map «Arată lista» (back to
 * /balti, dropping the map's query, c2).
 */
export function ViewToggleFab({ to, className }: { to: 'map' | 'list'; className?: string }) {
  const map = to === 'map';
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-[calc(max(var(--tabbar-h,0px),env(safe-area-inset-bottom))+var(--spacing)*4+var(--consent-inset,0px))] z-overlay flex justify-center px-4 md:bottom-[calc(var(--spacing)*7+var(--consent-inset,0px))]',
        className,
      )}
    >
      <Link
        href={map ? routes.lakesMap() : routes.lakes()}
        className={buttonClass({
          variant: 'primary',
          className: cn(
            'pointer-events-auto gap-2 rounded-full! px-5.5',
            T2_FLOATING_BUTTON,
            'md:h-14! md:gap-2.5 md:bg-accent-ink! md:px-7! md:t-heading md:text-surface! md:shadow-[0_16px_40px_-12px_rgb(67_56_202/0.55)]! md:transition-transform md:hover:-translate-y-0.5 md:active:translate-y-0 motion-reduce:md:hover:translate-y-0',
          ),
        })}
      >
        {map ? <MapIcon aria-hidden className="size-5 stroke-2 md:size-6" /> : <ListBulletIcon aria-hidden className="size-5 stroke-2 md:size-6" />}
        {map ? 'Arată harta' : 'Arată lista'}
      </Link>
    </div>
  );
}
