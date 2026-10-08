import type { ComponentType, SVGProps } from 'react';
import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  PencilSquareIcon,
  PlayIcon,
  ScaleIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import type { OrganizerIcon, OrganizerOption } from './model';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish submenuIcon per organizer entry (heroicons, outline on the web — Fundații §05). fish paints
 * each tile its own hue; the web keeps the one accent tint, and the destructive entries (end, close a
 * leg, remove a referee) the danger tint — fish's red squares.
 */
export const ORGANIZER_ICON: Record<OrganizerIcon, Icon> = {
  edit: PencilSquareIcon,
  sectors: ClipboardDocumentListIcon,
  participants: UsersIcon,
  guests: UserPlusIcon,
  start: PlayIcon,
  end: FlagIcon,
  scale: ScaleIcon,
  weighings: ClockIcon,
  addReferee: UserPlusIcon,
  removeReferee: UserMinusIcon,
  penalties: ExclamationTriangleIcon,
  register: ClipboardDocumentCheckIcon,
};

export const optionTone = (o: Pick<OrganizerOption, 'icon'>): 'accent' | 'danger' =>
  o.icon === 'end' || o.icon === 'removeReferee' ? 'danger' : 'accent';
