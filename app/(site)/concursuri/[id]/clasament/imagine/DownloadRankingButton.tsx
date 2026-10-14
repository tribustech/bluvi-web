'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/*
 * «Descarcă imaginea»: the ranking image (parity competition-page.imagine-clasament) drawn in the
 * browser and saved — the same sheet, size and file name as png/route.tsx, in about a second where
 * the server's Satori drawing of a large sheet takes tens of seconds on a cold function. The drawing
 * code (renderRankingPng.tsx, React DOM + modern-screenshot) is loaded on the first click, never with
 * the page. If the browser cannot draw it, the server's PNG is downloaded instead, so the reader
 * still gets the file (slower). Nothing to draw (`onError('empty')`) has no fallback: the server
 * would answer the same.
 *
 *  - `id`: the competition's URL id (slug or documentId), as the routes take it;
 *  - `query`: the table the reader has (model.ts imageQueryString: «?sortare=loc&sector=B», '' for
 *    the default view) — the data and the fallback PNG honour it exactly as the PNG route does.
 */

export type DownloadRankingButtonProps = Omit<ButtonProps, 'children' | 'onClick' | 'onError'> & {
  id: string;
  query?: string;
  /** The idle label (default «Descarcă imaginea»); while drawing the button reads «Se generează…». */
  children?: ReactNode;
  /** After a failure (the fallback download has already started for `failed`), e.g. to raise the page toast. */
  onError?: (reason: 'empty' | 'failed') => void;
};

function save(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
}

export function DownloadRankingButton({ id, query = '', children = 'Descarcă imaginea', onError, disabled, ...button }: DownloadRankingButtonProps) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const download = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const { renderRankingPng, RankingImageError } = await import('./renderRankingPng');
      try {
        const { blob, fileName } = await renderRankingPng(routes.competitionRankingImageData(id, query));
        const url = URL.createObjectURL(blob);
        save(url, fileName);
        // The click has handed the blob to the download; release it once the browser has read it.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        if (e instanceof RankingImageError && e.reason === 'empty') {
          onError?.('empty');
          return;
        }
        throw e;
      }
    } catch (e) {
      console.error('[imagine-clasament] browser drawing failed', e);
      // The server's PNG (same query, same name from its content-disposition).
      save(routes.competitionRankingImageFile(id, query), '');
      onError?.('failed');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <Button {...button} disabled={disabled || busy} aria-busy={busy} onClick={download}>
      {busy ? 'Se generează…' : children}
    </Button>
  );
}
