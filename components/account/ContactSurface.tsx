'use client';

import { useState } from 'react';
import { EnvelopeIcon, PhoneArrowUpRightIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';

/** fish common/utils/constants.ts TONI_PHONE / TONI_MAIL — Bluvi support, shown as fish writes them. */
export const SUPPORT_PHONE = '+40 733 017 091';
export const SUPPORT_MAIL = 'toni.radulescu@wearetribus.com';

/**
 * fish components/ContactSheet.tsx — the «Contact» panel: fish's copy word for word, a tel: link
 * (logs fish's `contact_pressed` «Bluvi support contact» on the site's analytics channel) and a
 * mailto: link. A decision surface: sheet on the phone, dialog from 768 (components/surfaces/rule).
 */
export function ContactSurface({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="decision" title="Contact">
      <p className="t-body text-muted">Ai nevoie de ajutor sau ai întrebări? Suntem aici pentru tine!</p>
      <ul className="mt-2 flex flex-col">
        <li>
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
            onClick={() => track('contact_pressed', { contact_type: 'Bluvi support contact' })}
            className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent-ink hover:bg-soft-fill"
          >
            <PhoneIcon aria-hidden className="size-6 shrink-0 text-ink" />
            {SUPPORT_PHONE}
          </a>
        </li>
        <li>
          <a href={`mailto:${SUPPORT_MAIL}`} className="-mx-2.5 flex items-center gap-2 rounded-control p-2.5 t-body text-accent-ink hover:bg-soft-fill">
            <EnvelopeIcon aria-hidden className="size-6 shrink-0 text-ink" />
            {SUPPORT_MAIL}
          </a>
        </li>
      </ul>
    </ResponsiveSurface>
  );
}

/**
 * fish components/Contact.tsx — the «Contactează-ne» card that opens ContactSurface. The same white
 * card for both of fish's variants: Acasă (signed out, «dashboard») and Setări («profile»).
 */
export function ContactCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-card bg-surface px-4.5 py-3 text-left text-ink shadow-e0 transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
          className,
        )}
      >
        <PhoneArrowUpRightIcon aria-hidden className="size-6 shrink-0" />
        <span className="t-body-strong">Contactează-ne</span>
      </button>
      <ContactSurface open={open} onClose={() => setOpen(false)} />
    </>
  );
}
