import type { CompetitionCardStatus } from '@/core/competitions';
import { liveTab } from './LiveTab';
import { resultsTab } from './ResultsTab';
import type { TabModule } from './types';
import { upcomingTab } from './UpcomingTab';

/** Each status tab's content module (contract: ./types.ts). */
export const TAB_MODULES: Record<CompetitionCardStatus, TabModule> = {
  notStarted: upcomingTab,
  started: liveTab,
  completed: resultsTab,
};

export type { TabModule, TabViewProps } from './types';
