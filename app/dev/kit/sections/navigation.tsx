'use client';

import { useState, type ComponentProps, type ReactNode } from 'react';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { CommandPalette } from '@/components/nav/CommandPalette';
import { IconButton } from '@/components/nav/IconButton';
import { adminLinks, type AdminLink } from '@/components/nav/items';
import { MobileMenu } from '@/components/nav/MobileMenu';
import { TopBar, useSearchShortcut } from '@/components/nav/TopBar';
import { ToastProvider, useSiteToast } from '@/app/(site)/_shell/Toast';
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
import { Bars3Icon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

/** /dev/kit section: navigation, temporary surfaces and forms (Fundații §07). */

const ADMIN: AdminLink[] = [
  ...adminLinks({
    isOrganizer: true,
    ownedLakes: [
      { documentId: 'lacul-cornu', name: 'Lacul Cornu' },
      { documentId: 'lacul-sarat', name: 'Complex Piscicol Lacul Sărat Brăila' },
    ],
  }),
];

const STANDS = [
  { stand: 'A7', name: 'Radu Ionescu', kg: '86,4' },
  { stand: 'B22', name: 'Tu · Mihai Popa', kg: '71,9' },
  { stand: 'C31', name: 'Vlad Stan', kg: '–' },
];

function Caption({ children }: { children: ReactNode }) {
  return <p className="t-caption max-w-prose text-pretty text-muted">{children}</p>;
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

/**
 * TopBar switches by viewport width; the kit forces each layout (`layout`) so every state of the bar
 * shows in any column. Framed with a hairline ring all round (the bar's own bottom border would stop
 * at the rounded corners).
 */
function Frame({ children, menuRoom = false }: { children: ReactNode; menuRoom?: boolean }) {
  return (
    <div
      className={
        menuRoom
          ? 'pb-56 [&>header]:rounded-card [&>header]:border-b-0 [&>header]:shadow-e0'
          : '[&>header]:rounded-card [&>header]:border-b-0 [&>header]:shadow-e0'
      }
    >
      {children}
    </div>
  );
}

type BarDemo = Pick<
  ComponentProps<typeof TopBar>,
  'viewer' | 'hasUnread' | 'onMenu' | 'onSearch' | 'openMenu' | 'active' | 'retrying'
>;

function ToastDemo() {
  const toast = useSiteToast();
  return (
    <div className="flex flex-col gap-2.5">
      <Title>Mesaj scurt (toast)</Title>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => toast('Te-ai înscris la Cupa Toamnei la Crap.')}>
          Neutru
        </Button>
        <Button variant="secondary" onClick={() => toast('Cântărirea a fost salvată.', 'success')}>
          Succes
        </Button>
        <Button variant="secondary" onClick={() => toast('Nu am putut închide sesiunea. Încearcă din nou.', 'danger')}>
          Eroare
        </Button>
      </div>
      <Caption>
        O singură gazdă pe pagină, sus, sub bară. Dispare după 3 secunde, eroarea după 8 (oprit cât timp e sub cursor
        sau are focusul). Eroarea e pe suprafața de pericol, are buton „Închide” de 40px și e anunțată imediat
        (role=alert); celelalte, politicos.
      </Caption>
    </div>
  );
}

function PhoneBar(props: BarDemo) {
  return (
    <Frame>
      <TopBar {...props} layout="phone" admin={ADMIN} />
    </Frame>
  );
}

const SIGNED_IN = { status: 'in', name: 'Mihai Popa' } as const;
const SIGNED_OUT = { status: 'out', signInHref: '/intra' } as const;

export function NavigationSection() {
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [ruled, setRuled] = useState<SurfaceIntent | null>(null);
  const [panel, setPanel] = useState(true);
  const [tip, setTip] = useState<'individual' | 'echipe'>('individual');
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const bp = useBreakpoint();
  const shortcut = useSearchShortcut();
  const openPalette = () => setPalette(true);

  return (
    <>
      <h2 className="t-title1">Navigare</h2>

      <div className="flex flex-col gap-2.5">
        <Title>Bara de sus · desktop (≥1280)</Title>
        <p className="t-caption text-muted xl:hidden">Exemplele de desktop au nevoie de cel puțin 1040px, așa că se văd de la 1280px în sus.</p>
        <div className="hidden flex-col gap-3 xl:flex">
          <Frame>
            <TopBar layout="desktop" viewer={SIGNED_IN} active="concursuri" admin={ADMIN} hasUnread onSearch={openPalette} />
          </Frame>
          <Frame>
            <TopBar layout="desktop" viewer={SIGNED_OUT} active="acasa" onSearch={openPalette} />
          </Frame>
          <Frame menuRoom>
            <TopBar layout="desktop" viewer={SIGNED_IN} active="organizator" admin={ADMIN} openMenu="admin" onSearch={openPalette} />
          </Frame>
          <Frame menuRoom>
            <TopBar layout="desktop" viewer={SIGNED_IN} active="concursuri" admin={ADMIN} openMenu="account" onSearch={openPalette} onSignOut={() => {}} />
          </Frame>
        </div>
        <Caption>
          Logat (organizator + operator, notificări noi) · nelogat. Logo, Acasă · Bălți · Competiții · Partide (activ:
          text accent și o linie accent de 2px lipită de marginea de jos a barei, ca să nu semene cu hover-ul
          soft-fill; aria-current=page doar pe pagina secțiunii, =true sub ea), meniul Administrare doar pentru
          organizatori și operatori (ultimul element din aceeași listă, deci aceeași distanță), căutare ⌘K cu
          aspectul câmpurilor din kit (soft-fill, la focus suprafață albă cu bordură accent), notificări, meniul
          contului (avatar, nume și rol deasupra listei, apoi Profil, Setări, linie, Ieși din cont). Nelogat, „Intră”
          e butonul cu contur din kit, la 12px de câmpul de căutare. Lipită sus, 64px cu linia fină inclusă; după
          ce pagina începe să se deruleze, bara capătă umbra e1. Bara e pe toată lățimea, conținutul ei stă în
          aceeași coloană ca pagina (lată până la 1680px de conținut, centrată peste). Dedesubt: meniurile
          Administrare (pagina curentă e în meniu: rândul are fundal accent-tint; o baltă e numită întâi, „Panou
          baltă” dedesubt, numele lung trece pe două rânduri) și Contul meu deschise, la 4px sub marginea barei.
          Controalele și rândurile au 48px sub 1280 și 40px de la 1280, ca butoanele. Toate controalele barei: hover
          soft-fill, apăsat opacitate .8, cursor pointer.
        </Caption>
      </div>

      <div className="hidden flex-col gap-2.5 md:flex">
        <Title>Bara de sus · tabletă (768–1279)</Title>
        <div className="max-w-190">
          <Frame>
            <TopBar layout="tablet" viewer={SIGNED_IN} active="balti" admin={ADMIN} onSearch={openPalette} />
          </Frame>
        </div>
        <Caption>
          Aceleași linkuri; căutarea e doar iconiță până la 1280. Iconițele și avatarul au 48px; linkurile rămân pastile
          de 40px, cu zona de apăsare extinsă la 48px.
        </Caption>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex w-full max-w-95 flex-col gap-2.5">
          <Title>Bara de sus · mobil (&lt;768)</Title>
          <PhoneBar viewer={SIGNED_IN} hasUnread onMenu={() => setMenu(true)} onSearch={openPalette} />
          <PhoneBar viewer={SIGNED_OUT} onMenu={() => setMenu(true)} onSearch={openPalette} />
          <PhoneBar viewer={{ status: 'pending' }} onMenu={() => setMenu(true)} onSearch={openPalette} />
          <PhoneBar viewer={{ status: 'unknown' }} onMenu={() => setMenu(true)} onSearch={openPalette} />
          <PhoneBar viewer={{ status: 'unknown' }} retrying onMenu={() => setMenu(true)} onSearch={openPalette} />
          <PhoneBar viewer={SIGNED_IN} active="profil" onMenu={() => setMenu(true)} onSearch={openPalette} />
          <Caption>
            Logat · nelogat · sesiunea încă se citește (loc rezervat neutru) · sesiunea nu a putut fi citită (același loc
            cu punct de avertizare; apăsat reîncearcă) · reîncercare în curs · pe Profil sau Setări (inel accent pe
            avatar). „Intră” nu apare niciodată la un utilizator care poate fi logat. Grupul din dreapta are lățime fixă
            pe care „Intră” o umple, așa că lupa și ☰ nu se mută când sesiunea se rezolvă (pe /intra, unde rămâne gol,
            nu mai rezervă loc). Controalele au 48px, lipite unul de altul. La derulare în jos bara se ascunde și
            revine la orice derulare în sus. ☰ deschide meniul ca panou din dreapta (intră și iese glisând, fundalul
            se estompează): secțiunile, Administrare și contul (Profil, Notificări, Setări, Ieși din cont); nelogat,
            „Intră în cont” fixat jos.
          </Caption>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMenu(true)}>
              Meniul de pe mobil
            </Button>
            <Button variant="outline" onClick={openPalette}>
              {shortcut ? `Căutare ${shortcut}` : 'Căutare'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Title>Breadcrumb · zona de sus a paginii (≥768)</Title>
          <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3 shadow-e0">
            <Breadcrumbs trail={[{ label: 'Competiții', href: '/concursuri' }, { label: 'Cupa Toamnei la Crap' }]} />
            <Breadcrumbs trail={[{ label: 'Competiții', href: '/concursuri' }]} pendingCurrent />
          </div>
          <Caption>
            Sub bară, pe suprafața albă a antetului paginii, pe paginile mai adânci decât o secțiune. Părinții sunt
            text mic, estompat, despărțiți de „/”; pagina curentă e textul accentuat. Pagina își pune titlurile reale
            cu {'<SetBreadcrumb>'}; până atunci, în locul titlului stă un loc rezervat (rândul 2).
          </Caption>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Title>Buton-iconiță</Title>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton aria-label="Caută">
            <MagnifyingGlassIcon aria-hidden />
          </IconButton>
          <IconButton aria-label="Meniu" className="text-ink">
            <Bars3Icon aria-hidden />
          </IconButton>
          <IconButton aria-label="Închide">
            <XMarkIcon aria-hidden />
          </IconButton>
        </div>
        <Caption>
          Un singur buton-iconiță pentru bară (☰, căutare, notificări) și pentru închiderea meniului de pe mobil și a
          căutării: 48px sub 1280, 40px de la 1280, hover soft-fill, apăsat opacitate .8, iconiță contur 24, nume
          accesibil obligatoriu.
        </Caption>
      </div>

      <Caption>
        Iconițe în bară și în meniuri (Administrare, Contul meu, meniul de pe mobil, ⌘K): contur 24 (linie 1,5),
        aceeași mărime peste tot; în ⌘K secțiunile au iconița simplă, ca în meniuri, iar pozele și monogramele
        rămân pentru bălți și pescari. Partide folosește peștele Bluvi desenat în contur; peștele plin rămâne pentru
        conținut (capturi).
      </Caption>

      <ToastProvider>
        <ToastDemo />
      </ToastProvider>

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
        <div className="flex h-90 overflow-x-auto overflow-y-hidden rounded-card bg-surface shadow-e0">
          <ul className="min-w-60 flex-1 divide-y divide-hairline">
            {STANDS.map((s) => (
              <li key={s.stand}>
                <button
                  type="button"
                  onClick={() => setPanel(true)}
                  className={`t-body flex h-13 w-full items-center gap-3 px-4 text-left hover:bg-soft-fill ${
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
        <table className="t-caption w-full max-w-130 text-left">
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
      <div className="flex max-w-100 flex-col gap-2.5">
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

      <MobileMenu
        open={menu}
        onClose={() => setMenu(false)}
        session="in"
        active="concursuri"
        admin={ADMIN}
        onSignOut={() => setMenu(false)}
      />
      <CommandPalette open={palette} onClose={() => setPalette(false)} signedIn admin={ADMIN} />
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
        panelClassName="fixed top-0 right-0 z-toast h-dvh"
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
