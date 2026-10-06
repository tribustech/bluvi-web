'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ListHeader } from '@/components/templates/T1';
import { routes } from '@/lib/routes';

/*
 * A subpage's ListHeader while the route loads (loading.tsx knows no params): the back square is
 * ALWAYS there — to the lake once its id is in the URL — so the title never shifts right by the
 * square's width when the page lands. A title that is not known yet is a shimmer, never a
 * placeholder word that the real one then replaces.
 */
export function FallbackHeader({ title, description, below }: { title: ReactNode; description?: ReactNode; below?: ReactNode }) {
  const params = useParams<{ id?: string }>();
  const href = params?.id ? routes.lake(params.id) : routes.lakes();
  return <ListHeader title={title} description={description} back={{ label: 'Înapoi', href }} below={below} />;
}

/** The lake's name while it is read: a title-line shimmer (the heading keeps an accessible name). */
export function TitleShimmer({ srLabel }: { srLabel: string }) {
  return (
    <>
      <span className="sr-only">{srLabel}</span>
      <span aria-hidden className="inline-block h-6 w-48 max-w-full animate-shimmer rounded-full align-middle" />
    </>
  );
}
