'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';

/*
 * The lake page's two small link shapes, shared by the server sections and the client Partide one.
 * TODO(kit): lift both into T3 (a DetailSection `actionHref` and a `useDetailSections().go`), so the
 * public-water page uses the same ones.
 */

/** One section-header action for every section (Partide, Concursuri, Recenzii): label + chevron, a
 * 44px hit area that does not grow the header (-my-3). Nothing at all while the target page is not
 * on the web yet (`href` undefined): the section is complete without it, and a greyed «în curând»
 * repeated down the page is noise in the header's prime spot. */
export function SectionAction({ href, children }: { href: string | undefined; children: ReactNode }) {
  if (!href) return null;
  return (
    <Link href={href} className="-my-3 inline-flex min-h-11 items-center gap-0.5 rounded-badge px-1 t-button-compact text-accent-ink hover:underline">
      {children}
      <ChevronRightIcon aria-hidden className="size-4" />
    </Link>
  );
}

/**
 * An in-page jump (`#preturi`, `#recenzii`, `#contact`) that behaves like a section chip (lakes.detail
 * c11): it hands the click to the matching chip, whose handler marks the chip active at once, locks
 * the scroll spy, scrolls smoothly under the pinned rows and moves focus to the section. Without a
 * chip for that section (or a modified click) it stays a plain fragment link, which the browser
 * scrolls and focuses itself.
 */
export function onSectionJump(e: MouseEvent<HTMLElement>, id: string) {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  // TODO(kit): call DetailSectionsProvider's go(id) directly once T3 exports it.
  const chip = document.querySelector<HTMLAnchorElement>(`[data-t3="chips"] a[data-section="${CSS.escape(id)}"]`);
  if (!chip) return;
  e.preventDefault();
  chip.click();
}

export function JumpLink({
  to,
  className,
  children,
  ...rest
}: {
  to: string;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={`#${to}`}
      aria-label={rest['aria-label']}
      className={cn(className)}
      onClick={e => {
        rest.onClick?.();
        onSectionJump(e, to);
      }}
    >
      {children}
    </a>
  );
}
