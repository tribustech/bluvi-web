import { SettingsCard, SettingsRowSkeleton, SettingsScreenFrame, SettingsSectionLabelSkeleton } from '@/components/account/settings';
import { ON_WEB, routes } from '@/lib/routes';

export const NOTIFICATION_SETTINGS_TITLE = 'Notificări';
export const TITLE_ID = 'setari-notificari-titlu';
/**
 * «Înapoi» without in-site history: Setări (fish's parent screen) once /setari ships (ON_WEB.settings,
 * M2-B5), Acasă until then — never a link to a page that is not there.
 */
export const NOTIFICATION_SETTINGS_BACK = ON_WEB.settings ? routes.settings() : routes.home();

/**
 * Loading: the header in place and the two cards in the rows' own geometry (switch row + helper,
 * the CONCURSURI label, the chevron row + helper), so nothing moves when the profile lands. The
 * «Se încarcă setările…» status is the frame's `status`, outside the aria-busy cards.
 */
export function NotificationSettingsSkeleton() {
  return (
    <SettingsScreenFrame title={NOTIFICATION_SETTINGS_TITLE} titleId={TITLE_ID} backFallback={NOTIFICATION_SETTINGS_BACK} busy status="Se încarcă setările…">
      <SettingsCard>
        <SettingsRowSkeleton trailing="switch" />
      </SettingsCard>
      <div className="flex flex-col gap-2">
        <SettingsSectionLabelSkeleton />
        <SettingsCard>
          <SettingsRowSkeleton trailing="chevron" />
        </SettingsCard>
      </div>
    </SettingsScreenFrame>
  );
}
