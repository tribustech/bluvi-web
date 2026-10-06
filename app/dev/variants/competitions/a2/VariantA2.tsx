import type { VariantData } from '../data';
import type { TabKey } from '../shared';
import { VariantA } from '../VariantA';
import { Agenda } from './Agenda';
import { loadLive, loadResults, loadUpcoming } from './data';
import { LiveHub } from './LiveHub';
import { Results } from './Results';

/*
 * A2 — A, pushed further after the owner's 2026-10-06 notes:
 *  Viitoare  → A's agenda + participant faces, social proof, capacity bar, «Începe în …».
 *  Live      → a live hub: featured hero with a timing tower, momentum strip, key moments,
 *              recent weighings ticker, rich cards; auto-refresh every 45 s.
 *  Rezultate → compact rows with the winner only; hover micro-interactions; inline expand.
 *  Ale mele  → unchanged from A.
 * Each tab loads only its own extra reads (a2/data.ts).
 */

export async function VariantA2({ tab, data }: { tab: TabKey; data: VariantData }) {
  if (tab === 'live') return <LiveHub cards={data.live} live={await loadLive(data.live)} />;
  if (tab === 'viitoare') return <Agenda cards={data.upcoming} people={await loadUpcoming(data.upcoming)} />;
  if (tab === 'rezultate') return <Results cards={data.completed} details={await loadResults(data.completed)} />;
  return <VariantA tab={tab} data={data} />;
}
