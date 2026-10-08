'use client';

import type { ReactNode } from 'react';
import { NoSymbolIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';

/*
 * The three outcomes under every rod card, in every state (fish PartidaRodCard «outcomes — every
 * state», parity partide.partida-lansete.c4): «Fără trăsătură» (grey), «Scăpat» (yellow),
 * «Captură» (green, emphasised). Offline they dim (fish: «the controls also dim so the disabled
 * state reads») but stay focusable: the handler answers with «Fără conexiune. Reconectare…» (c12).
 */
export function OutcomeButtons({
  dimmed,
  onBlank,
  onLost,
  onCapture,
}: {
  dimmed: boolean;
  onBlank: () => void;
  onLost: () => void;
  onCapture: () => void;
}) {
  return (
    <div role="group" aria-label="Rezultat" className="grid grid-cols-3 gap-2">
      <Outcome label="Fără trăsătură" tone="bg-soft-fill text-ink-2" dimmed={dimmed} onClick={onBlank} testId="rod-outcome-blank">
        <NoSymbolIcon aria-hidden className="size-[18px]" />
      </Outcome>
      <Outcome label="Scăpat" tone="bg-status-warning-bg text-status-warning-fg" dimmed={dimmed} onClick={onLost} testId="rod-outcome-lost">
        <FishIcon size={18} />
      </Outcome>
      <Outcome label="Captură" tone="bg-success text-on-accent shadow-button" dimmed={dimmed} onClick={onCapture} testId="rod-outcome-capture">
        <FishIcon size={18} />
      </Outcome>
    </div>
  );
}

function Outcome({ label, tone, dimmed, onClick, testId, children }: { label: string; tone: string; dimmed: boolean; onClick: () => void; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-disabled={dimmed || undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-control px-1 py-2 t-caption',
        'cursor-pointer transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-70',
        tone,
        dimmed && 'opacity-50',
      )}
    >
      {children}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
