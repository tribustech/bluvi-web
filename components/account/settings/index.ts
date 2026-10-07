/**
 * The settings kit — a port of fish components/settings/SettingsRows.tsx (SettingsCard,
 * InfoCardItem, NotificationCardItem) for every settings screen: /setari/notificari (built with it),
 * /setari (M2-B5) and the followed-competition preferences.
 *
 *   <SettingsScreenFrame title="Notificări" backFallback={routes.settings()}>
 *     <SettingsCard>
 *       <SwitchRow icon={<BellAlertIcon />} label="…" helper="…" checked={on} onChange={save} />
 *     </SettingsCard>
 *     <SettingsSection label="Concursuri">
 *       <SettingsCard inactive={!on}>
 *         <NavRow icon={<TrophyIcon />} label="…" helper="…" href={…} disabled={!on} />
 *       </SettingsCard>
 *     </SettingsSection>
 *   </SettingsScreenFrame>
 *
 * Class lists (for a server skeleton or a custom row) are in ./styles.
 */

/** The screen: back control (history, else `backFallback`) + h1 + the column of cards (centred ≤ 720 below 1280; on the shell's left gutter, ≤ 840 + a docked side track, from 1280). */
export { SettingsScreenFrame } from './SettingsScreenFrame';
/**
 * SettingsCard — fish SettingsCard: the white card of rows (hairline between rows; `inactive` = fish's
 * half-opacity card). SettingsSection — a group under an uppercase label (the section's h2).
 * InfoRow — label + value (fish InfoCardItem with `value`). RowHelper — the helper line under a row.
 * SettingsRowSkeleton / SettingsSectionLabelSkeleton — loading shapes in the rows' geometry.
 */
export { SettingsCard, SettingsSection, InfoRow, RowHelper, SettingsRowSkeleton, SettingsSectionLabelSkeleton } from './SettingsCard';
/** NavRow — a row that opens a screen (chevron, optional helper; `disabled` = aria-disabled, not a link), or acts in place (`onClick`). */
export { NavRow } from './NavRow';
/** SwitchRow — icon · label · role=switch, with a helper (fish NotificationCardItem, controlled). SettingsSwitch — the bare switch. */
export { SwitchRow, SettingsSwitch } from './SwitchRow';
export * from './styles';
