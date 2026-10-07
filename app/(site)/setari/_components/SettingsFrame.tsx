'use client';

import type { ReactNode } from 'react';
import { useBack } from '@/components/nav/useBack';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

export const SETTINGS_TITLE = 'Setări';
export const TITLE_ID = 'setari-titlu';
/** «Înapoi» without in-site history: the own profile, whose cog opens Setări (fish's way in). */
export const SETTINGS_BACK = routes.profile();

/**
 * The hub's width: below 1280 one column up to 720, centred (the settings kit's SETTINGS_COLUMN — the
 * edges of /setari/notificari, so going between them never moves the header); from 1280 the shell's
 * full content width (ROADMAP §4: 32 gutters, ≤ 1680), so the header's «Reîmprospătează» ends on the
 * top bar's right edge and the three columns fill the window — the centre takes what is left.
 */
const HUB_WIDTH = 'mx-auto w-full max-w-180 xl:mx-0 xl:max-w-none';

/**
 * Setări's frame (fish: BackButton + title1 «Setări» over the grey ScrollScreen). Composed from T1's
 * ListPage + ListHeader (no inventory template; the settings kit's SettingsScreenFrame is one column
 * plus a narrow aside, Setări needs three). No sticky header (owner rule 3): the band scrolls away.
 * `back` false: fish's ErrorScreen goBack={false} (c1). `actions`: the header's right end
 * («Reîmprospătează», c20). `busy` / `status`: the loading skeleton and its live line (outside it).
 */
export function SettingsFrame({
  back = true,
  actions,
  busy = false,
  status,
  children,
}: {
  back?: boolean;
  actions?: ReactNode;
  busy?: boolean;
  status?: string;
  children: ReactNode;
}) {
  const goBack = useBack(SETTINGS_BACK);
  return (
    <ListPage
      header={
        <div className={HUB_WIDTH}>
          <ListHeader title={SETTINGS_TITLE} titleId={TITLE_ID} back={back ? { label: 'Înapoi', onClick: goBack } : undefined} actions={actions} />
        </div>
      }
    >
      {status ? (
        <p role="status" className="sr-only">
          {status}
        </p>
      ) : null}
      <div aria-busy={busy || undefined} className={HUB_WIDTH}>
        {children}
      </div>
    </ListPage>
  );
}

/**
 * The cards, in fish's order on the phone and tablet (one column): profile → Notificări /
 * organizer / bookings → Reputație → INFORMAȚII → legal → Contactează-ne → Deconectare + Șterge
 * contul. From 1280 (ROADMAP §4, three columns): left who you are (profile card + INFORMAȚII,
 * 320/360), centre what you act on and what others say (the actions card + Reputație, whose reviews
 * — stars, tags, comments — get the width: 528 at 1280 up to 912 at 1920), right the legal pages,
 * contact and leaving (320/360).
 *
 * One DOM, two layouts: the column wrappers are `display: contents` below 1280 (their cards are the
 * grid's items, put in fish's order with `order`), flex columns from 1280. INFORMAȚII and Reputație
 * have no control of their own (bar an error's retry), so the keyboard path (profile → actions →
 * legal → contact → leave) follows the visual order at every width.
 */
export function SettingsColumns({
  profile,
  actions,
  reputation,
  info,
  legal,
  contact,
  leave,
}: Record<'profile' | 'actions' | 'reputation' | 'info' | 'legal' | 'contact' | 'leave', ReactNode>) {
  const column = 'contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6';
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:gap-6',
        'xl:grid-cols-[--spacing(80)_minmax(0,1fr)_--spacing(80)] xl:items-start 2xl:grid-cols-[--spacing(90)_minmax(0,1fr)_--spacing(90)]',
      )}
    >
      <div className={column} data-testid="settings-column-identity">
        <div className="order-1 min-w-0">{profile}</div>
        <div className="order-4 min-w-0">{info}</div>
      </div>
      <div className={column} data-testid="settings-column-actions">
        <div className="order-2 min-w-0">{actions}</div>
        <div className="order-3 min-w-0">{reputation}</div>
      </div>
      <div className={column} data-testid="settings-column-leave">
        <div className="order-5 min-w-0">{legal}</div>
        {contact ? <div className="order-6 min-w-0">{contact}</div> : null}
        <div className="order-7 min-w-0">{leave}</div>
      </div>
    </div>
  );
}
