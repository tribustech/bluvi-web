import type { ReactNode } from 'react';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { SHELL_GUTTERS } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { OperatorHeader, type OperatorBack } from './OperatorHeader';

/** «Administrare lacuri» — the area's root title (operator.alege-balta.c1). */
export const OPERATOR_PICKER_TITLE = 'Administrare lacuri';

/**
 * The breadcrumb band (from 768) of an operator page: «Acasă / Administrare / …». «Administrare» is
 * the top bar's menu, not a page; pass the rest (e.g. [{ label: lakeName, href: routes.operator(id) },
 * { label: 'Rezervări' }]).
 */
export function operatorTrail(...rest: Crumb[]): Crumb[] {
  return [{ label: 'Acasă', href: routes.home() }, { label: 'Administrare' }, ...rest];
}

/**
 * The page frame of every M7 operator screen: the shell gutters, OperatorHeader (back, h1, caption,
 * trailing slot) and the body under it at the T1 rhythm (16 / 20 / 24). Safe in server and client
 * components. Its loading.tsx / error.tsx should draw the same frame (same title, same back), so
 * nothing at the top moves when the screen lands.
 *
 *   // A lake's panel: Back falls back to the picker only for a multi-lake owner (./back.ts).
 *   <OperatorFrame title={name ?? <TitleSkeleton/>} caption="Azi, sâmbătă 4 oct."
 *     back={panelBack(owned.data?.length)} trail={operatorTrail({ label: name })}
 *     trailing={<Refresh/>}>
 *     …
 *   </OperatorFrame>
 *   // A screen under the panel (inbox, blocks, calendar…): its parent, the panel.
 *   <OperatorFrame title="Rezervări" back={{ fallbackHref: routes.operator(lakeId) }} …>
 */
export function OperatorFrame({
  title,
  titleId,
  caption,
  trailing,
  back,
  trail,
  below,
  busy,
  className,
  children,
}: {
  title: ReactNode;
  titleId?: string;
  caption?: ReactNode;
  trailing?: ReactNode;
  back: OperatorBack;
  /** The breadcrumb band; omitted: «Acasă / Administrare / <title>» when the title is a string. */
  trail?: Crumb[];
  below?: ReactNode;
  /** A refetch the user asked for is replacing the body (aria-busy on the body only). */
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const crumbs = trail ?? (typeof title === 'string' ? operatorTrail({ label: title }) : null);
  return (
    <div className={cn(SHELL_GUTTERS, 'pt-4 pb-10 md:pt-6 xl:pt-8 xl:pb-16', className)}>
      {crumbs ? <SetBreadcrumb trail={crumbs} /> : null}
      <OperatorHeader title={title} titleId={titleId} caption={caption} trailing={trailing} back={back} below={below} />
      <div aria-busy={busy || undefined} className="mt-4 flex min-w-0 flex-col gap-4 md:mt-5 xl:mt-6">
        {children}
      </div>
    </div>
  );
}

/** A title placeholder for OperatorFrame while the name is unknown (rule 4). */
export function OperatorTitleSkeleton({ className }: { className?: string }) {
  return (
    <>
      <span className="sr-only">Se încarcă…</span>
      <span aria-hidden className={cn('inline-block h-6 w-48 max-w-full animate-shimmer rounded-full align-middle', className)} />
    </>
  );
}
