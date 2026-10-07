import { FlowFieldSkeleton } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { AVATAR_CELL, FORM_CONTAINER, FORM_GRID, PROVIDER_ROW } from './layout';

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

/**
 * The profile form in grey (account.edit-profile.c2), on the form's own geometry (./layout.ts):
 * the 150px circle with the two actions (a row, or stacked in a narrow block as AvatarPicker), the
 * three fields (44 / 44 / the 3-line textarea with its counter) and the provider row.
 */
export function ProfileFormSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden data-testid="edit-profile-skeleton" className={cn(FORM_CONTAINER, className)}>
      <div className={FORM_GRID}>
        <div className={cn('@container flex min-w-0 flex-col items-center gap-3 md:gap-4', AVATAR_CELL)}>
          <span className="size-37.5 rounded-full bg-soft-fill animate-shimmer" />
          <span className="flex flex-col items-center @[20.5rem]:flex-row @[20.5rem]:gap-x-1">
            <span className="flex h-12 items-center px-3 xl:h-10">
              <span className={cn(BAR, 'h-3.5 w-32')} />
            </span>
            <span className="flex h-5 items-center">
              <span className={cn(BAR, 'h-3.5 w-6')} />
            </span>
            <span className="flex h-12 items-center px-3 xl:h-10">
              <span className={cn(BAR, 'h-3.5 w-32')} />
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <FlowFieldSkeleton height="h-11" label="w-28" />
          <FlowFieldSkeleton height="h-11" label="w-28" />
          <FlowFieldSkeleton height="h-25" label="w-16" helper />
        </div>
        <p className={PROVIDER_ROW}>
          <span className="size-5 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
          <span className={cn(BAR, 'h-3.5 w-44')} />
        </p>
      </div>
    </div>
  );
}
