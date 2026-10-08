import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Button — Fundații §07. 48px on mobile, 40px from 1280px, radius 10, label bodyStrong.
 * Pressed: opacity .8. Desktop hover (§06): soft-fill background on the light variants, no lift;
 * the filled variants darken slightly instead (a soft-fill ground would erase them).
 *
 * The disabled look ("Înscrieri închise") is the primary button on accent-disabled (indigo-4 in
 * light); other variants fade. Labels on the filled accent use on-accent (white in light, ink in
 * dark, where white on #818CF8 fails AA).
 */
export type ButtonVariant =
  "primary" | "secondary" | "outline" | "danger" | "dangerOutline" | "ghost" | "success";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-button hover:brightness-95",
  secondary: "bg-accent-tint-2 text-accent-ink hover:brightness-95",
  outline:
    "border-2 border-accent bg-surface text-accent-ink hover:bg-soft-fill",
  danger: "bg-status-danger-bg text-status-danger-fg hover:brightness-95",
  // A destructive confirm (fish ActionButton danger): white with a rose edge and label — clearly
  // active and clearly destructive, where the pale `danger` tint reads as disabled.
  dangerOutline:
    "border-2 border-live bg-surface text-status-danger-fg hover:bg-status-danger-bg",
  ghost: "text-ink-2 hover:bg-soft-fill",
  // The partidă «Captură» (fish ActivePartidaDock): green, filled like primary.
  success: "bg-success text-on-accent shadow-button hover:brightness-95",
};

const DISABLED: Record<ButtonVariant, string> = {
  primary: "bg-accent-disabled text-on-accent-disabled",
  secondary: "bg-accent-tint-2 text-accent-ink opacity-50",
  outline:
    "border-2 border-accent bg-surface text-accent-ink opacity-50",
  danger: "bg-status-danger-bg text-status-danger-fg opacity-50",
  dangerOutline: "border-2 border-live bg-surface text-status-danger-fg opacity-50",
  ghost: "text-ink-2 opacity-50",
  success: "bg-success text-on-accent opacity-50",
};

/**
 * default: 48 / 40px from 1280, label bodyStrong. compact: 36px at every width, 13px/700, 12px
 * sides — inline actions inside a card row («Reîncearcă» in ErrorState).
 */
export type ButtonSize = "default" | "compact";

const SIZE: Record<ButtonSize, string> = {
  default: "t-body-strong h-12 xl:h-10",
  compact: "h-9 t-button-compact",
};

/** Side padding; the outline's 2px border is taken out of it so every variant is the same width. */
const PAD: Record<ButtonSize, Record<ButtonVariant, string>> = {
  default: { primary: "px-5", secondary: "px-5", outline: "px-4.5", danger: "px-5", dangerOutline: "px-4.5", ghost: "px-3", success: "px-5" },
  compact: { primary: "px-3", secondary: "px-3", outline: "px-2.5", danger: "px-3", dangerOutline: "px-2.5", ghost: "px-3", success: "px-3" },
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Stretch to the container width (mobile CTAs, sheet footers). */
  block?: boolean;
  className?: string;
}

/** The class list, for elements that must look like a button but are not one. */
export function buttonClass({
  variant = "primary",
  size = "default",
  disabled,
  block,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control",
    SIZE[size],
    PAD[size][variant],
    "transition-[background-color,filter,opacity] duration-(--duration-fast) ease-fast",
    disabled
      ? cn("cursor-not-allowed", DISABLED[variant])
      : cn("cursor-pointer active:opacity-80", VARIANT[variant]),
    block && "w-full",
    className,
  );
}

interface ContentProps {
  /** Heroicon (24 outline) or brand icon, rendered at 20px before the label. */
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

function Content({ icon, iconRight, children }: ContentProps) {
  return (
    <>
      {icon ? (
        <span
          className="flex size-5 items-center justify-center [&>svg]:size-5"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      {children}
      {iconRight ? (
        <span
          className="flex size-5 items-center justify-center [&>svg]:size-5"
          aria-hidden="true"
        >
          {iconRight}
        </span>
      ) : null}
    </>
  );
}

export type ButtonProps = Omit<ComponentProps<"button">, "children"> &
  ContentProps & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function Button({
  variant = "primary",
  size,
  block,
  disabled,
  className,
  icon,
  iconRight,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={buttonClass({ variant, size, disabled, block, className })}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </button>
  );
}

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "children"> &
  ContentProps & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

/** A navigation that looks like a button. Links are never disabled: render a Button instead. */
export function ButtonLink({
  variant = "primary",
  size,
  block,
  className,
  icon,
  iconRight,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...rest}>
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </Link>
  );
}
