'use client';

import type { MemberTabProps } from '../types';
import { TabStub } from '../TabStub';

/*
 * The member view's «Galerie» tab — a stub until its batch ships it (lib/partide-pages
 * partidaGalerie). The tab registry (../registry.ts) leaves an unshipped tab out (rule 4), so this
 * renders only under the frame's tests (the e2e fake's `allTabs`), never for a user.
 */
export default function GalerieTab(props: MemberTabProps) {
  return <TabStub tab="Galerie" {...props} />;
}
