import type { ComponentType } from 'react';
import type { PartidaTabKey } from '@/core/partide';
import { PARTIDE_PAGES_ON_WEB, type PartidePage } from '@/lib/partide-pages';
import GalerieTab from './Galerie';
import JurnalTab from './Jurnal';
import LanseteTab from './Lansete';
import SetariTab from './Setari';
import StatisticiTab from './Statistici';
import type { MemberTabProps } from './types';

/*
 * The member view's tabs (parity partide.partida.c4; fish app/(app)/partide/[id].tsx TAB_TITLE):
 * fish's key, the web's `?tab=` slug, the title, the body and the lib/partide-pages switch that
 * ships it. A tab whose switch is off is LEFT OUT (rule 4: no «curând» tab on someone's own
 * partidă) — each tab batch flips its switch in its commit.
 */
export type MemberTab = {
  key: PartidaTabKey;
  slug: string;
  title: string;
  Body: ComponentType<MemberTabProps>;
  page: PartidePage;
};

export const MEMBER_TABS: Record<PartidaTabKey, MemberTab> = {
  crono: { key: 'crono', slug: 'lansete', title: 'Lansete', Body: LanseteTab, page: 'partidaLansete' },
  jurnal: { key: 'jurnal', slug: 'jurnal', title: 'Jurnal', Body: JurnalTab, page: 'partidaJurnal' },
  galerie: { key: 'galerie', slug: 'galerie', title: 'Galerie', Body: GalerieTab, page: 'partidaGalerie' },
  stats: { key: 'stats', slug: 'statistici', title: 'Statistici', Body: StatisticiTab, page: 'partidaStatistici' },
  info: { key: 'info', slug: 'setari', title: 'Setări', Body: SetariTab, page: 'partidaSetari' },
};

/** The key a `?tab=` slug names, or null. */
export function tabKeyOfSlug(slug: string | null | undefined): PartidaTabKey | null {
  if (!slug) return null;
  return (Object.values(MEMBER_TABS).find(t => t.slug === slug)?.key as PartidaTabKey | undefined) ?? null;
}

/** Whether a tab is on the web (its batch shipped), or every tab under the frame's tests. */
export function tabShipped(key: PartidaTabKey, allTabs: boolean): boolean {
  return allTabs || PARTIDE_PAGES_ON_WEB[MEMBER_TABS[key].page];
}
