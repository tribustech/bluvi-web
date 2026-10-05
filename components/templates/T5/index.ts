/**
 * T5 «Dashboard» (ROADMAP §4) — home, organizer panel, lake operator panel.
 *
 *   <DashboardPage header={<DashboardHeader …/>} toolbar={<DashboardToolbar …/>}>
 *     <DashboardLayout
 *       stacked={…phone order…}
 *       context={<DashboardActions layout="list" title={lakeName} …/>}
 *       main={<><KpiGrid …/><DashboardSection …/></>}
 *       aside={<DashboardLines …/>}
 *     />
 *   </DashboardPage>
 *
 * States: <DashboardSkeleton header={false}> under a real <DashboardHeader title="…fallback…"
 * caption={<SkeletonCaption/>} actions={<DashboardRefresh/>}> (Suspense fallback — the real
 * refresh control, router.refresh, needs no data), <DashboardError>, <DashboardEmpty>,
 * <DashboardSignedOut>. Demo with every state: /dev/templates/t5.
 */
export { DashboardPage, type DashboardPageProps } from './DashboardPage';
export { DashboardHeader, type DashboardHeaderProps } from './DashboardHeader';
export { DashboardLayout, type DashboardLayoutProps } from './DashboardLayout';
export { StickyColumn } from './StickyColumn';
export { DashboardActions, DashboardAction, type DashboardActionsProps, type DashboardActionProps } from './DashboardActions';
export { DashboardSection, SectionFooterLink, type DashboardSectionProps } from './DashboardSection';
export { DashboardAlert, type DashboardAlertProps } from './DashboardAlert';
export { DashboardLines, DashboardLine, type DashboardLineProps } from './DashboardLines';
export { KpiGrid, KpiTile, isLongValue, type KpiGridProps, type KpiTileProps } from './KpiGrid';
export { DashboardToolbar } from './DashboardToolbar';
export { DashboardRefresh, type RefreshResult } from './DashboardRefresh';
export { DashboardSkeleton, DashboardError, DashboardEmpty, DashboardSignedOut, SkeletonCaption } from './DashboardStates';
export { TONE_SQUARE, ACTION_TILE, ICON_TILE, ICON_TILE_SOLID, LINK_ACTION, STATE_CARD, type T5Tone, type ActionTone } from './tones';
export { CountBadge } from './CountBadge';
export { DASHBOARD_TRACKS } from './tracks';
