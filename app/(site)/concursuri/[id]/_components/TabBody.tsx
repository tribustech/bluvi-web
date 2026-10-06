'use client';

import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { UserStatuteForCompetition } from '@/core/social';
import type { Transport } from '@/core/transport';
import { ExtraScalesTab } from './ExtraScalesTab';
import type { PageViewer } from './Follow';
import { InfoTab } from './InfoTab';
import { ParticipantsTab } from './ParticipantsTab';
import { RulesTab } from './RulesTab';
import type { CompetitionTab } from './tabs';

/** The body of a route tab other than Clasament (CompetitionScreen renders the ranking itself). */
export function TabBody({
  tab,
  t,
  competition,
  viewer,
  statute,
  signIn,
  appHref,
}: {
  tab: Exclude<CompetitionTab, 'clasament'>;
  t: Transport;
  competition: CompetitionWithMyStatus;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  signIn: string;
  appHref: string;
}) {
  switch (tab) {
    case 'informatii':
      return <InfoTab competition={competition} />;
    case 'participanti':
      return <ParticipantsTab t={t} competition={competition} viewer={viewer} statute={statute} signIn={signIn} appHref={appHref} />;
    case 'extraCantare':
      return <ExtraScalesTab t={t} competition={competition} />;
    case 'regulament':
      return <RulesTab competition={competition} />;
  }
}
