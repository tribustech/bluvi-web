import type { ReactNode } from 'react';

/*
 * Small building blocks shared by the cards and the ranking. They follow Fundații §07:
 * status pills are round (radius 999), attribute badges are square-ish (radius 2).
 */

export type TagTone = 'green' | 'yellow' | 'indigo' | 'gray' | 'red';

const TAG_TONES: Record<TagTone, string> = {
  // Same pairs as fish Badge.tsx (green3_20 / yellow1_50 / indigo1 / gray3 / red1).
  // green/yellow use the theme-aware badge tokens so they flip under [data-theme="dark"].
  green: 'bg-badge-green-bg text-badge-green-fg',
  yellow: 'bg-badge-yellow-bg text-badge-yellow-fg',
  indigo: 'bg-accent-tint text-accent-ink',
  gray: 'bg-status-neutral-bg text-status-neutral-fg',
  red: 'bg-status-danger-bg text-status-danger-fg',
};

/** Attribute badge (type, criterion, penalty): radius 2, never a status. */
export function Tag({
  tone,
  children,
  size = 'md',
  title,
}: {
  tone: TagTone;
  children: ReactNode;
  size?: 'sm' | 'md';
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-badge whitespace-nowrap ${
        size === 'sm' ? 'px-[5px] py-px t-nano' : 'px-[5px] py-0.5 t-micro-strong'
      } ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export type PillTone = 'live' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'scrim' | 'light';

const PILL_TONES: Record<PillTone, string> = {
  live: 'bg-status-live-bg text-status-live-fg font-extrabold',
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  // On photos: a dark scrim chip (no blur) and a light chip with ink text.
  scrim: 'bg-photo-scrim text-on-photo-scrim',
  light: 'bg-photo-chip text-ink',
};

/** Status pill: radius 999. `live` gets the pulsing dot (the only thing that pulses). */
export function Pill({ tone, children, className = '' }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full px-2 t-micro-strong whitespace-nowrap ${PILL_TONES[tone]} ${className}`}
    >
      {tone === 'live' && <span aria-hidden className="size-1.5 rounded-full bg-current animate-live" />}
      {children}
    </span>
  );
}

/**
 * «Fără capturi» — the competitor finished without a catch, where a word is needed (a card or a
 * list without a weight column). Never «capot» (ROADMAP §4b.11); a ranking's weight reads «–».
 * Dashed outline, neutral.
 */
export function NoCatchChip({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-dashed border-faint bg-soft-fill t-label whitespace-nowrap text-ink ${
        size === 'sm' ? 'h-[22px] px-2' : 'h-6 px-[9px]'
      }`}
    >
      Fără capturi
    </span>
  );
}

/** Caps line over a card title: the competition date range, "PARTIDĂ · ÎN DESFĂȘURARE". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="t-eyebrow text-muted uppercase">{children}</p>;
}
