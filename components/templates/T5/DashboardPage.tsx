import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { SHELL_GUTTERS } from '@/components/nav/shell';

export interface DashboardPageProps {
  /** <DashboardHeader>: the page's h1. */
  header: ReactNode;
  /** Optional row under the header (filters, a period switch): <DashboardToolbar>. */
  toolbar?: ReactNode;
  /** <DashboardLayout>, or a state (<DashboardError>, <DashboardEmpty>, …). */
  children: ReactNode;
  /**
   * A refetch the user asked for is replacing the body while the old data stays on screen. Set on
   * the body only — never on the header, which holds the focused refresh control and its live
   * status (an aria-busy subtree holds back its announcements) — and never for a silent
   * background refetch (window focus, the day turning), which must not make the page busy.
   */
  busy?: boolean;
  className?: string;
}

/**
 * T5 «Dashboard» — the page frame: header, optional toolbar, then the body. Owns the gutters —
 * the shell's own 16 / 24 / 32 (SHELL_GUTTERS), so the page shares the logo's left edge — and the vertical rhythm between the page's blocks (16 on a phone as in fish
 * SECTION_GAP, 20 from 768, 24 from 1280). Lives inside the shell's <main>; never a landmark itself.
 */
/** The page's vertical rhythm (fish SECTION_GAP 16, 20 from 768, 24 from 1280). */
const GAP = 'flex flex-col gap-4 md:gap-5 xl:gap-6';

export function DashboardPage({ header, toolbar, children, busy, className }: DashboardPageProps) {
  return (
    <div className={cn(GAP, 'pb-8 md:pb-10 xl:pb-14', SHELL_GUTTERS, className)}>
      {header}
      {toolbar}
      {/* Always this wrapper (busy or not), so a refetch never remounts the body. */}
      <div aria-busy={busy || undefined} className={cn(GAP, 'min-w-0')}>
        {children}
      </div>
    </div>
  );
}
