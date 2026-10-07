'use client';

import type { MemberTabProps } from '../types';
import { TabStub } from '../TabStub';

/*
 * The member view's «Setari» tab — a stub until its batch ships it (lib/partide-pages
 * partidaSetari). The tab registry (../registry.ts) leaves an unshipped tab out (rule 4), so this
 * renders only under the frame's tests (the e2e fake's `allTabs`), never for a user.
 */
export default function SetariTab(props: MemberTabProps) {
  return <TabStub tab="Setari" {...props} />;
}
