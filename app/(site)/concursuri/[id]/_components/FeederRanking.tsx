'use client';

import { useEffect, useRef } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  feederLegCount,
  feederProvisionalStatus,
  feederTabCount,
  futureLegMessage,
  type FeederRoundsRanking,
  type FeederRoundStatus,
  type FeederTab,
} from '@/core/competitions';
import { RankingTabs, type RankingTab } from '@/components/ranking/RankingTabs';
import { IconButton } from '@/components/nav/IconButton';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { StatusPill } from '@/components/ui/StatusPill';

/*
 * Feeder on legs («manșe», FIPS): the desktop ranking card's band (FeederLegTabs: General | Manșa
 * 1…N and the «?»), fish FeederHelpSheet (FeederHelp) and the shared data shape. The tables
 * themselves are fish's at every width (FishFeeder.tsx; owner 2026-10-11).
 */

/** «50.530» → «50,530», «-» → «–»: the web's decimal comma and no-value dash (kit RankingTable). */
export const roNum = (s: string) => (s === '-' ? '–' : s.replace('.', ','));

export type FeederData = {
  rankings: FeederRoundsRanking[];
  roundsCount: number | null | undefined;
  currentRound: number | null | undefined;
  roundStatus: FeederRoundStatus;
};

/** fish `feederLegEmpty`: the open leg tab has nothing to show (Vezi full is then disabled). */
export function feederLegEmpty(d: FeederData, tab: FeederTab): boolean {
  return !!futureLegMessage(tab, d.currentRound, d.roundStatus, feederLegCount(d.rankings));
}

/** fish FeederLegTabs: General | Manșa 1 … Manșa N (the kit RankingTabs strip), and the «?» that explains the scoring. */
export function FeederLegTabs({
  data,
  value,
  onChange,
  onHelp,
}: {
  data: FeederData;
  value: FeederTab;
  onChange: (tab: FeederTab) => void;
  onHelp: () => void;
}) {
  const legs = feederTabCount(data.rankings, data.roundsCount);
  const options: RankingTab<string>[] = [
    { value: 'general', label: 'General' },
    ...Array.from({ length: legs }, (_, i) => ({
      value: String(i + 1),
      label: `Manșa ${i + 1}`,
    })),
  ];
  return (
    // The «?» sits right after the last leg tab (it explains them), never pushed to the far edge.
    // One segmented strip at every width (ROADMAP §4b.20), on the ranking card's band.
    <div className="flex min-w-0 items-center gap-2">
      <RankingTabs
        name="feeder-leg"
        label="Manșa clasamentului"
        options={options}
        value={String(value)}
        onChange={v => onChange(v === 'general' ? 'general' : Number(v))}
        className="shrink"
      />
      <IconButton aria-label="Cum se calculează clasamentul" title="Cum se calculează clasamentul" onClick={onHelp} className="shrink-0">
        <InformationCircleIcon aria-hidden />
      </IconButton>
    </div>
  );
}

/**
 * fish FeederHelpSheet «Cum se calculează» — reading help beside the table it explains: the kit
 * ResponsiveSurface `context` (a sheet on the phone, a dialog 768–1279, from 1280 the docked side
 * panel, so the table stays in view). Rendered where the panel docks (beside the ranking card).
 */
export function FeederHelp({
  open,
  onClose,
  competitionStatus,
  data,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  competitionStatus: string;
  data: FeederData;
  panelClassName?: string;
}) {
  const status = feederProvisionalStatus(competitionStatus, data.currentRound, data.roundStatus);
  // The docked panel is not modal (the kit SidePanel: no focus trap): opening moves focus into it
  // (its «Închide»), so Escape works at once; closing gives focus back to what opened it. The sheet
  // and the dialog do both themselves.
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const box = wrap.current;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box?.querySelector<HTMLElement>('aside button')?.focus();
    return () => {
      if (back?.isConnected && (document.activeElement === document.body || box?.contains(document.activeElement))) back.focus();
    };
  }, [open]);
  return (
    <div ref={wrap} className="contents">
      <ResponsiveSurface open={open} onClose={onClose} intent="context" title="Cum se calculează" panelClassName={panelClassName}>
        <div className="flex flex-col gap-4">
          {status ? (
            <p>
              <StatusPill tone="info">Clasament provizoriu · {status}</StatusPill>
            </p>
          ) : null}
          <dl className="flex flex-col gap-3">
            <Rule title="Puncte">
              În fiecare manșă primești ca puncte locul din sectorul în care ai pescuit: primul ia 1 punct, al doilea 2… La egalitate se dă
              media locurilor. Cine nu prinde nimic primește media locurilor rămase.
            </Rule>
            <Rule title="Stand">
              Sectorul și standul la care ai pescuit în manșa respectivă: A4 = sectorul A, standul 4. Înaintea fiecărei manșe se trage din
              nou la sorți.
            </Rule>
            <Rule title="General">
              Totalul adună punctele din toate manșele. Cel mai mic total câștigă; la egalitate decide cantitatea totală. Pe tab-ul fiecărei
              manșe vezi clasamentul ei, pe sectoare.
            </Rule>
          </dl>
        </div>
      </ResponsiveSurface>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: string | string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="t-body-strong text-ink">{title}</dt>
      <dd className="t-body text-ink-2">{children}</dd>
    </div>
  );
}
