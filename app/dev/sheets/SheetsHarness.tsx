'use client';

import { useState } from 'react';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Sheet, type SheetSnap } from '@/components/surfaces/Sheet';
import { Button } from '@/components/ui/Button';

type Open =
  | { kind: 'sheet'; snap: SheetSnap; rows: number; field?: boolean; footer?: boolean }
  | { kind: 'responsive' }
  | { kind: 'modal'; fullScreen: boolean }
  | null;

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <p key={i} className="py-2 t-body text-ink-2">
      Rândul {i + 1}
    </p>
  ));

export function SheetsHarness() {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  return (
    <main className="mx-auto max-w-[720px] px-4 py-6">
      <h1 className="t-page-title">Foi de telefon</h1>
      <div className="sticky top-0 z-above flex flex-wrap gap-2 bg-page py-3">
        <Button variant="secondary" onClick={() => setOpen({ kind: 'sheet', snap: 0.5, rows: 40 })}>
          Foaie lungă
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'sheet', snap: 'fit', rows: 3 })}>
          Foaie scurtă
        </Button>
        {/* A short sheet at the 50% snap with a footer: it hugs its content (owner 2026-10-11). */}
        <Button variant="secondary" onClick={() => setOpen({ kind: 'sheet', snap: 0.5, rows: 3, footer: true })}>
          Foaie mică
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'sheet', snap: 0.9, rows: 8, field: true })}>
          Foaie cu câmp
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'responsive' })}>
          Suprafață
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'modal', fullScreen: false })}>
          Filtre
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'modal', fullScreen: true })}>
          Căutare
        </Button>
      </div>
      {/* A page several screens tall: the sheet must never scroll it. */}
      {rows(120)}

      <Sheet
        open={open?.kind === 'sheet'}
        onClose={close}
        title="Foaie de probă"
        initialSnap={open?.kind === 'sheet' ? open.snap : 0.5}
        footer={
          open?.kind === 'sheet' && (open.field || open.footer) ? (
            <Button block onClick={close}>
              Salvează
            </Button>
          ) : undefined
        }
      >
        {open?.kind === 'sheet' && open.field ? <input aria-label="Notă" placeholder="Notă" className="my-2 h-11 w-full rounded-control border border-hairline px-3 t-body" /> : null}
        {open?.kind === 'sheet' ? rows(open.rows) : null}
      </Sheet>

      <ResponsiveSurface open={open?.kind === 'responsive'} onClose={close} intent="context" title="Suprafață de probă">
        {rows(30)}
      </ResponsiveSurface>

      <ModalSurface
        open={open?.kind === 'modal'}
        onClose={close}
        title={open?.kind === 'modal' && open.fullScreen ? 'Caută' : 'Filtre'}
        fullScreen={open?.kind === 'modal' && open.fullScreen}
        footer={
          <Button block onClick={close}>
            Arată rezultatele
          </Button>
        }
      >
        {rows(40)}
      </ModalSurface>
    </main>
  );
}
