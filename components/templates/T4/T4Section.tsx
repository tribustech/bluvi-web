import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

type Props = {
  /** Section title (h2): «Când vii», «Date de contact». */
  title: string;
  /** One line under the title: what the section decides. */
  description?: ReactNode;
  /** 24px outline icon in a tinted 40px disc (fish CompetitionSectionHeader). */
  icon?: ReactNode;
  /** Right of the title: «Modifică», a count («3 din 21 libere»). */
  action?: ReactNode;
  children: ReactNode;
  /** `plain`: no card (the content brings its own cards — a grid of choice cards). */
  variant?: 'card' | 'plain';
  /**
   * The group failed as a whole (no stand chosen): a 1px danger ring on the card, the message
   * under its content. The choices inside stay neutral.
   */
  invalid?: boolean;
  id?: string;
  className?: string;
};

/**
 * One group of fields inside a step — fish CompetitionSectionHeader + its fields, in a surface card
 * on the page ground (fish BookingCard: white, no border, the page sets it off). Padding 16 / 20 /
 * 24 by breakpoint; the header and the fields 16 apart.
 */
export function T4Section({ title, description, icon, action, children, variant = 'card', invalid = false, id, className }: Props) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn(
        'flex flex-col gap-4',
        variant === 'card' && 'rounded-card bg-surface p-4 md:p-5 xl:p-6',
        variant === 'card' && (invalid ? 'shadow-[inset_0_0_0_1px_var(--color-status-danger-line)]' : 'shadow-e0'),
        className,
      )}
    >
      <T4SectionHeader title={title} description={description} icon={icon} action={action} />
      {children}
    </section>
  );
}

/**
 * The header of every T4 card (<T4Section>, <T4ReviewGroup>): a 40px accent-tint disc with a 24px
 * outline glyph (Fundații §05; accent-ink, as T3's discs), the h2 + one caption line, an action at
 * the right. One component, so the step's icon and text columns cannot drift between card kinds.
 */
export function T4SectionHeader({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon ? (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6"
        >
          {icon}
        </span>
      ) : null}
      <div className={cn('min-w-0 flex-1', Boolean(icon) && 'pt-0.5')}>
        <h2 className="t-heading text-ink">{title}</h2>
        {description ? <p className="t-caption text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Fields side by side from 768 (name + phone, start + end). One column on a phone, like fish.
 * `cols={3}` adds a third column from 1280.
 */
export function T4FieldGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 2 | 3; className?: string }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2', cols === 3 && 'xl:grid-cols-3', className)}>{children}</div>
  );
}
