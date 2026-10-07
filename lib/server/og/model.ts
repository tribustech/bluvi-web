import { formatDecimal, formatInt } from '@/components/cards/format';
import { formatReviewsCount, getLakeLocationSubtitle, getLakeRatingDisplay, publicWaterName, publicWaterSubtitle, type LakeDetail, type PublicWaterDetail } from '@/core/lakes';
import { pointsText, valueText, type MiniRanking } from '@/app/(site)/concursuri/_list/desktop/model';
import { competitionDateProse } from '@/app/(site)/concursuri/[id]/_components/dates';
import { categoryLabel, newsDate } from '@/app/(site)/stiri/_content/format';
import type { WaterOutline } from '@/app/(site)/ape-publice/_components/map/outline';
import { entityLayout } from './layout';
import type { OgTokens } from './tokens';

/*
 * What an Open Graph card says (parity global.b.seo-og-images) — pure: the CMS reads go in, the
 * card's words come out (cards.tsx draws them). Unit-tested in tests/unit/og-model.test.ts.
 *
 * Owner rule 4 («when we don't know, we don't show»): a fact the CMS does not give (no rating, no
 * price, no location, no lake) is left out, never written as «necunoscut». Rule 10: a unit is its
 * own, smaller element beside the number. Rule 11: «capot» is never written — and, as fish's card
 * podium (CMS competition-card-results.ts), a place that caught nothing is not on the podium at all.
 */

export type Pill = { text: string; tone: 'live' | 'info' | 'neutral' };
/** A number and its unit, drawn apart (owner rule 10). */
export type Figure = { value: string; unit: string | null };
/** `tied`: several competitors share the place — the card must not name one winner (fish CardPodiumRow). */
export type PodiumLine = { position: number; tied: boolean; name: string; figure: Figure };
export type MetaIcon = 'pin' | 'calendar' | 'lake' | 'water';
/**
 * `short`: a date line's compact form («10–11 oct. 2026»), used when it joins the place on one line;
 * `tail`: that joined date, drawn after the place (layout.ts — the place is cut first, never the date).
 */
export type MetaLine = { icon: MetaIcon; text: string; short?: string; tail?: string };

export type Media =
  /** A photo, a poster or a news cover (render.tsx readPicture: cropped, or whole on a blurred ground). */
  | { kind: 'photo'; src: string }
  /** A sponsor logo, contained on white with air around it (never cropped). */
  | { kind: 'logo'; src: string }
  /** A public water's outline (outline.ts, a 100×100 box). */
  | { kind: 'outline'; outline: WaterOutline }
  /** No picture: the brand panel. */
  | { kind: 'brand' };

export type EntityCard = {
  kind: 'entity';
  /** «Baltă», «Concurs · Clasament», «Apă publică · Hartă». */
  eyebrow: string;
  title: string;
  pill: Pill | null;
  meta: MetaLine[];
  rating: { score: string; count: string } | null;
  /** «de la 120 RON», or a public water's «5,57 km²». */
  price: { amount: string; unit: string } | null;
  podium: PodiumLine[];
  media: Media;
};

export type BrandCard = { kind: 'brand'; title: string; tagline: string };
export type HomeCard = { kind: 'home' };
export type OgCard = EntityCard | BrandCard | HomeCard;

/** Longest title the card prints whole; past it the title is cut at a word and ends in «…». */
export const TITLE_MAX = 70;
const LINE_MAX = 60;
const PODIUM_NAME_MAX = 34;

/** Cuts `text` at a word boundary to at most `max` characters, with «…». */
export function clampText(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * A dash between two words (« — », « – ») stays with the word before it (a no-break space): a line
 * never starts with the dash, and «Cupa Bluvi —» is not left dangling over «Etapa 3» by a wrap that
 * could have broken elsewhere (the cards also balance their lines, cards.tsx textWrap).
 */
export const bindDashes = (text: string) => text.replace(/(\S) ([—–])(?= )/g, '$1\u00a0$2');

const eyebrow = (base: string, label?: string | null) => (label ? `${base} · ${label}` : base);

const entity = (card: Omit<EntityCard, 'kind' | 'pill' | 'meta' | 'rating' | 'price' | 'podium'> & Partial<EntityCard>): EntityCard => ({
  kind: 'entity',
  pill: null,
  meta: [],
  rating: null,
  price: null,
  podium: [],
  ...card,
  title: bindDashes(clampText(card.title, TITLE_MAX)),
});

/* ---------------------------------------------------------------- brand cards (lists) */

export const BRAND_CARDS = {
  lakes: { title: 'Bălți de pescuit din România', tagline: 'Prețuri, rezervări online, recenzii și capturile pescarilor.' },
  lakesMap: { title: 'Harta bălților de pescuit', tagline: 'Găsește balta potrivită lângă tine, pe hartă.' },
  competitions: { title: 'Concursuri de pescuit', tagline: 'Clasamente live, înscrieri online și rezultate.' },
  competitionsUpcoming: { title: 'Concursuri de pescuit viitoare', tagline: 'Alege următorul start și înscrie-te online.' },
  competitionsLive: { title: 'Concursuri de pescuit live', tagline: 'Clasament live, cântăriri și cele mai mari capturi.' },
  competitionsResults: { title: 'Rezultate concursuri de pescuit', tagline: 'Câștigători, podium și clasamente complete.' },
  publicWaters: { title: 'Ape publice', tagline: 'Lacuri și râuri din România, pe hartă, cu partidele pescarilor.' },
  news: { title: 'Noutăți', tagline: 'Știri, evenimente și tehnici din comunitatea Bluvi.' },
  partide: { title: 'Partide de pescuit', tagline: 'Cine e la apă acum, ultimele capturi și recordurile comunității.' },
  partideStats: { title: 'Statistici comunitate', tagline: 'Partide, pescari, capturi, top pescari și recordul perioadei.' },
  partideRanking: { title: 'Clasamente partide', tagline: 'Pescarii, bălțile și speciile săptămânii, lunii și anului în comunitatea Bluvi.' },
} as const satisfies Record<string, { title: string; tagline: string }>;

export type BrandKey = keyof typeof BRAND_CARDS;

export const brandCard = (key: BrandKey): BrandCard => ({ kind: 'brand', ...BRAND_CARDS[key] });

/** The card for a page whose data could not be read: the section's brand card, never an error. */
export const FALLBACK: Record<'lake' | 'competition' | 'water' | 'news' | 'sponsor', BrandKey | 'home'> = {
  lake: 'lakes',
  competition: 'competitions',
  water: 'publicWaters',
  news: 'news',
  sponsor: 'home',
};

/* ---------------------------------------------------------------- lake */

/** The lake's first photo (lakes.detail), the medium size: the panel is 520 px wide. */
export function lakePhoto(lake: Pick<LakeDetail, 'images'>): string | null {
  const img = lake.images[0];
  return img ? img.mediumUrl || img.url || img.smallUrl || null : null;
}

export function lakeCard(
  lake: Pick<LakeDetail, 'name' | 'images' | 'reviewsMeta' | 'cityRef' | 'countyRef' | 'county' | 'address'>,
  price: { price: number } | null,
  photo: string | null,
  label?: string | null,
): EntityCard {
  const where = getLakeLocationSubtitle(lake, { includeAddress: false });
  const r = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? getLakeRatingDisplay(lake.reviewsMeta) : null;
  return entity({
    eyebrow: eyebrow('Baltă', label),
    title: lake.name,
    meta: where ? [{ icon: 'pin', text: clampText(where, LINE_MAX) }] : [],
    rating: r?.scoreLabel ? { score: r.scoreLabel, count: formatReviewsCount(lake.reviewsMeta!.count) } : null,
    // The tour's note («tura de 12 ore») stays on the page: the card keeps fewer, larger facts.
    price: price && price.price > 0 ? { amount: formatInt(price.price), unit: 'RON' } : null,
    media: photo ? { kind: 'photo', src: photo } : { kind: 'brand' },
  });
}

/* ---------------------------------------------------------------- competition */

/**
 * The status pill as the competition page's header draws it (fish CompetitionHeader: only «Live»;
 * the web page dropped «Viitor» / «Încheiat», ROADMAP §1.3) — plus «Anulat» (fish StatDetailSheet's
 * word), so a shared cancelled event never reads as a normal one. Draft / upcoming / completed: none.
 */
export function statusPill(status: string): Pill | null {
  switch (status) {
    case 'started':
      return { text: 'Live', tone: 'live' };
    case 'cancelled':
      return { text: 'Anulat', tone: 'neutral' };
    default:
      return null;
  }
}

/** fish / CMS podiumDepth: never fewer than three places, never more than six. */
export const PODIUM_MIN = 3;
export const PODIUM_MAX = 6;

/**
 * How many places a competition awards (CMS competition-card-results.ts podiumDepth, the standings
 * screen's winners rule): a Best Of its `numberOfWinners`, a tiered Best Of one per tier, every
 * other format the winner of each sector — clamped to 3..6.
 */
export function podiumDepth(c: { rankingType: string; numberOfWinners?: number | null; bestOfTierSizes?: unknown; sectors?: unknown[] | null }): number {
  let winners: number;
  if (c.rankingType === 'bestOf') winners = Number(c.numberOfWinners) || 0;
  else if (c.rankingType === 'bestOfTiers') winners = Array.isArray(c.bestOfTierSizes) ? c.bestOfTierSizes.length : 0;
  else winners = c.sectors?.length ?? 0;
  return Math.min(PODIUM_MAX, Math.max(PODIUM_MIN, winners));
}

/**
 * The podium by fish's card rule (CMS podiumFromPlacements): only places within `depth` that
 * caught something (every engine hands a blank competitor a place); none at all when nothing was
 * weighed or no row is first; rows sharing a place are `tied`.
 *
 * Web deviation, deliberate: a 1200×630 card has room for PODIUM_MAX rows, fish's card lists every
 * row within depth. So the places are kept whole, in order, while they fit in PODIUM_MAX rows: a
 * place is never cut inside (a tie is shown entirely or not at all), the first place that does not
 * fit ends the podium, and when the 1st place alone is shared by more than PODIUM_MAX competitors
 * the card has no podium (it never names some winners of a tie and not the others).
 */
export function podiumLines(ranking: MiniRanking | null, depth: number = PODIUM_MIN): PodiumLine[] {
  if (!ranking) return [];
  const placed = ranking.rows.filter(r => r.position >= 1 && r.position <= depth && r.catches > 0 && r.value != null);
  if (!placed.some(r => r.position === 1)) return [];
  const count = new Map<number, number>();
  for (const r of placed) count.set(r.position, (count.get(r.position) ?? 0) + 1);
  const kept: typeof placed = [];
  for (const position of [...count.keys()].sort((x, y) => x - y)) {
    const place = placed.filter(r => r.position === position);
    if (kept.length + place.length > PODIUM_MAX) break;
    kept.push(...place);
  }
  return kept.map(r => {
    let figure: Figure;
    if (ranking.unit === 'kg') figure = { value: valueText(r.value!, 'kg'), unit: 'kg' };
    else {
      const words = pointsText(r.value!);
      const number = valueText(r.value!, 'puncte');
      figure = { value: number, unit: words.slice(number.length).trim() || null };
    }
    return { position: r.position, tied: count.get(r.position)! > 1, name: clampText(r.name, PODIUM_NAME_MAX), figure };
  });
}

export type OgCompetition = {
  name: string;
  /** `team`: the team name is the competitor's; else the angler is (podiumNames). */
  competitionType?: string | null;
  competitionStatus: string;
  rankingType: string;
  numberOfWinners?: number | null;
  bestOfTierSizes?: unknown;
  sectors?: unknown[] | null;
  startDate: string;
  endDate: string;
  lake: { name: string } | null;
  banner: { url: string; formats: { large: { url: string } | null; medium: { url: string } | null } } | null;
};

/** The banner / poster the card crops: the large size, else the original. */
export function competitionPhoto(c: Pick<OgCompetition, 'banner'>): string | null {
  return c.banner ? c.banner.formats.large?.url || c.banner.formats.medium?.url || c.banner.url || null : null;
}

const MONTH_SHORT: Record<string, string> = {
  ianuarie: 'ian.',
  februarie: 'feb.',
  martie: 'mar.',
  aprilie: 'apr.',
  mai: 'mai',
  iunie: 'iun.',
  iulie: 'iul.',
  august: 'aug.',
  septembrie: 'sept.',
  octombrie: 'oct.',
  noiembrie: 'nov.',
  decembrie: 'dec.',
};

/** «10–11 octombrie 2026» → «10–11 oct. 2026» (the competition page's short month names). */
export const shortDate = (prose: string) => prose.replace(/[a-z]+/g, m => MONTH_SHORT[m] ?? m);

/**
 * A ranking response with the names fish's card gives (CMS podiumFromPlacements): in a team
 * competition the team name is the competitor's; in an individual one `teamName` is whatever the
 * angler typed (often a sponsor) and never replaces the angler — so it is dropped before the
 * ranking is read (miniRanking names a row by its team first, as the ranking table does).
 */
export function podiumNames<T extends { rankings: unknown[] }>(res: T, competitionType: string | null | undefined): T {
  if (competitionType === 'team') return res;
  return {
    ...res,
    rankings: res.rankings.map(r => (r && typeof r === 'object' && 'teamName' in r ? { ...(r as Record<string, unknown>), teamName: null } : r)),
  };
}

export function competitionCard(c: OgCompetition, ranking: MiniRanking | null, photo: string | null, label?: string | null): EntityCard {
  const dates = competitionDateProse(c.startDate, c.endDate);
  const meta: MetaLine[] = [];
  if (c.lake?.name) meta.push({ icon: 'lake', text: clampText(c.lake.name, LINE_MAX) });
  if (dates) meta.push({ icon: 'calendar', text: dates, short: shortDate(dates) });
  return entity({
    eyebrow: eyebrow('Concurs', label),
    title: c.name,
    pill: statusPill(c.competitionStatus),
    meta,
    // The podium only once the competition is over (a live order still moves).
    podium: c.competitionStatus === 'completed' ? podiumLines(ranking, podiumDepth(c)) : [],
    media: photo ? { kind: 'photo', src: photo } : { kind: 'brand' },
  });
}

/* ---------------------------------------------------------------- public water */

const AREA = (km2: number) => formatDecimal(km2, 0, 2);

export function waterCard(
  water: Pick<PublicWaterDetail, 'name' | 'type' | 'county' | 'countyIds' | 'areaKm2'>,
  outline: WaterOutline | null,
  label?: string | null,
): EntityCard {
  const meta: MetaLine[] = [{ icon: 'water', text: clampText(publicWaterSubtitle(water), LINE_MAX) }];
  return entity({
    eyebrow: eyebrow('Apă publică', label),
    title: publicWaterName(water),
    meta,
    // The area as a figure (the price slot's shape): «5,57» + «km²».
    price: water.areaKm2 != null && water.areaKm2 > 0 ? { amount: AREA(water.areaKm2), unit: 'km²' } : null,
    media: outline ? { kind: 'outline', outline } : { kind: 'brand' },
  });
}

/* ---------------------------------------------------------------- news, sponsor */

export function newsCard(n: { title: string; category: string; createdAt: string }, cover: string | null): EntityCard {
  const date = newsDate(n.createdAt);
  return entity({
    eyebrow: categoryLabel(n.category) || 'Noutăți',
    title: n.title,
    meta: date ? [{ icon: 'calendar', text: date.toLocaleLowerCase('ro').replace(/^0/, '') }] : [],
    media: cover ? { kind: 'photo', src: cover } : { kind: 'brand' },
  });
}

export function sponsorCard(sp: { name: string }, logo: string | null): EntityCard {
  return entity({
    eyebrow: 'Sponsor Bluvi',
    title: sp.name,
    media: logo ? { kind: 'logo', src: logo } : { kind: 'brand' },
  });
}

/* ---------------------------------------------------------------- alt text */

/** The `alt` of the list pages' (and Acasă's) brand cards. */
export const OG_ALT = {
  home: 'Bluvi — concursuri de pescuit, bălți și partide',
  lakes: 'Bluvi — bălți de pescuit din România',
  lakesMap: 'Bluvi — harta bălților de pescuit',
  competitions: 'Bluvi — concursuri de pescuit',
  competitionsUpcoming: 'Bluvi — concursuri de pescuit viitoare',
  competitionsLive: 'Bluvi — concursuri de pescuit live',
  competitionsResults: 'Bluvi — rezultate concursuri de pescuit',
  publicWaters: 'Bluvi — ape publice din România',
  news: 'Bluvi — noutăți',
  partide: 'Bluvi — partide de pescuit',
  partideStats: 'Bluvi — statisticile comunității de pescari',
  partideRanking: 'Bluvi — clasamentele partidelor de pescuit',
} as const satisfies Record<BrandKey | 'home', string>;

export type EntityKind = keyof typeof FALLBACK;

const ALT_LEAD: Record<EntityKind, string> = {
  lake: 'Balta',
  competition: 'Concursul',
  water: '',
  news: 'Știre Bluvi:',
  sponsor: 'Sponsor Bluvi:',
};

/**
 * An entity card's alt, read off the card and its layout (layout.ts entityLayout, the same one
 * cards.tsx draws) so it names only what the card draws — a fact left out under rule 4, or for
 * want of room, is never promised: «Balta Chita Lake, Giurgiu — 4,33 ★, de la 50 RON», «Concursul
 * Cupa X, Iaz Suharău, 10–11 octombrie 2026 — podium: Ion Popescu, Ana Pop». No card (the entity
 * could not be read) → the section's brand card's alt, which is what is drawn then.
 */
export function entityAlt(kind: EntityKind, card: EntityCard | null, t: OgTokens): string {
  if (!card) return OG_ALT[FALLBACK[kind]];
  const facts: string[] = [];
  if (card.pill) facts.push(card.pill.text);
  if (card.rating) facts.push(`${card.rating.score} ★ (${card.rating.count})`);
  if (card.price) facts.push(card.price.unit === 'RON' ? `de la ${card.price.amount} RON` : `${card.price.amount} ${card.price.unit}`);
  if (card.podium.length) facts.push(`podium: ${card.podium.map(p => p.name).join(', ')}`);
  const drawn = entityLayout(t, card).meta;
  const place = drawn.find(m => m.icon !== 'calendar');
  const date = place?.tail ? card.meta.find(m => m.icon === 'calendar')?.text : drawn.find(m => m.icon === 'calendar')?.text;
  const where = [place?.text, date].filter(Boolean).join(', ');
  // «Balta Balta Alesteu», «Concursul Concurs X»: a name that already says what it is keeps it alone.
  const title = card.title.replace(/\u00a0/g, ' ');
  const lead = title.toLowerCase().startsWith(ALT_LEAD[kind].toLowerCase().slice(0, 5)) ? '' : ALT_LEAD[kind];
  const head = `${lead ? `${lead} ` : ''}${title}${where ? `, ${where}` : ''}`;
  return facts.length ? `${head} — ${facts.join(', ')}` : head;
}
