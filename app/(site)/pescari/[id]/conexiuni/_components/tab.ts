/** The connections page's two tabs (web URL values; fish: followers | following). */
export type ConnectionsTab = 'urmaritori' | 'urmareste';

/**
 * `?tab=` → the tab (account.connections c3): following when «urmareste» (or fish's «following», a
 * pasted app link), followers otherwise.
 */
export function parseConnectionsTab(value: string | null | undefined): ConnectionsTab {
  return value === 'urmareste' || value === 'following' ? 'urmareste' : 'urmaritori';
}
