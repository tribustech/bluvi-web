import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { SHELL_GUTTERS } from '@/components/nav/shell';
import { ListEmpty, ListHeader, ListSignInGate, ListSkeleton, ListTabs, LiveDot, pageToolClass, type ListTab } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { loadVariantData, type VariantData } from './data';
import { PhoneList, TABS, type TabKey } from './shared';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';
import { VariantA2 } from './a2/VariantA2';

/*
 * /dev/variants/competitions?v=a|b|c&tab=viitoare|live|rezultate|ale-mele — three desktop layouts
 * for the competition lists, on REAL local-CMS data (core/), for the owner to compare side by side.
 * The owner's complaint: cards of different heights in the current grid. Each variant fixes it a
 * different way (see the VariantA/B/C headers). Phone (<768) shows the fish-like list in all three.
 */

export const metadata: Metadata = { title: 'Variante · listă concursuri', robots: { index: false } };

type Variant = 'a' | 'a2' | 'b' | 'c';
type Search = { v?: string; tab?: string };
type Props = { searchParams: Promise<Search> };

const VARIANTS: Record<Variant, { name: string; blurb: string }> = {
  a: { name: 'A · Format pe tab', blurb: 'Live = carduri mari, Viitoare = agendă, Rezultate = podium, Ale mele = starea mea' },
  a2: { name: 'A2 · A, mai viu', blurb: 'Viitoare cu oameni, Live = hub cu momente cheie și cântăriri în direct, Rezultate = câștigătorul + extindere pe rând' },
  b: { name: 'B · Carduri uniforme', blurb: 'O singură anatomie de card, toate egale ca înălțime' },
  c: { name: 'C · Tabel', blurb: 'Fiecare tab e un tabel dens, cu antet fix' },
};

const TAB_LABEL: Record<TabKey, string> = { viitoare: 'Viitoare', live: 'Live', rezultate: 'Rezultate', 'ale-mele': 'Ale mele' };

const parseVariant = (v?: string): Variant => (v === 'a2' || v === 'b' || v === 'c' ? v : 'a');
const parseTab = (t?: string): TabKey => (TABS.includes(t as TabKey) ? (t as TabKey) : 'viitoare');
const hrefOf = (v: Variant, tab: TabKey) => `/dev/variants/competitions?v=${v}&tab=${tab}`;

export default function CompetitionVariantsPage({ searchParams }: Props) {
  return (
    <div className={cn(SHELL_GUTTERS, 'flex flex-col gap-6 pt-6 pb-16 xl:pt-8')}>
      <Suspense fallback={<ListSkeleton count={6} />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const v = parseVariant(sp.v);
  const tab = parseTab(sp.tab);
  const data = await loadVariantData();

  const counts: Record<TabKey, number | undefined> = {
    viitoare: data.upcoming.length,
    live: data.live.length,
    rezultate: data.counts?.completed,
    'ale-mele': data.signedIn ? data.mineReal : undefined,
  };
  const tabs: ListTab<TabKey>[] = TABS.map((k) => ({
    key: k,
    label: TAB_LABEL[k],
    href: hrefOf(v, k),
    count: counts[k],
    leading: k === 'live' && data.live.length ? <LiveDot /> : undefined,
  }));

  return (
    <>
      <ListHeader
        title="Concursuri"
        description={
          <span>
            Prototip <strong className="text-ink">{VARIANTS[v].name}</strong> — {VARIANTS[v].blurb}. Date reale din CMS-ul local.
          </span>
        }
        actions={
          <nav aria-label="Variante" className="flex gap-2">
            {(Object.keys(VARIANTS) as Variant[]).map((k) => (
              <Link key={k} href={hrefOf(k, tab)} aria-current={k === v ? 'page' : undefined} className={pageToolClass({ pressed: k === v, iconOnly: false })}>
                {k.toUpperCase()}
              </Link>
            ))}
          </nav>
        }
        below={<ListTabs label="Stare concursuri" tabs={tabs} active={tab} />}
      />
      <TabBody v={v} tab={tab} data={data} />
    </>
  );
}

function TabBody({ v, tab, data }: { v: Variant; tab: TabKey; data: VariantData }) {
  if (tab === 'ale-mele' && !data.signedIn) {
    return <ListSignInGate description="Concursurile la care te-ai înscris apar aici." href={routes.signIn(hrefOf(v, tab))} />;
  }
  const list = tab === 'viitoare' ? data.upcoming : tab === 'live' ? data.live : tab === 'rezultate' ? data.completed : data.mine;
  if (!list.length) return <ListEmpty title="Nimic aici încă" description="Nu există concursuri în această listă." />;
  const Variant = v === 'a' ? VariantA : v === 'a2' ? VariantA2 : v === 'b' ? VariantB : VariantC;
  return (
    <>
      {tab === 'ale-mele' && data.mine.some((r) => r.sample) ? (
        <p className="rounded-control bg-badge-yellow-bg px-4 py-3 t-body text-ink">
          Contul QA are {data.mineReal === 1 ? 'o singură înscriere' : `${data.mineReal} înscrieri`}. Rândurile marcate «Exemplu» sunt
          concursuri reale cu o stare de înscriere inventată, ca să se vadă toate stările (înscris, în așteptare, stand alocat, live).
        </p>
      ) : null}
      <PhoneList tab={tab} data={data} />
      <div className="hidden md:block">
        <Variant tab={tab} data={data} />
      </div>
    </>
  );
}
