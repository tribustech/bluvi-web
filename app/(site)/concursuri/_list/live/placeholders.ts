import type { HeroModel } from './MineHero';
import type { BoardModel } from './SingleLive';

/*
 * FAKE data for the Live tab's signed-out previews (../SignedOutGate, blurred): plausible shapes so
 * the blurred block looks like the real one — never real people, competitions or figures.
 * The strip's fake weighings are ../placeholders PLACEHOLDER_RECENT_WEIGHINGS.
 */

export const PLACEHOLDER_HERO: HeroModel = {
  competitionId: 'placeholder',
  name: 'Cupa de toamnă',
  poster: '/images/competition-placeholder-thumb.jpg',
  where: 'Balta Exemplu · Ilfov · Cantitate',
  stand: '12',
  place: 4,
  of: 36,
  value: '18,4',
  unit: 'kg',
  valueCaption: 'kg total · 6 capturi',
  sectorLine: 'Locul 2 în sectorul B',
  gap: { value: '3,2', unit: 'kg' },
  leads: false,
  href: '#',
};

export const PLACEHOLDER_BOARD: BoardModel = {
  leader: { name: 'Pescar Unu', avatar: null, value: '21,6', unit: 'kg' },
  second: { name: 'Pescar Doi', gap: '1,3', unit: 'kg' },
  rows: [
    { key: 'p1', position: 1, name: 'Pescar Unu', avatar: null, sub: 'Sector A · Stand 4', value: '21,6', unit: 'kg' },
    { key: 'p2', position: 2, name: 'Pescar Doi', avatar: null, sub: 'Sector B · Stand 11', value: '20,3', unit: 'kg' },
    { key: 'p3', position: 3, name: 'Echipa Trei', avatar: null, sub: 'Sector A · Stand 7', value: '17,9', unit: 'kg' },
    { key: 'p4', position: 4, name: 'Pescar Patru', avatar: null, sub: 'Sector C · Stand 2', value: '15,2', unit: 'kg' },
    { key: 'p5', position: 5, name: 'Pescar Cinci', avatar: null, sub: 'Sector B · Stand 9', value: '12,8', unit: 'kg' },
  ],
};
