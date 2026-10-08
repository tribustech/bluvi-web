'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

/*
 * c17 (fish DisplaySignaturesSheet): «Semnătură arbitru» and «Semnătură martor», each image shown only
 * when the CMS has it, then «Închide». fish uploads its signatures as SVG — a black stroke on a
 * TRANSPARENT background (under a .png name); the web's are black on white. Both need a literal white
 * plate (`bg-signature-paper`, #fff in both themes, never `bg-surface`): on the dark surface a black stroke would vanish.
 */
export function SignaturesDialog({
  open,
  onClose,
  referee,
  witness,
}: {
  open: boolean;
  onClose: () => void;
  referee: { url: string } | null;
  witness: { url: string } | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Semnături"
      titleHidden
      scrollBody
      actions={
        <Button onClick={onClose} block>
          Închide
        </Button>
      }
    >
      <div className="flex flex-col gap-5 md:flex-row md:gap-4">
        {referee ? <Signature title="Semnătură arbitru" url={referee.url} /> : null}
        {witness ? <Signature title="Semnătură martor" url={witness.url} /> : null}
        {!referee && !witness ? <p className="t-body text-muted">Cântarul nu are semnături salvate.</p> : null}
      </div>
    </Dialog>
  );
}

function Signature({ title, url }: { title: string; url: string }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <figcaption className="t-title2 text-center text-ink">{title}</figcaption>
      {/* A remote S3 PNG or SVG at its own small size: the image optimizer buys nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} className="aspect-square w-full max-w-50 rounded-control border border-hairline bg-signature-paper object-contain" />
    </figure>
  );
}
