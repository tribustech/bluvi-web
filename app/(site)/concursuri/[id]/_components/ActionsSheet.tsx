'use client';

import type { ComponentType, ReactNode, SVGProps } from 'react';
import Link from 'next/link';
import { ClipboardDocumentListIcon, ClockIcon, ScaleIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';
import type { RegistrationAction } from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import { Sheet } from '@/components/surfaces/Sheet';
import { cn } from '@/components/ui/cn';
import type { PageViewer } from './Follow';
import { ORGANIZER_ICON, optionTone } from './organizer/icons';
import type { SheetItem } from './organizer/model';

/*
 * fish CompetitionActionSheet + NormalUserSheetItems + OrganizerSheetItems + RefereeSheetItems +
 * AddCantarSheetItem + ExtraScaleRequestSheetItem — the «Acțiuni» sheet of the route tabs other than
 * Clasament (parity competition-page.bara-actiuni c11–c14, competition-page.organizare c12 c13,
 * organizer.b.scale-entries, shell.c28). Phone only: it opens from the bar's «Acțiuni» tile
 * (ActionBar); from 768 the same actions are the header's buttons and the «Organizare» menu.
 *
 *  - a guest: only «Autentifică-te pentru a putea participa la competiție» → sign-in;
 *  - while the session / statute (and, for the author or a referee, the seating) is read: skeleton
 *    rows (fish SheetItemsSkeleton);
 *  - the author: fish OrganizerSheetItems (organizer/model.ts organizerSheetItems — closed rows say
 *    why under their label; the writes ask first, the referee pickers open over the page) and the
 *    extra-scale item when they are a registered participant of a running competition;
 *  - a referee: the add-weighing item (fish RefereeSheetItems);
 *  - a signed-in angler: «Înscrie-te» / «Modifică înscrierea» (core registrationAction: disabled
 *    with fish's reason under it; offered, it opens the registration form or the team disclaimer),
 *    after the start «Vezi cântarele din concurs», and for a registered participant of a running
 *    competition «Solicită extra cântar» / «Șterge solicitarea de extra cântar».
 *
 * «Vezi cântarele din concurs» opens the scale area's weighings (/cantar, fish /scale/[id]; read-only
 * for an angler).
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type SheetExtraScale = {
  requested: boolean;
  /** «Se înregistrează cererea...» / «Se șterge cererea...» while it is sent. */
  pendingLabel: string | null;
  onPress: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  statutePending: boolean;
  competitionStatus: string;
  registration: RegistrationAction | null;
  registrationHref: string;
  signIn: string;
  weighingsHref: string;
  extraScale: SheetExtraScale | null;
  /**
   * The author's / a referee's rows (organizer/model.ts); null while the seating they depend on is
   * read (skeleton). A non-link row is handed to `onManagerAction` (a question, a picker).
   */
  managerItems: SheetItem[] | null;
  onManagerAction: (item: SheetItem) => void;
};

export function ActionsSheet({
  open,
  onClose,
  viewer,
  statute,
  statutePending,
  competitionStatus,
  registration,
  registrationHref,
  signIn,
  weighingsHref,
  extraScale,
  managerItems,
  onManagerAction,
}: Props) {
  const role = statute?.userRole;
  const manager = role === 'author' || role === 'referee';
  const extraItem = extraScale ? (
    <SheetButton
      Icon={extraScale.requested ? TrashIcon : ScaleIcon}
      tone={extraScale.requested ? 'danger' : 'accent'}
      label={extraScale.requested ? 'Șterge solicitarea de extra cântar' : 'Solicită extra cântar'}
      disabled={!!extraScale.pendingLabel}
      busy={!!extraScale.pendingLabel}
      description={extraScale.pendingLabel ?? undefined}
      onPress={extraScale.onPress}
    />
  ) : null;
  let items: ReactNode;
  if (viewer === null) {
    items = <SheetLink href={signIn} Icon={UserIcon} label="Autentifică-te pentru a putea participa la competiție" />;
  } else if (viewer === undefined || statutePending || (manager && !managerItems)) {
    items = <SheetSkeleton />;
  } else if (manager && managerItems) {
    items = (
      <>
        {managerItems.map(item => {
          const ItemIcon = ORGANIZER_ICON[item.icon];
          return item.action.type === 'link' && !item.disabled ? (
            <SheetLink key={item.key} href={item.action.href} Icon={ItemIcon} label={item.label} onNavigate={onClose} />
          ) : (
            <SheetButton
              key={item.key}
              Icon={ItemIcon}
              label={item.label}
              tone={optionTone(item)}
              disabled={item.disabled}
              description={item.reason}
              onPress={() => {
                // fish: the sheet closes, then the Alert / the picker opens.
                onClose();
                onManagerAction(item);
              }}
            />
          );
        })}
        {/* fish OrganizerSheetItems ends with ExtraScaleRequestSheetItem (a registered author). */}
        {role === 'author' ? extraItem : null}
      </>
    );
  } else {
    const label = registration?.label ?? 'Înscrie-te';
    items = (
      <>
        {registration && !registration.disabled ? (
          <SheetLink href={registrationHref} Icon={ClipboardDocumentListIcon} label={label} onNavigate={onClose} />
        ) : (
          <SheetButton Icon={ClipboardDocumentListIcon} label={label} disabled description={registration?.reason ?? undefined} />
        )}
        {competitionStatus !== 'notStarted' ? <SheetLink href={weighingsHref} Icon={ClockIcon} label="Vezi cântarele din concurs" onNavigate={onClose} /> : null}
        {extraItem}
      </>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title="Acțiuni">
      <ul className="flex flex-col gap-2 pb-4" data-testid="actions-sheet">
        {items}
      </ul>
    </Sheet>
  );
}

const ROW =
  'flex min-h-14 w-full items-center gap-3 rounded-card bg-soft-fill px-4 py-3 text-left text-ink outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent';

function RowBody({ Icon, label, description, tone = 'accent' }: { Icon: Icon; label: string; description?: string; tone?: 'accent' | 'danger' }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-control',
          tone === 'danger' ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-accent-tint text-accent-ink',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="t-body-strong">{label}</span>
        {description ? <span className="t-caption text-muted">{description}</span> : null}
      </span>
    </>
  );
}

function SheetLink({ href, Icon, label, description, onNavigate }: { href: string; Icon: Icon; label: string; description?: string; onNavigate?: () => void }) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} className={cn(ROW, 'cursor-pointer')}>
        <RowBody Icon={Icon} label={label} description={description} />
      </Link>
    </li>
  );
}

function SheetButton({
  Icon,
  label,
  description,
  disabled = false,
  busy = false,
  tone,
  onPress,
}: {
  Icon: Icon;
  label: string;
  description?: string;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'accent' | 'danger';
  onPress?: () => void;
}) {
  return (
    <li>
      {/* aria-disabled, not disabled: a closed action stays focusable and says why (its description). */}
      <button
        type="button"
        aria-disabled={disabled || undefined}
        aria-busy={busy || undefined}
        onClick={disabled ? undefined : onPress}
        className={cn(ROW, disabled ? (busy ? 'cursor-progress' : 'cursor-not-allowed') : 'cursor-pointer', disabled && '[&>span:first-child]:opacity-50')}
      >
        <RowBody Icon={Icon} label={label} description={description} tone={tone} />
      </button>
    </li>
  );
}

function SheetSkeleton() {
  return (
    <>
      {[0, 1].map(i => (
        <li key={i} aria-hidden className="h-14 animate-shimmer rounded-card" />
      ))}
      <li className="sr-only" role="status">
        Se încarcă acțiunile…
      </li>
    </>
  );
}
