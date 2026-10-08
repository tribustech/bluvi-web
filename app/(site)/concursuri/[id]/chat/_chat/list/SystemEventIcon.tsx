import {
  ExclamationTriangleIcon,
  FlagIcon,
  InformationCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  ScaleIcon,
  TrophyIcon,
  UserGroupIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import type { SystemIcon } from '@/core/realtime/chat/systemMessages';
import { cn } from '@/components/ui/cn';

/*
 * fish SystemEventIcon (participant.chat c36): a tinted round icon per event family — podium gold
 * (the warning pair), penalties amber-red (danger), closing grey (neutral), weighings teal (success),
 * the rest indigo. `ring`: a surface outline for the overlapping stack of a folded group (c39).
 */
const ICONS: Record<SystemIcon, typeof FlagIcon> = {
  flag: FlagIcon,
  scale: ScaleIcon,
  trophy: TrophyIcon,
  warning: ExclamationTriangleIcon,
  user: UserIcon,
  lock: LockClosedIcon,
  users: UserGroupIcon,
  pin: MapPinIcon,
  info: InformationCircleIcon,
};

const TONES: Partial<Record<SystemIcon, string>> = {
  trophy: 'bg-status-warning-bg text-status-warning-fg',
  warning: 'bg-status-danger-bg text-status-danger-fg',
  lock: 'bg-status-neutral-bg text-status-neutral-fg',
  scale: 'bg-status-success-bg text-status-success-fg',
};

export function SystemEventIcon({ icon, ring = false, className }: { icon: SystemIcon; ring?: boolean; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', TONES[icon] ?? 'bg-accent-tint-2 text-accent-ink', ring && 'ring-2 ring-surface', className)}>
      <Icon className="size-4.5" strokeWidth={2} />
    </span>
  );
}
