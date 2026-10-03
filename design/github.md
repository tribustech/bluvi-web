repo: tribustech/bluvi-mobile-app
branch: develop

## Last sync
date: 2026-10-01T14:08:18Z

### Updated in this project
- Acasă: mobil logat + nelogat (1:1 develop) și desktop cu coloană „ce mă așteaptă”
- Acasă: iconițe facilități din getFacilityIcon.ts + lakeIconColors.ts
- Concurs: cântar în curs mutat în tile, filtre sectoare pe un rând

## Screen map
| Screen | Repo files |
|---|---|
| Competitii.dc.html | app/(app)/(tabs)/competitions/index.tsx, features/competitions/components/CompetitionsHeader.tsx, CompetitionsStatusControl.tsx, pulse/*, cards/preview/CompetitionCardPreview.tsx, cards/preview/UpcomingFooter.tsx, cards/preview/LiveFooter.tsx, cards/preview/CardStatRow.tsx, cards/preview/CompetitionDensityPreviewToggle.tsx, cards/FaceStack.tsx, components/FollowersPill.tsx, app/(app)/(tabs)/_layout.tsx, components/ranking-table/RankingTable.tsx |
| Acasa.dc.html | app/(app)/(tabs)/index.tsx, components/OrganizerBanner.tsx, OwnedLakesCard.tsx, WidgetsList.tsx, PollCard.tsx, LakeRequestBanner.tsx, FeedbackSection.tsx, NewsHorizontalList.tsx, NewsCard.tsx, MiniatureLakeCard.tsx, SeeAllTitle.tsx, features/partide/components/community/NoActiveCta.tsx, ActivePartidaDock.tsx, features/competitions/components/CompetitionCardsRail.tsx, cards/preview/CompetitionRailCard.tsx, features/anglers/components/SuggestedAnglersRail.tsx, SuggestedAnglerCard.tsx, features/operator/OperatorQuickAction.tsx, helpers/getFacilityIcon.ts, constants/lakeIconColors.ts |
| Concurs.dc.html | app/(app)/competitions/[competitionId].tsx, components/competition/CompetitionHeader.tsx, CompetitionRanking.tsx, RankingActionBar.tsx, components/ranking-table/RankingTable.tsx, helpers/table/getTableColumns.ts, components/RankingCardsCarousel.tsx, RankingMetaCard.tsx, ActiveWeighingBanner.tsx, LivePlusViewers.tsx, FollowButton.tsx, HeaderIconButton.tsx, headerIconSurface.ts |
| Harta ecranelor.dc.html | app/** (tree) |
| Fundatii.dc.html | theme.ts, components/Typography.tsx, components/Badge.tsx, helpers/table/getColorsBySector.ts |
