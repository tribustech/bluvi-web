'use client';

import type { ReactNode } from 'react';
import { ListHeader } from '@/components/templates/T1/ListHeader';
import { useBack } from '@/components/nav/useBack';

export type OperatorBack = {
  /**
   * Where Back goes when the previous page is not this site's (a shared link, a notification, a new
   * tab): Acasă («/») for the picker; for a lake's panel `panelBack(ownedLakes.length)` (./back.ts) —
   * the picker /operator only when the viewer owns more than one lake, else Acasă (a single-lake
   * operator's /operator replaces itself with the panel again: Back would loop); the parent page for
   * the screens under a panel (the panel itself, routes.operator(lakeId), for the inbox, blocks…).
   */
  fallbackHref: string;
  label?: string;
};

/**
 * The header of every operator page (fish: BackButton + heading1 title, operator/index.tsx:40-45):
 * the back square — history back when the previous page is the site's own (components/nav/useBack),
 * else `back.fallbackHref` — the h1 (`title`; pass a skeleton node while it is unknown, rule 4),
 * an optional caption line under it and a trailing slot on the right (refresh, a primary action).
 * The T1 ListHeader on the page ground, the back square shown at every width.
 */
export function OperatorHeader({
  title,
  titleId,
  caption,
  trailing,
  back,
  below,
}: {
  title: ReactNode;
  titleId?: string;
  caption?: ReactNode;
  trailing?: ReactNode;
  back: OperatorBack;
  /** A row that belongs to the header (tabs). */
  below?: ReactNode;
}) {
  const goBack = useBack(back.fallbackHref);
  return (
    <ListHeader
      title={title}
      titleId={titleId}
      description={caption}
      actions={trailing}
      below={below}
      back={{ label: back.label ?? 'Înapoi', onClick: goBack }}
    />
  );
}
