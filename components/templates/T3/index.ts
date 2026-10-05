/*
 * T3 «Detail with tabs» (ROADMAP §4) — competition, lake, angler profile, partidă, public water.
 * Demo with every state: /dev/templates/t3 (app/dev/templates/t3).
 */
export { DetailPage, DetailBand, type DetailPageProps, type DetailBandProps } from './DetailPage';
export { DetailHeader, HEADER_CHIP, PHOTO_CHIP, headerChipClass, type DetailHeaderProps, type HeaderChipGround } from './DetailHeader';
export { DetailPhotoHero, PHOTO_PILL, SURFACE_PILL, photoHeroHeight, type DetailPhoto, type DetailPhotoHeroProps } from './DetailPhotoHero';
export { DetailTabs, type DetailTab } from './DetailTabs';
export {
  DetailSectionsProvider,
  DetailSectionNav,
  DetailSectionToc,
  type DetailSectionItem,
  type DetailSectionNavProps,
} from './DetailSections';
export { DetailBody, DetailSection, DetailAsideCard, H3_CLASS, type DetailBodyProps, type DetailSectionProps } from './DetailBody';
export { DetailActionBar, type DetailActionBarProps } from './DetailActionBar';
export { DetailQuickActions, type DetailQuickAction } from './DetailQuickActions';
export { DetailFacts, type DetailFact } from './DetailFacts';
export { DetailProse } from './DetailProse';
export { richTextToPlain } from './prose';
export { DetailBackButton } from './DetailBackButton';
export { DetailShareButton } from './DetailShareButton';
export { DetailSkeleton, DetailError, DetailNotFound, DetailSignInPrompt, type DetailSkeletonProps } from './DetailStates';
export { DetailRetry } from './DetailRetry';
export { DetailSignInAgain } from './DetailSignInAgain';
export { DetailUnavailable, DetailUnavailableButton } from './DetailUnavailable';
export { SECTION_SCROLL_MARGIN, STICKY_TOP, COLUMN_STICKY_TOP, PRESENCE_ICON } from './metrics';
