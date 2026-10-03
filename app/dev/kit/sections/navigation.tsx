'use client';

import { useState, type ReactNode } from 'react';
import { DesktopHeader } from '@/components/nav/DesktopHeader';
import { Rail } from '@/components/nav/Rail';
import { SideNav } from '@/components/nav/SideNav';
import { TabBar } from '@/components/nav/TabBar';
import type { AdminLink } from '@/components/nav/items';
import { Dialog } from '@/components/surfaces/Dialog';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Sheet } from '@/components/surfaces/Sheet';
import { SidePanel } from '@/components/surfaces/SidePanel';
import { pickSurface, type Breakpoint, type SurfaceIntent } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { EmptyState, ErrorState, LoadingRow } from '@/components/surfaces/StateCard';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { MoneyInput, TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/Button';

/** /dev/kit section: navigation, temporary surfaces and forms (Fundații §07). */

const ADMIN: AdminLink[] = [
  { key: 'concursurile-mele', label: 'Concursurile mele', href: '/organizator/concursuri' },
  { key: 'lac-cornu', label: 'Lacul Cornu · panou', href: '/operator/lacul-cornu' },
];

const STANDS = [
  { stand: 'A7', name: 'Radu Ionescu', kg: '86,4' },
  { stand: 'B22', name: 'Tu · Mihai Popa', kg: '71,9' },
  { stand: 'C31', name: 'Vlad Stan', kg: 'capot' },
];

function Caption({ children }: { children: ReactNode }) {
  return <p className="t-caption max-w-[60ch] text-pretty text-muted">{children}</p>;
}

function Title({ children }: { children: ReactNode }) {
  return <h3 className="t-body-strong text-ink-2">{children}</h3>;
}

function StandDetails() {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {[
        ['Pescar', 'Radu Ionescu'],
        ['Sector', 'A'],
        ['Cantitate', '86,4 kg'],
        ['Capturi', '9'],
        ['CMMC', '14,2 kg'],
        ['Loc sector', '1'],
      ].map(([k, v]) => (
        <div key={k} className="rounded-control bg-soft-fill px-3 py-2">
          <dt className="t-caption text-muted">{k}</dt>
          <dd className="t-body-strong tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NavigationSection() {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [ruled, setRuled] = useState<SurfaceIntent | null>(null);
  const [panel, setPanel] = useState(true);
  const [tip, setTip] = useState<'individual' | 'echipe'>('individual');
  const bp = useBreakpoint();

  return (
    <>
      <h2 className="t-title1">Navigare</h2>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-2.5">
          <Title>Tab bar · mobil (&lt;768) · raze sus 16</Title>
          <div className="w-full max-w-[380px] overflow-hidden rounded-card bg-page pt-5">
            <TabBar active="concursuri" signedIn />
          </div>
          <div className="w-full max-w-[380px] overflow-hidden rounded-card bg-page pt-5">
            <TabBar active="acasa" signedIn={false} />
          </div>
          <Caption>Ordinea și etichetele din (tabs)/_layout.tsx. Profil apare doar logat; nelogat devine „Intră”.</Caption>
        </div>

        <div className="flex flex-col gap-2.5">
          <Title>Meniu lateral · desktop (≥1280, 248px) · rail 72px la 768–1279</Title>
          <div className="flex items-start gap-4">
            <SideNav active="concursuri" signedIn admin={ADMIN} className="h-[460px] rounded-card" />
            <Rail active="concursuri" signedIn className="h-[460px] rounded-card" />
          </div>
          <Caption>Rail: eticheta apare ca tooltip la hover și la focus din tastatură.</Caption>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Title>Header desktop</Title>
        <div className="overflow-x-auto pb-1">
          <DesktopHeader
            breadcrumb={[{ label: 'Competiții', href: '/concursuri' }, { label: 'Cupa Toamnei la Crap' }]}
            user={{ name: 'Mihai Popa' }}
            hasUnread
            className="min-w-[760px] rounded-card"
          />
        </div>
        <Caption>
          Header desktop: breadcrumb (SEO + orientare), căutare globală ⌘K, notificări, avatar. Pe mobil headerul e cel
          din ecran (BackButton translucid peste foto, VenuePinnedNav la scroll).
        </Caption>
      </div>

      <h2 className="t-title1 pt-4">Suprafețe temporare</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Sheet · mobil
        </Button>
        <Button variant="secondary" onClick={() => setDialog(true)}>
          Dialog
        </Button>
        <Button variant="outline" onClick={() => setRuled('context')}>
          După regulă · stand
        </Button>
        <Button variant="outline" onClick={() => setRuled('decision')}>
          După regulă · penalizare
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <Title>Panou lateral · 420px · lista rămâne vizibilă</Title>
        <div className="flex h-[360px] overflow-x-auto overflow-y-hidden rounded-card bg-surface shadow-e0">
          <ul className="min-w-[240px] flex-1 divide-y divide-hairline">
            {STANDS.map((s) => (
              <li key={s.stand}>
                <button
                  type="button"
                  onClick={() => setPanel(true)}
                  className={`t-body flex h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-soft-fill ${
                    s.stand === 'A7' && panel ? 'bg-accent-tint' : ''
                  }`}
                >
                  <span className="t-body-strong w-10">{s.stand}</span>
                  <span className="t-body-strong flex-1 truncate">{s.name}</span>
                  <span className="t-body-strong tabular-nums">{s.kg}</span>
                </button>
              </li>
            ))}
          </ul>
          {panel ? (
            <SidePanel
              title="Stand A7"
              subtitle="Sector A · Cupa Toamnei la Crap"
              onClose={() => setPanel(false)}
              footer={<Button block>Adaugă cântărire</Button>}
              className="shrink-0"
            >
              <StandDetails />
            </SidePanel>
          ) : null}
        </div>
        <Caption>
          Regula: ce e sheet pe mobil devine panou lateral dacă utilizatorul trebuie să vadă lista din spate (stand,
          pescar, cântărire) și dialog dacă e o decizie (anulare, penalizare).
        </Caption>
        <table className="t-caption w-full max-w-[520px] text-left">
          <caption className="sr-only">Ce suprafață se deschide, pe lățimi</caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-bold">Lățime</th>
              <th className="py-1 font-bold">Context (stand)</th>
              <th className="py-1 font-bold">Decizie (penalizare)</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {(['mobile', 'tablet', 'desktop'] as Breakpoint[]).map((b) => (
              <tr key={b} className={b === bp ? 'font-bold text-accent-ink' : ''}>
                <td className="py-1">{{ mobile: '<768', tablet: '768–1279', desktop: '≥1280' }[b]}</td>
                <td className="py-1">{pickSurface('context', b)}</td>
                <td className="py-1">{pickSurface('decision', b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="t-title1 pt-4">Formulare</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
          <TextInput label="Numele concursului" defaultValue="Cupa Toamnei la Crap" autoFocus />
          <MoneyInput label="Taxă de participare" defaultValue="350" />
          <SegmentedControl
            label="Tip"
            name="tip"
            value={tip}
            onChange={setTip}
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'echipe', label: 'Echipe' },
            ]}
          />
          <TextInput
            label="Număr de sectoare"
            inputMode="numeric"
            defaultValue="26"
            error="Maximum 24 de sectoare (A–X)."
          />
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
          <TextInput label="Numele concursului" placeholder="ex. Cupa Toamnei la Crap" helper="Apare în listă și în notificări." />
          <Select
            label="Specia țintă"
            placeholder="Alege specia"
            defaultValue=""
            options={[
              { value: 'crap', label: 'Crap' },
              { value: 'amur', label: 'Amur' },
              { value: 'caras', label: 'Caras' },
            ]}
          />
          <MoneyInput label="Taxă de participare" defaultValue="350" disabled helper="Taxa nu se mai poate schimba după prima înscriere." />
        </div>
      </div>

      <h2 className="t-title1 pt-4">Gol · se încarcă · eroare</h2>
      <div className="flex max-w-[400px] flex-col gap-2.5">
        <EmptyState
          title="Momentan nu este niciun concurs live."
          description="Urmărește un concurs viitor ca să afli când începe."
        />
        <LoadingRow />
        <ErrorState
          title="Nu am putut încărca clasamentul."
          description="Ultima versiune: acum 3 min"
          action={
            <Button variant="secondary" size="compact">
              Reîncearcă
            </Button>
          }
        />
        <Caption>Fotografiile se încarcă cu blurhash (din DTO), nu cu skeleton colorat. Skeleton gri doar pentru text.</Caption>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Stand A7"
        subtitle="glisare, snap 50/90%"
        footer={<Button block>Adaugă cântărire</Button>}
      >
        <StandDetails />
      </Sheet>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        alert
        title="Aplici penalizarea?"
        description="Penalizarea se aplică standului B22 și apare în istoricul concursului."
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Renunță
            </Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Aplică penalizarea
            </Button>
          </>
        }
      />
      <ResponsiveSurface
        open={ruled !== null}
        onClose={() => setRuled(null)}
        intent={ruled ?? 'context'}
        title={ruled === 'decision' ? 'Aplici penalizarea?' : 'Stand A7'}
        subtitle={ruled === 'decision' ? 'Standul B22 · Sector B' : 'Sector A · Cupa Toamnei la Crap'}
        panelClassName="fixed top-0 right-0 z-40 h-dvh"
        actions={
          <Button block={ruled !== 'decision'} onClick={() => setRuled(null)}>
            {ruled === 'decision' ? 'Aplică penalizarea' : 'Adaugă cântărire'}
          </Button>
        }
      >
        {ruled === 'decision' ? null : <StandDetails />}
      </ResponsiveSurface>
    </>
  );
}
