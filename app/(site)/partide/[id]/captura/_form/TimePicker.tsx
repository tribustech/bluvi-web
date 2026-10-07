'use client';

import { useId, useState } from 'react';
import { pad2 } from '@/core/partide';
import { controlShell } from '@/components/forms/Field';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/*
 * «Ora capturii» (parity partide.captura.c7; fish captura.tsx TimePickerSheet): the browser's own
 * 24-hour time field (fish: the iOS spinner / the Android time dialog), committed on «Gata». The
 * caller applies the HH:MM to the capture's day and moves it back 24 h when that lands in the
 * future (core applyTimePick).
 */
export function TimePicker({ open, valueMs, onDone, onClose }: { open: boolean; valueMs: number; onDone: (picked: { hours: number; minutes: number }) => void; onClose: () => void }) {
  return open ? <Body valueMs={valueMs} onDone={onDone} onClose={onClose} /> : null;
}

function Body({ valueMs, onDone, onClose }: { valueMs: number; onDone: (picked: { hours: number; minutes: number }) => void; onClose: () => void }) {
  const d = new Date(valueMs);
  const [draft, setDraft] = useState(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
  const id = useId();
  const commit = () => {
    const m = /^(\d{1,2}):(\d{2})/.exec(draft);
    if (m) onDone({ hours: Number(m[1]), minutes: Number(m[2]) });
    onClose();
  };
  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="info"
      title="Ora capturii"
      sheetSnap="fit"
      actions={
        <Button type="button" block className="md:w-auto" data-testid="time-done" onClick={commit}>
          Gata
        </Button>
      }
    >
      <form
        className="flex flex-col gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          commit();
        }}
      >
        <label htmlFor={id} className="t-label text-ink-2">
          Ora
        </label>
        <div className={controlShell(false)}>
          <input id={id} type="time" required value={draft} onChange={e => setDraft(e.target.value)} className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none" data-testid="time-input" />
        </div>
      </form>
    </ResponsiveSurface>
  );
}
