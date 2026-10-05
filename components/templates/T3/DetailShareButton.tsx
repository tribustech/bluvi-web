'use client';

import { useState } from 'react';
import { ShareIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { headerChipClass, type HeaderChipGround } from './DetailHeader';

/**
 * Share the current page: the system share sheet where there is one (phones), else the link is
 * copied and the button says so for a moment (and `onCopied` can raise the page toast).
 *  - `chip`: the phone header chip · `photo`: the chip over a photo · `button`: the header button
 *    from 768 — the kit secondary Button, its label shown from 1280 (768–1279 keeps the header's
 *    action cluster compact: the same button, icon only, still named «Distribuie»).
 *  - `ground` (chips): the fill for what the chip sits on, as DetailBackButton's — e.g. `page` over
 *    the no-photo placeholder, where the photo scrim would turn into a muddy grey block.
 */
export function DetailShareButton({
  title,
  text,
  label = 'Distribuie',
  look = 'chip',
  size,
  ground,
  onCopied,
  className,
}: {
  title: string;
  /** The share text (fish handleShare…): «Intră în Bluvi să vezi …». */
  text?: string;
  /** Accessible name (chips) or visible label (button). */
  label?: string;
  look?: 'chip' | 'photo' | 'button';
  /** Chip size (default the 48 / 40 icon button); the pinned mini row passes `size-11`. */
  size?: string;
  /** Chips: overrides the fill `look` implies (DetailHeader headerChipClass). */
  ground?: HeaderChipGround;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed, or the clipboard refused: nothing to report.
    }
  };

  if (look === 'button') {
    return (
      <Button variant="secondary" icon={<ShareIcon />} onClick={share} title={label} className={cn('max-xl:w-12 max-xl:px-0', className)}>
        <span aria-live="polite" className="max-xl:sr-only">
          {copied ? 'Link copiat' : label}
        </span>
      </Button>
    );
  }
  return (
    <button
      type="button"
      aria-label={copied ? 'Link copiat' : label}
      title={label}
      onClick={share}
      className={headerChipClass({ ground, onPhoto: look === 'photo', size, className })}
    >
      <ShareIcon aria-hidden />
    </button>
  );
}
