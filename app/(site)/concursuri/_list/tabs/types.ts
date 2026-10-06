import type { ComponentType } from 'react';
import type { CompetitionCard, CompetitionCardStatus } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import type { PhotoRequest } from '../cards/parts';
import type { DesktopViewer } from '../desktop/data';

/*
 * The contract between the Concursuri page (../CompetitionsScreen: header, tabs as links, search,
 * filter bar, summary, load-more, dialogs, photo viewer) and each tab's own content. A tab module
 * fills two slots of its tab's page — nothing else on the page is the tab's:
 *
 *   Top   above the search row and filter bar, under the Viitoare bento (if shown): the tab's own
 *         blocks that are not «the list» (Live: «Cântăriri recente» + «Concursul tău» hero;
 *         Viitoare: «În lumina reflectoarelor»). Rendered while the list loads too (`loading`).
 *   Body  the list itself, inside the list region, under the summary («N concursuri»), above
 *         «Încarcă mai multe». Only rendered when the list has cards (empty / error / sign-in
 *         states and the load-more footer stay the page's).
 *   Skeleton  the Body's bones while the first page loads (also the server fallback's).
 *
 * Only for a status tab with scope «all» or «Urmărite» and no search / filters (results mode and
 * «Ale mele» keep the page's own poster grid / MineRows).
 */

export type TabViewProps = {
  status: CompetitionCardStatus;
  /** The tab's list as loaded so far (every page in), in the CMS's order. Empty while loading. */
  cards: CompetitionCard[];
  /** The first page has not answered yet (Top only; Body is never rendered then). */
  loading: boolean;
  /** «Urmărite» narrows the list to followed competitions. */
  scope: 'all' | 'followed';
  t: Transport;
  /** Who is signed in (the server's session read), or null. */
  viewer: DesktopViewer;
  /** Signed in, or a session the server could not read in time (per-user reads still work). */
  isAuthenticated: boolean;
  /** Opens the page's photo viewer (a card's poster). */
  onOpenPhoto: (photo: PhotoRequest) => void;
  /** The list region's heading id — name the Body's <ul> with it (aria-labelledby). */
  labelledBy: string;
  /** How many of the first posters should load eagerly (0 when something sits above the list). */
  priorityCount: number;
};

export type TabModule = {
  Top?: ComponentType<TabViewProps>;
  Body: ComponentType<TabViewProps>;
  Skeleton: ComponentType;
  /** The tab's own «nothing here» for scope «all» (else the page's empty card). */
  Empty?: ComponentType<TabViewProps>;
  /**
   * How many first posters load eagerly when the tab's Top is drawn: the tab knows how tall its Top
   * really is (it may render nothing). Without it, a tab with a Top gets 0, one without gets 2.
   */
  priorityCount?: (p: Omit<TabViewProps, 'priorityCount'>) => number;
};
