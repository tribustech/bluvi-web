'use client';

import { useId, useRef, type ComponentType, type ReactNode, type SVGProps } from 'react';
import Link from 'next/link';
import { CheckIcon, ClockIcon, DocumentDuplicateIcon, PencilSquareIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Registration } from '@/core/competitions';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';
import { useSiteToast } from '../../../../_shell/Toast';
import { confirmOf, editHref, phoneHref, phoneText, rowActions, type StatusAction } from './model';

/*
 * fish CollapsableActions: «Editează», «Apelează», and before the start «Mută în așteptare»,
 * «Elimină» | «Respinge», «Aprobă». Two looks:
 *  - `tiles` (below 1024, the opened row): fish's coloured squares with the label under them, spread
 *    over the row;
 *  - `inline` (from 1024, the roster table's last cell): Editează and Apelează as icon buttons (their
 *    names in aria-label / title), the status changes as labelled compact buttons. Every action has
 *    its own fixed slot (edit · call · «Mută în așteptare» · reject/remove · approve), an absent one
 *    an empty cell, so each keeps its x down the table (owner rules 14, 18). Apelează opens the
 *    number (a desktop has no dialer): «Copiază» and «Sună», contact_pressed on either.
 */

/** The inline slots' widths: edit · call · «Mută în așteptare» · «Respinge»/«Elimină» · «Aprobă». */
export const INLINE_SLOTS = 'grid-cols-[2.25rem_2.25rem_10.75rem_7rem_6.25rem]';
/** After the start only Editează and Apelează remain. */
export const INLINE_SLOTS_NO_STATUS = 'grid-cols-[2.25rem_2.25rem]';
const STATUS_SLOT: Record<StatusAction, number> = { pending: 3, reject: 4, approve: 5 };

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Tone = 'info' | 'accent' | 'pending' | 'danger' | 'success';

/** fish colours: cyan6 · indigo5 · yellow7 · red5 · green5 → the status pairs' strong ink + the accent. */
const TILE: Record<Tone, string> = {
  info: 'bg-status-info-fg',
  accent: 'bg-accent',
  pending: 'bg-status-pending-fg',
  danger: 'bg-status-danger-fg',
  success: 'bg-status-success-fg',
};
const INLINE: Record<Tone, string> = {
  info: 'text-status-info-fg hover:bg-status-info-bg',
  accent: 'text-accent-ink hover:bg-accent-tint',
  pending: 'bg-status-pending-bg text-status-pending-fg hover:brightness-95',
  danger: 'bg-status-danger-bg text-status-danger-fg hover:brightness-95',
  success: 'bg-status-success-bg text-status-success-fg hover:brightness-95',
};
const STATUS_TONE: Record<StatusAction, Tone> = { pending: 'pending', reject: 'danger', approve: 'success' };
const STATUS_ICON: Record<StatusAction, Icon> = { pending: ClockIcon, reject: XMarkIcon, approve: CheckIcon };

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

type Props = {
  competitionId: string;
  competitionName: string;
  competitionStatus: string;
  registration: Registration;
  /** The row's name, for the actions' accessible names on the table («Editează — Ion»). */
  subject: string;
  variant: 'tiles' | 'inline';
  /** A status action pressed: the list asks first (StatusConfirmDialog). */
  onStatus: (action: StatusAction) => void;
  /** Editează followed (fish collapses the row). */
  onLeave?: () => void;
};

export function RowActions({ competitionId, competitionName, competitionStatus, registration: r, subject, variant, onStatus, onLeave }: Props) {
  const toast = useSiteToast();
  const actions = rowActions(competitionStatus, r.registrationStatus);
  const tel = phoneHref(r);
  const onCall = () =>
    track('contact_pressed', { contact_type: 'Organizer registrant contact', competition_id: competitionId, competition_name: competitionName });
  const named = (label: string) => (variant === 'inline' ? `${label} — ${subject}` : undefined);

  if (variant === 'inline') {
    const statusSlots = competitionStatus === 'notStarted';
    return (
      <div role="group" aria-label={`Acțiuni — ${subject}`} className={cn('ml-auto grid w-max items-center justify-end gap-1.5', statusSlots ? INLINE_SLOTS : INLINE_SLOTS_NO_STATUS)}>
        {actions.edit ? (
          <Action variant={variant} tone="info" Icon={PencilSquareIcon} label="Editează" ariaLabel={named('Editează')} iconOnly href={editHref(competitionId, r)} onClick={onLeave} />
        ) : (
          <span aria-hidden />
        )}
        {tel ? (
          <CallPopover phone={phoneText(r)!} tel={tel} subject={subject} onContact={onCall} />
        ) : (
          <Action variant={variant} tone="accent" Icon={PhoneIcon} label="Apelează" ariaLabel={named('Apelează')} iconOnly onClick={() => toast('Număr de telefon invalid', 'danger')} />
        )}
        {actions.status.map(a => {
          const c = confirmOf(a, r.registrationStatus);
          return (
            <span key={a} className="flex [&>*]:w-full" style={{ gridColumnStart: STATUS_SLOT[a], gridRowStart: 1 }}>
              <Action variant={variant} tone={STATUS_TONE[a]} Icon={STATUS_ICON[a]} label={c.label} ariaLabel={named(c.label)} onClick={() => onStatus(a)} />
            </span>
          );
        })}
      </div>
    );
  }

  const items: ReactNode[] = [];
  if (actions.edit) {
    items.push(<Action key="edit" variant={variant} tone="info" Icon={PencilSquareIcon} label="Editează" href={editHref(competitionId, r)} onClick={onLeave} />);
  }
  items.push(
    tel ? (
      <Action key="call" variant={variant} tone="accent" Icon={PhoneIcon} label="Apelează" href={tel} onClick={onCall} external />
    ) : (
      // fish showErrorToast('Număr de telefon invalid').
      <Action key="call" variant={variant} tone="accent" Icon={PhoneIcon} label="Apelează" onClick={() => toast('Număr de telefon invalid', 'danger')} />
    ),
  );
  for (const a of actions.status) {
    const c = confirmOf(a, r.registrationStatus);
    items.push(<Action key={a} variant={variant} tone={STATUS_TONE[a]} Icon={STATUS_ICON[a]} label={c.label} onClick={() => onStatus(a)} />);
  }

  return (
    <ul aria-label="Acțiuni" className="flex justify-around gap-1">
      {items.map((item, i) => (
        <li key={i} className="flex min-w-0 flex-1 justify-center">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Apelează on a desktop (≥1024): the number in a small popover (top layer, light dismiss, Escape)
 * with «Copiază» and «Sună» (the tel: link, for a machine that has a dialer). contact_pressed on either.
 */
function CallPopover({ phone, tel, subject, onContact }: { phone: string; tel: string; subject: string; onContact: () => void }) {
  const toast = useSiteToast();
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const place = (el: HTMLElement) => {
    const a = btn.current?.getBoundingClientRect();
    if (!a) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(12, Math.min(a.right - w, window.innerWidth - w - 12));
    const below = a.bottom + 6;
    const top = below + h > window.innerHeight - 12 ? Math.max(12, a.top - 6 - h) : below;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.dataset.placed = '';
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      onContact();
      toast('Număr copiat', 'success');
    } catch {
      toast('Nu am putut copia numărul.', 'danger');
    }
    document.getElementById(id)?.hidePopover();
  };
  return (
    <>
      <button
        ref={btn}
        type="button"
        popoverTarget={id}
        aria-label={`Apelează — ${subject}`}
        title="Apelează"
        className={cn('inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control transition-[background-color] duration-(--duration-fast)', INLINE.accent, FOCUS)}
      >
        <PhoneIcon aria-hidden className="size-5" />
      </button>
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-label={`Telefon — ${subject}`}
        onToggle={e => {
          const el = e.currentTarget;
          if ((e as unknown as { newState?: string }).newState === 'open') place(el);
          else delete el.dataset.placed;
        }}
        className="fixed inset-auto m-0 w-max max-w-80 rounded-card bg-raised p-3 text-ink shadow-e2 ring-1 ring-hairline not-data-placed:invisible"
      >
        <p className="px-1 t-caption text-muted">Telefon</p>
        <p className="px-1 pb-2 t-heading tabular-nums select-all">{phone}</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void copy()}
            className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control px-3 t-button-compact text-accent-ink hover:bg-accent-tint', FOCUS)}
          >
            <DocumentDuplicateIcon aria-hidden className="size-4" />
            Copiază
          </button>
          <a href={tel} onClick={onContact} className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control bg-accent px-3 t-button-compact text-on-accent hover:brightness-95', FOCUS)}>
            <PhoneIcon aria-hidden className="size-4" />
            Sună
          </a>
        </div>
      </div>
    </>
  );
}

function Action({
  variant,
  tone,
  Icon,
  label,
  ariaLabel,
  iconOnly,
  href,
  external,
  onClick,
}: {
  variant: 'tiles' | 'inline';
  tone: Tone;
  Icon: Icon;
  label: string;
  ariaLabel?: string;
  /** Inline only: the icon alone (its name in aria-label and the tooltip). */
  iconOnly?: boolean;
  href?: string;
  /** A tel: link (a plain <a>, never the router). */
  external?: boolean;
  onClick?: () => void;
}) {
  const body =
    variant === 'tiles' ? (
      <>
        <span aria-hidden className={cn('flex size-8 items-center justify-center rounded-control text-on-accent', TILE[tone])}>
          <Icon className="size-4.5" />
        </span>
        <span className="text-center t-micro font-semibold text-balance text-ink">{label}</span>
      </>
    ) : iconOnly ? (
      <Icon aria-hidden className="size-5" />
    ) : (
      <>
        <Icon aria-hidden className="size-4" />
        {label}
      </>
    );
  const cls =
    variant === 'tiles'
      ? cn('flex min-h-14 w-full max-w-24 cursor-pointer flex-col items-center gap-1 rounded-control px-1 py-1.5 hover:bg-soft-fill', FOCUS)
      : cn(
          'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control t-button-compact whitespace-nowrap transition-[background-color,filter] duration-(--duration-fast)',
          iconOnly ? 'w-9' : 'px-3',
          INLINE[tone],
          FOCUS,
        );
  const a11y = { 'aria-label': ariaLabel, title: variant === 'inline' && iconOnly ? label : undefined };
  if (href && external) {
    return (
      <a href={href} onClick={onClick} className={cls} {...a11y}>
        {body}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls} {...a11y}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} {...a11y}>
      {body}
    </button>
  );
}
