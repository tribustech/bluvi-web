'use client';

import { ChevronDownIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { MenuButton, type MenuEntry } from '@/components/nav/MenuButton';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ORGANIZER_ICON, optionTone } from './icons';
import type { OrganizerOption } from './model';

/**
 * From 768, the author's «Organizare» (parity organizare c1): the header's menu button (kit
 * MenuButton — a WAI-ARIA menu: arrows, Home / End, Escape) with fish's organizerMenuOptions in fish's
 * order. Links navigate; the writes ask first (ConfirmActionDialog) and the dialogs open over the
 * page (useOrganizer). The phone has the same entries as the bar's «Organizare» submenu (ActionBar).
 */
/** For the header band (a stacking context of its own): above the sticky tabs while the menu is open. */
export const ORGANIZER_MENU_OPEN = 'has-[[data-organizer-menu]_[aria-expanded=true]]:z-overlay';

export function OrganizerMenu({ options, onChoose }: { options: OrganizerOption[]; onChoose: (o: OrganizerOption) => void }) {
  if (options.length === 0) return null;
  const entries: MenuEntry[] = options.map(o => {
    const Icon = ORGANIZER_ICON[o.icon];
    const icon = <Icon aria-hidden className={cn('size-6 shrink-0', optionTone(o) === 'danger' ? 'text-status-danger-fg' : 'text-accent-ink')} />;
    return o.action.type === 'link'
      ? { kind: 'link', key: o.key, label: o.label, href: o.action.href, icon }
      : { kind: 'action', key: o.key, label: o.label, icon, onSelect: () => onChoose(o), danger: optionTone(o) === 'danger' };
  });
  return (
    // Open, the menu must paint over the sticky tab band and the content under the header: the
    // header band is its own stacking context (T3 DetailBand `isolate`), so CompetitionScreen lifts
    // the band while this menu is open (ORGANIZER_MENU_OPEN) — never while closed, so the header
    // never covers the top bar.
    <div data-testid="organizer-menu" data-organizer-menu="" className="relative">
      <MenuButton
        label="Organizare"
        align="end"
        entries={entries}
        trigger={
          <>
            <Cog6ToothIcon aria-hidden className="size-5" />
            Organizare
            <ChevronDownIcon aria-hidden className="size-5" />
          </>
        }
        triggerClassName={cn(buttonClass({ variant: 'secondary' }), 'gap-2 aria-expanded:brightness-95')}
      />
    </div>
  );
}
