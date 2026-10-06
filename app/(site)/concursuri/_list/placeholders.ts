import type { RecentWeighing } from '@/core/competitions';

/*
 * FAKE data for the signed-out blurred previews (./SignedOutGate): plausible shapes so the blurred
 * block looks like the real one, never real people or competitions. Local images only.
 */

const POSTER = '/images/competition-placeholder-thumb.jpg';
const at = (minutesAgo: number) => new Date(Date.UTC(2026, 9, 6, 9, 0) - minutesAgo * 60_000).toISOString();

export const PLACEHOLDER_RECENT_WEIGHINGS: RecentWeighing[] = [
  { weighingDocumentId: 'placeholder-1', endAt: at(2), weighingType: 'normal', competition: { documentId: 'placeholder', name: 'Cupa de toamnă', posterUrl: POSTER }, standLabel: 'Sector A, Stand 4', angler: { displayName: 'Pescar Unu', avatarUrl: null, isTeam: false }, catchCount: 3, totalKg: 14.2 },
  { weighingDocumentId: 'placeholder-2', endAt: at(6), weighingType: 'normal', competition: { documentId: 'placeholder', name: 'Cupa de toamnă', posterUrl: POSTER }, standLabel: 'Sector B, Stand 11', angler: { displayName: 'Pescar Doi', avatarUrl: null, isTeam: false }, catchCount: 1, totalKg: 8.75 },
  { weighingDocumentId: 'placeholder-3', endAt: at(11), weighingType: 'normal', competition: { documentId: 'placeholder-2', name: 'Feeder de seară', posterUrl: POSTER }, standLabel: 'Stand C7', angler: { displayName: 'Echipa Trei', avatarUrl: null, isTeam: true }, catchCount: 12, totalKg: 6.4 },
  { weighingDocumentId: 'placeholder-4', endAt: at(19), weighingType: 'normal', competition: { documentId: 'placeholder-2', name: 'Feeder de seară', posterUrl: POSTER }, standLabel: 'Stand A2', angler: { displayName: 'Pescar Patru', avatarUrl: null, isTeam: false }, catchCount: 2, totalKg: 11.1 },
  { weighingDocumentId: 'placeholder-5', endAt: at(27), weighingType: 'normal', competition: { documentId: 'placeholder', name: 'Cupa de toamnă', posterUrl: POSTER }, standLabel: 'Sector A, Stand 9', angler: { displayName: 'Pescar Cinci', avatarUrl: null, isTeam: false }, catchCount: 4, totalKg: 21.3 },
];
