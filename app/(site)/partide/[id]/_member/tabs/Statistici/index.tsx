'use client';

import type { MemberTabProps } from '../types';
import { TabStub } from '../TabStub';

/*
 * The member view's «Statistici» tab — a stub until its batch ships it (lib/partide-pages
 * partidaStatistici). The tab registry (../registry.ts) leaves an unshipped tab out (rule 4), so this
 * renders only under the frame's tests (the e2e fake's `allTabs`), never for a user.
 */
export default function StatisticiTab(props: MemberTabProps) {
  return <TabStub tab="Statistici" {...props} />;
}
