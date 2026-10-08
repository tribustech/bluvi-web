import { cn } from '@/components/ui/cn';

/*
 * fish DateChip (participant.chat c15): the centred grey chip that separates days («Astăzi», «Ieri»,
 * «joi, 2 oct.», «12 dec. 2025») and floats over the top of the list while scrolling. fish
 * NewMessagesSeparator (c34): «Mesaje noi» between two indigo hairlines.
 */
export function DateChip({ label, floating = false }: { label: string; floating?: boolean }) {
  return (
    <span className={cn('inline-flex rounded-full bg-soft-fill px-3 py-1 t-caption text-ink-2', floating && 'shadow-e1 ring-1 ring-hairline')}>
      {label}
    </span>
  );
}

export function NewMessagesDivider() {
  return (
    <div className="my-2.5 flex items-center gap-2.5 px-4">
      <span aria-hidden className="h-px flex-1 bg-indigo-4" />
      <span className="t-label text-accent-ink">Mesaje noi</span>
      <span aria-hidden className="h-px flex-1 bg-indigo-4" />
    </div>
  );
}
