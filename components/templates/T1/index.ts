/*
 * T1 «Listă cu filtre» (ROADMAP §4) — composable regions; see ListPage for how they fit.
 * Live demo with every state: /dev/templates/t1.
 */
export { ListPage, ASIDE_INLINE } from './ListPage';
export { ListPageSkeleton, TabsSkeleton, FilterColumnSkeleton, ToolbarSkeleton } from './ListPageSkeleton';
export { ListHeader, ListHeaderToggle, type ListBack } from './ListHeader';
export { ListTabs, LiveDot, tabClass, TabContent, type ListTab, type TabLook } from './ListTabs';
export { ListToolbar, ListSearch, FilterButton, ViewToggle, type ViewOption } from './ListToolbar';
export { SEARCH_SHELL, CONTROL_H, FOCUS_RING, PILL_H, PAGE_RULE, pageToolClass, filterButtonClass } from './toolbarStyles';
export { ActiveFilters, type ActiveFilter } from './ActiveFilters';
export { FilterColumn, FiltersSurface, FilterSection, ChoiceChips, FilterSwitch, type Choice } from './Filters';
export { ListSummary, ListGrid, ListRows, ListRegion, LIST_GRID_COLS, LIST_GUTTER, listGridClass, ROWS_HEAD } from './ListBody';
export { ListSkeleton, ListEmpty, ListError, ListSignInGate, ListFooter } from './ListStates';
export { AsideSection, AsideSkeleton } from './ListAside';
export { COLUMN_CARD, ColumnHeader, TEXT_ACTION, TextAction } from './ColumnCard';
export { StickyActions } from './StickyActions';
export { useListUrlState, type ListUrlValues } from './useListUrlState';
export { listParam, listParamOf } from './listParams';
export { describeError, type ErrorDescription, type ErrorKind } from './describeError';
