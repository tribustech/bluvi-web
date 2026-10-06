"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { COMPETITION_TABS, type CompetitionTab } from "./tabs";

/*
 * The competition page's own analytics (parity competition-page.shell.c18, .c21; b.analytics), with
 * fish's exact names and params, on the site's one channel (lib/analytics.ts; GA4 in M8). The
 * ranking image's events live with it (clasament/imagine/analytics.ts).
 */

/** fish ROUTES (common/utils/competitionRoutes.ts) — the `tab_id` fish logs. */
const FISH_TAB_ID: Record<CompetitionTab, string> = {
  clasament: "clasament",
  informatii: "informatii",
  participanti: "participanti",
  extraCantare: "extracantare",
  regulament: "regulament",
};

/** Marks a share control of this competition (the header's «Distribuie», the pinned mini row's chip). */
export const SHARE_MARK = "data-competition-share";
/** Marks the route tab strip (DetailTabs) whose links log competition_page_tab_pressed. */
export const TABS_MARK = "data-competition-tabs";

/**
 * fish logs competition_page_tab_pressed when the reader moves to another tab (onIndexChange) and
 * share_competition once the share sheet returns (handleShareCompetition). On the web the tabs are
 * links and the share button is the T3 kit's, so one capturing click listener reads both from the
 * marked elements: a press on another tab's link, a press on a share control.
 */
export function useCompetitionAnalytics(
  documentId: string,
  name: string | undefined,
  current: CompetitionTab,
) {
  useEffect(() => {
    // fish logs both only once the competition is loaded (its documentId / name).
    if (!name) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      const link = el.closest<HTMLAnchorElement>(`[${TABS_MARK}] a[href]`);
      if (link) {
        const path = new URL(link.href, window.location.href).pathname;
        const tab = COMPETITION_TABS.find(
          (t) => t.href(documentId) === path,
        )?.key;
        if (tab && tab !== current) {
          track("competition_page_tab_pressed", {
            competition_id: documentId,
            competition_name: name,
            tab_id: FISH_TAB_ID[tab],
          });
        }
        return;
      }
      if (el.closest(`[${SHARE_MARK}] button`)) {
        track("share_competition", {
          competition_id: documentId,
          competition_name: name,
        });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [documentId, name, current]);
}
