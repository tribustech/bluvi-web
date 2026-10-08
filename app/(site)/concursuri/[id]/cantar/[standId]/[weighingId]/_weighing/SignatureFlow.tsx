'use client';

import { useEffect, useRef, useState } from 'react';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import { Button } from '@/components/ui/Button';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

/*
 * c15 (fish SignatureSheet ×2, add.tsx:214-223): «Semnătură arbitru ✍🏻», then «Semnătură martor ✍🏻», each
 * on a fresh pad; «Mai departe» stays off until something is drawn. After the witness signs the
 * surface closes and the screen uploads both PNGs and closes the weighing (`onSigned`).
 * Phone: full screen with a ~400px pad (fish's full-width 400px sheet — room to sign with a finger);
 * from 768 a dialog. A stray backdrop click never drops a signature; X / Escape close it, dropping
 * both drawings: the next «Finalizează cântarul» starts over, as fish's sheets do.
 * «Mai departe» is off while the drawing is being encoded (`busy`): a double click must not hand the
 * screen two signature pairs (two closes, two pushes).
 */

type Step = 'referee' | 'witness';

const TITLE: Record<Step, string> = { referee: 'Semnătură arbitru', witness: 'Semnătură martor' };

export function SignatureFlow({
  open,
  onClose,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  onSigned: (signatures: { referee: Blob; witness: Blob }) => void;
}) {
  const [step, setStep] = useState<Step>('referee');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [referee, setReferee] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pad = useRef<SignaturePadHandle>(null);

  const setBusyBoth = (v: boolean) => {
    busyRef.current = v;
    setBusy(v);
  };

  // The guard lifts only once the new step is on screen (its fresh pad, «Mai departe» off): a click
  // landing before that commit must not read the previous pad.
  useEffect(() => {
    busyRef.current = false;
  }, [step]);

  const close = () => {
    setStep('referee');
    setHasDrawing(false);
    setReferee(null);
    setBusyBoth(false);
    onClose();
  };

  const next = async () => {
    if (busyRef.current) return;
    setBusyBoth(true);
    const blob = await pad.current?.toBlob();
    if (!blob) {
      setBusyBoth(false);
      return;
    }
    if (step === 'referee') {
      setReferee(blob);
      setHasDrawing(false);
      setStep('witness');
      setBusy(false);
      return;
    }
    if (!referee) {
      setBusyBoth(false);
      return;
    }
    const signatures = { referee, witness: blob };
    setStep('referee');
    setHasDrawing(false);
    setReferee(null);
    setBusy(false);
    onSigned(signatures);
  };

  return (
    <ModalSurface
      open={open}
      onClose={close}
      title={`${TITLE[step]} ✍🏻`}
      fullScreen
      backdropDismiss={false}
      bodyClassName="flex flex-col gap-3 py-4"
      footer={
        <Button onClick={() => void next()} disabled={!hasDrawing || busy} aria-busy={busy || undefined} block data-testid="signature-next">
          Mai departe
        </Button>
      }
    >
      <p className="t-caption text-muted">{step === 'referee' ? 'Pasul 1 din 2' : 'Pasul 2 din 2'}</p>
      {/* A new pad per step (key): the witness never signs over the referee's strokes. */}
      {open ? <SignaturePad key={step} ref={pad} label={TITLE[step]} onChange={setHasDrawing} /> : null}
    </ModalSurface>
  );
}
